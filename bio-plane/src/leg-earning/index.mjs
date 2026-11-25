/* leg-earning — what the record can earn for a leg of an inquiry's basis, and which questions rest on a target
 * (requirements: `build/requirements/leg-earning.md`). The earned registry (R1, R8, R9) and the cap a stated grade meets
 * (R2), the inquiry's earned basis as a viewer may read it (R3), the projected legs and the legs resting on a target (R4,
 * R5), the one walk that finds a cycle through inquiry legs (R6), the projects drawing on a question (R7; paged, R13;
 * as a viewer may be shown them, R14), and the table all of them read, `inquiry_basis`, with its one write (R12). T41
 * adds a passage of an AI transcription's capture ceiling (R15) and the authored note's route words (R16). It writes no
 * basis of its own and grades no conclusion: those are `inquiry`'s and `strength`'s.
 *
 * Split from `inquiry` by copy with no change of meaning (T33-44; K617, K1505): the code below is `inquiry`'s
 * `index.mjs` and `schema.mjs` as they stood at the split, its comments moved with it; `inquiry`'s job (T33-45) deletes
 * its copy and re-points its projection at `writeBasis`. New here: R8 (a held standard's text, K1447 (iii)) and R9 (a
 * duty occurrence, K1447 (i)).
 *
 * REACHED as `legEarningOf(host, deps)` (K61, K1563 (1)): one instance per host, created on the first call with `deps`,
 * returned to every later caller. At creation it creates its table and declares it to record-core (R12).
 * `deps`:
 *   record, membership, promotion, content   the modules it uses, through their factories on the same host unless a
 *                test passes its own.
 *   connections, entities, provenance, standards, duties   reached lazily, on first use, the same way.
 *   now          the module's clock, an ISO instant at second precision (default: the wall clock); R9's `asOf`. */

import { parseFrontmatter, normalizeType, OBJECT_TYPES, BASIS_GRADES, EARNED_CAPTURE_CEILING, UNREACHABLE_CAPTURE_GRADE,
         TESTIMONY_GRADE } from "../record-grammar/index.mjs";
import { parseImportedFindingRef, parseOccurrenceRef } from "../inquiry-grammar/index.mjs";
import { captureBound, isTranscribed, stepCovers, describeExtent } from "../textchain.mjs";
import { recordOf, stampInstant } from "../record-core/index.mjs";
import { membershipOf } from "../membership/index.mjs";
import { promotionOf } from "../promotion/index.mjs";
import { contentOf, CONTENT_MINTED_BY_PLANE, legContentId } from "../content/index.mjs";
import { connectionsOf } from "../connections/index.mjs";
import { entitiesOf, gradeRank } from "../entities/index.mjs";
import { provenanceOf, DOORBELL_VIA, UPLOAD_VIA } from "../provenance/index.mjs";
import { standardsOf, STANDARDS_CHECKS } from "../standards/index.mjs";
import { dutiesOf } from "../duties/index.mjs";
import { LEG_EARNING_TABLES, migrateLegEarning } from "./schema.mjs";
import { word, localize } from "../setup-words/index.mjs";

export { LEG_EARNING_SCHEMA, LEG_EARNING_TABLES, migrateLegEarning } from "./schema.mjs";

/** R3: how many legs one `earnedBasis` read backfills, and how many targets it answers. */
export const LEG_BACKFILL_MAX = 50;
export const EARNED_TARGETS_MAX = 200;
/** R3: how many ids one statement binds in `#legVersions` (D-36's variable ceiling); this module's own copy of the
 *  bound retrieval holds for its selections, which is not a service it provides (K57). */
const ID_CHUNK = 64;
/** R7 (N183): the projects drawing on one question, at most, the first by id (basis-versions R37's bound); deciding
 *  "more than one" is never cut by it. */
export const PROJECTS_DRAWING_MAX = 32;
/** R13: a page of the projects drawing on a question, at most and by default. */
export const PROJECTS_PAGE_MAX = 500;
export const PROJECTS_PAGE_DEFAULT = 100;
/** R14: the projects shown on one question, at most. */
export const PROJECTS_SHOWN_MAX = 200;

/** R1 (provenance R26, R51; K538): the capture-grade bases whose bytes no fetch measured, on which a leg keeps its
 *  author's letter under the ceiling, stated as authored: no recorded route, and material received through the
 *  doorbell. */
export const AUTHORED_ROUTE_BASES = Object.freeze(["CAPTURE_ROUTE_UNRECORDED", "CAPTURE_RECEIVED_NOT_FETCHED"]);

/** R16 (K2457, K2472): the words an authored ceiling's `why` names each route by, keyed by provenance's answered
 *  `route` (its R26 `unrecorded`, R51 `doorbell`, R63 `upload`), in the order they are named. A received route this
 *  table does not know is named by its own spelling, never as the doorbell. */
export const AUTHORED_ROUTE_WORDS = Object.freeze({
  [DOORBELL_VIA]: word("leg-earning.freeze.received_through_doorbell"),
  [UPLOAD_VIA]: word("leg-earning.freeze.uploaded_member"),
  unrecorded: word("leg-earning.unrecorded"),
});
const authoredRouteWords = (vias) => {
  const order = Object.keys(AUTHORED_ROUTE_WORDS);
  const rank = (v) => { const i = order.indexOf(v); return i === -1 ? order.length : i; };
  return [...new Set(vias)].sort((a, b) => rank(a) - rank(b) || String(a).localeCompare(String(b)))
    .map((v) => AUTHORED_ROUTE_WORDS[v] ?? word("leg-earning.map.received_route", { v: String(v) })).join("; ");
};

/** R8, R9: the viewer this module reads a held standard and a duty's occurrences as: a machine credential, which sees
 *  every bundle (membership R43), as `duties` reads for its own internal callers. The registry is an in-process read
 *  and gates nothing itself (R1). (`duties`' `INTERNAL` reader is not used: through it a standard's in-force answer is
 *  not given, so every derivation would read its source undetermined; reported, J2.) */
const SYSTEM_READER = "class:daemon";

/* §8.1's rank (entities' `gradeRank`): A strongest. */
const GRADE_RANK = gradeRank;
const safeJson = (s) => { try { return s == null ? null : JSON.parse(s); } catch { return null; } };
/** R3 (N522): a leg's target that is an imported finding reference (`inquiry-grammar` R11), another group's finding
 *  rather than a bundle of this record: never in `references[]`, no content row, projected as spelled. */
const isImportedRef = (t) => typeof t === "string" && parseImportedFindingRef(t) !== null;
/** R8: a target that is a held standard (`STD-`, record-grammar's `ID_TABLE`). */
const isStandardId = (t) => typeof t === "string" && normalizeType(OBJECT_TYPES[t.split("-")[0]]) === "standard";
/** R12: the type a target's prefix names, as the column `target_type` holds it ("" for none). */
const targetTypeOf = (t) => normalizeType(OBJECT_TYPES[String(t).split("-")[0]]) ?? "";

/** R2: ONE leg's capture letter against what the record can earn for its target (the registry's own entry). Null when
 *  the stated grade is within it (or the registry states no ceiling); otherwise the earned grade and why; a ceiling the
 *  record cannot determine answers a null grade with the reason. */
export function legCapped(stated, earned, targetId) {
  if (!earned || earned.mode !== "ceiling") return null;
  if (earned.grade == null)
    return { grade: null,
             why: earned.why
               ?? word("leg-earning.why.document_capture_support") };
  if (GRADE_RANK[stated] <= GRADE_RANK[earned.grade]) return null;
  /* The letters are interpolated and never typed: the grade vocabulary is their one home. */
  return { grade: earned.grade,
           why: word("leg-earning.why.record_support_leg", { grade: String(earned.grade), target_id: String(targetId), stated: String(stated), why: String(`${earned.why ?? ""}`.trimEnd()) }) };
}

/* ------------------------------------------------------------------ the module */

export class LegEarning {
  #deps;

  constructor({ storage, record, membership, promotion, content, connections = null, entities = null, provenance = null,
                standards = null, duties = null, host = null, now } = {}) {
    this.storage = storage;
    this.sql = storage.sql;
    this.record = record;
    this.membership = membership;
    this.promotion = promotion;
    this.content = content;
    this.#deps = { connections, entities, provenance, standards, duties, host };
    this.now = typeof now === "function" ? now : () => stampInstant("second");
    migrateLegEarning(this.sql);
  }

  /* The modules reached lazily: each is created on the same host on first use, unless a test passed its own. */
  get connections() { return this.#deps.connections ||= connectionsOf(this.#deps.host); }
  get entities() { return this.#deps.entities ||= entitiesOf(this.#deps.host); }
  get provenance() { return this.#deps.provenance ||= provenanceOf(this.#deps.host); }
  get standards() { return this.#deps.standards ||= standardsOf(this.#deps.host); }
  get duties() { return this.#deps.duties ||= dutiesOf(this.#deps.host); }

  #rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  #one(q, ...a) { for (const r of this.sql.exec(q, ...a)) return r; return null; }
  #when() { const w = this.now(); return typeof w === "string" && w ? w : stampInstant("second"); }

  /** The table and its added columns (R12). Idempotent: every boot; the constructor runs it too. */
  migrate() { migrateLegEarning(this.sql); }

  /* A published case's member (promotion's fact `caseMember`, publication's). Unprovided, it counts as a member: the
     conservative arm, which refuses the act rather than moving a case. */
  #caseMember(id) {
    const f = this.promotion.fact("caseMember", id);
    return f.ok ? !!f.value : true;
  }

  /* ---------------------------------------------------------------- R12: the table's one write */

  /** R12 (K1505 (2)): ONE inquiry's legs, replaced whole — delete-then-insert, so the table stays a projection of the
   *  document and never a second place to state it (D-21). `legs` are the projection's rows, in order: each
   *  `{ord?, target, role?, grade?, grade_axis?, grade_source?, note?, at?, ground?, content_id?}`, `ord` defaulting to
   *  the row's place; a row whose target is not a string is unprojectable and skipped (its ord is kept for the rest).
   *  `target_type` is derived here from the target's prefix, never taken from a caller. Asked inside the caller's
   *  transaction (the promotion's); answers the number of legs written. */
  writeBasis(bundleId, legs = []) {
    if (typeof bundleId !== "string" || !bundleId) return { ok: false, reason: "NO_ID", detail: localize("leg-earning.index.write_basis_requires_bundle_id", "writeBasis requires a bundle id") };
    const list = Array.isArray(legs) ? legs : [];
    this.sql.exec(`DELETE FROM inquiry_basis WHERE bundle_id=?`, bundleId);
    let written = 0;
    for (let i = 0; i < list.length; i++) {
      const l = list[i];
      if (!l || typeof l !== "object" || typeof l.target !== "string") continue;
      const str = (v) => (v === undefined || v === null ? null : String(v));
      this.sql.exec(
        `INSERT INTO inquiry_basis (bundle_id,ord,target_id,target_type,role,grade,grade_axis,grade_source,note,at,ground,content_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        bundleId, Number.isInteger(l.ord) ? l.ord : i, l.target, targetTypeOf(l.target),
        typeof l.role === "string" ? l.role : "",
        str(l.grade), str(l.grade_axis), str(l.grade_source),
        typeof l.note === "string" ? l.note : null, str(l.at),
        typeof l.ground === "string" && l.ground.trim() ? l.ground.trim() : null,
        typeof l.content_id === "string" && l.content_id ? l.content_id : null);
      written++;
    }
    return { ok: true, bundleId, written };
  }

  /** R7 (was inquiry R39's reading): the projects drawing on an inquiry — a project whose document cites it (connections' `refs`, kind `cites`),
   *  the citation not severed (connections R22), over every project whatever any viewer sees. At most
   *  `PROJECTS_DRAWING_MAX`, the first by id, the list carrying `truncated` when one more draws on it (N183). The
   *  candidates are read a page at a time, one past the bound, and a severed citer takes no slot, so the bound never
   *  decides whether more than one project draws on it. */
  projectsDrawingOn(id) {
    const out = [];
    out.truncated = false;
    if (!id) return out;
    let after = "";
    for (;;) {
      const page = this.#rows(
        `SELECT DISTINCT r.bundle_id AS p FROM refs r JOIN bundles b ON b.bundle_id = r.bundle_id
          WHERE r.target_id=? AND r.kind='cites' AND b.object_type='project' AND r.bundle_id > ?
          ORDER BY r.bundle_id LIMIT ?`, id, after, PROJECTS_DRAWING_MAX + 1);
      for (const r of page) {
        after = r.p;
        if (this.connections.edgeSevered(r.p, id, "cites")) continue;
        if (out.length === PROJECTS_DRAWING_MAX) { out.truncated = true; return out; }
        out.push(r.p);
      }
      if (page.length <= PROJECTS_DRAWING_MAX) return out;
    }
  }

  /** R13 (D36, D29): every project drawing on `id` — R7's test (a `cites` reference from a project's document, not
   *  severed), over every project whatever any viewer sees — a page at a time: the ids after `after`, ascending, at
   *  most `limit` (a positive integer, at most `PROJECTS_PAGE_MAX`, default `PROJECTS_PAGE_DEFAULT`), with `cursor` the
   *  last id answered when more draw on it, else null. A severed citer takes no slot. In-process only: no op routes
   *  to it, and R7's bound stays for R7's callers. */
  projectsDrawingOnPaged({ id, after = null, limit = null } = {}) {
    if (typeof id !== "string" || !id) return { ok: false, reason: "NO_ID", detail: "projectsDrawingOnPaged requires an id" };
    const n = Number.isInteger(limit) && limit > 0 ? Math.min(limit, PROJECTS_PAGE_MAX) : PROJECTS_PAGE_DEFAULT;
    const projects = [];
    let from = typeof after === "string" ? after : "";
    for (;;) {
      const page = this.#rows(
        `SELECT DISTINCT r.bundle_id AS p FROM refs r JOIN bundles b ON b.bundle_id = r.bundle_id
          WHERE r.target_id=? AND r.kind='cites' AND b.object_type='project' AND r.bundle_id > ?
          ORDER BY r.bundle_id LIMIT ?`, id, from, n + 1);
      for (const r of page) {
        from = r.p;
        if (this.connections.edgeSevered(r.p, id, "cites")) continue;
        if (projects.length === n) return { ok: true, id, projects, limit: n, cursor: projects[n - 1] };
        projects.push(r.p);
      }
      if (page.length <= n) return { ok: true, id, projects, limit: n, cursor: null };
    }
  }

  /** R14 (H38, D64): the projects drawing on a question as `viewer` may be shown them. A question the viewer may not
   *  see answers exactly as an absent one (R11). A project is shown only when it is not hidden (`membership` R85) and
   *  R44's `sight` lets the viewer see it at all (FULL, or EXISTENCE's id and name), each `{id, name}`; a hidden
   *  project is never answered, named or counted: it takes no slot and never sets `truncated`, so the answer is the
   *  same whether or not one draws. At most `PROJECTS_SHOWN_MAX`, the first by id, with `truncated` when one more
   *  would be shown. Read over R13's pages, so every project drawing on it is considered. */
  projectsShownOn({ id, viewer = null } = {}) {
    if (typeof id !== "string" || !id) return { ok: false, reason: "NO_ID", detail: "projectsShownOn requires an id" };
    if (!this.membership.inSight(id, viewer)) return { ok: false, reason: "NO_SUCH_BUNDLE", target: id };
    const projects = [];
    let after = null;
    for (;;) {
      const page = this.projectsDrawingOnPaged({ id, after, limit: PROJECTS_PAGE_MAX });
      for (const p of page.projects) {
        if (this.membership.visibilityOf(p) === "hidden") continue;
        if (this.membership.sight(p, viewer) === "none") continue;
        if (projects.length === PROJECTS_SHOWN_MAX) return { ok: true, id, projects, truncated: true };
        const t = this.#one(`SELECT title FROM bundles WHERE bundle_id=?`, p);
        projects.push({ id: p, name: t && typeof t.title === "string" ? t.title : null });
      }
      if (!page.cursor) return { ok: true, id, projects, truncated: false };
      after = page.cursor;
    }
  }

  /* THE ONE live-basis-leg predicate (REC-17 / D-5). Which inquiries REASON
   * FROM this one — `SELECT ... FROM inquiry_basis WHERE target_id=?`, the
   * single indexed lookup REC-11 built `inquiry_basis_target` for, and the
   * whole mechanism P-64 asks for. #citesInto answers the CITATION question for
   * information objects; this answers the BASIS question for inquiries, and the
   * two are deliberately separate because a citation and a leg of a claim are
   * different relationships (D-21, REC-11).
   *
   * LIVE, and each exclusion is a rule rather than a filter:
   *   - the citing document is read for the REFERENCE entry's status, exactly
   *     the way #citesInto reads it (basis ⊆ references[], C-6.3 as REC-11
   *     rewrote it), so a SEVERED edge does not block: severing is the recorded
   *     decision to stop relying, and treating it as live would make the
   *     refusal unclearable by the very act doctrine prescribes for clearing it.
   *   - a citing document that CANNOT BE READ counts as live. Refusing on what
   *     cannot be verified is the conservative arm and it is retire's already.
   *   - a `divided` dependent does not block. It is TERMINAL (DEC-28) and its
   *     legs were re-homed onto children that carry their own, so its basis is
   *     frozen history; counting it would refuse an act on behalf of a question
   *     that has been carried forward, and the remedy — sever the leg — cannot
   *     be performed on a terminal document at all.
   *
   * The offenders are named by (bundle_id, ord): REC-11's ord is what makes a
   * leg ADDRESSABLE, and one document legitimately carries two legs (D4). */
  /** R17: a leg is severed or live of its own. The citer's `basis[]` entry at the leg's ord carries the status
   *  `citation` R25 records per passage (`status: severed`; absent or `confirmed` is live). A leg that records none
   *  (a citer written before R25, or a leg of a document whose entry was severed whole) is read by the document's
   *  `references[]` edge, as before. `own` caches each citer's parsed basis for one read. */
  #legSevered(bundleId, ord, targetId, own) {
    if (!own.has(bundleId)) {
      const md = this.record.readFile(bundleId, "bundle.md");
      let basis = null;
      if (md && typeof md.text === "string") {
        const b = parseFrontmatter(md.text).data?.basis;
        if (Array.isArray(b)) basis = b;
      }
      own.set(bundleId, basis);
    }
    const leg = own.get(bundleId)?.[ord];
    if (leg && typeof leg === "object" && leg.target === targetId && typeof leg.status === "string")
      return leg.status === "severed";
    return this.connections.edgeSevered(bundleId, targetId);
  }

  restsOnLive(id) {
    const confirmed = [], severed = [], frozen = [], own = new Map();
    for (const r of this.#rows(
      `SELECT ib.bundle_id, ib.ord, ib.role, b.current_state, b.object_type
         FROM inquiry_basis ib JOIN bundles b ON b.bundle_id = ib.bundle_id
        WHERE ib.target_id=? ORDER BY ib.bundle_id, ib.ord`, id)) {
      const leg = { bundle_id: r.bundle_id, ord: r.ord, role: r.role || null,
                    state: r.current_state };
      if (r.current_state === "divided") continue;
      /* D-267: the same one severance confirmation #citesInto and the queue's
         ancestor walk read, with NO relation constraint — a basis leg is a
         reference entry and the leg does not restate the rel. */
      if (this.#legSevered(r.bundle_id, r.ord, id, own)) { severed.push(leg); continue; }
      /* FROZEN vs WORKING, and the split is the D-5 refinement this item makes
         (reported to CONDUCT rather than buried): a `published` dependent's
         basis is inside a SIGNED EDITION and cannot be edited at all, so it can
         never withdraw a leg. Both sets are returned; which one an act refuses
         on is the ACT's rule, stated at the act. */
      /* CASE-4 / DEC-72: the question is THE CASE RELATION, not the state word.
         The sentence above is unchanged and is now literally true rather than
         true by proxy: what makes a dependent's basis unwithdrawable is that its
         current version is the one a case froze and signed — which is what the
         pin says, and what `current_state: published` used to stand in for.
         A dependent that was published and has since been reopened is WORKING
         again and belongs in `confirmed`, which is exactly where the state word
         put it too; the difference is that this asks the fact directly. */
      (this.#caseMember(r.bundle_id) ? frozen : confirmed).push(leg);
    }
    return { confirmed, frozen, severed, all: [...confirmed, ...frozen] };
  }


  /** THE LEGACY BACKFILL — a leg promoted before this column existed, read for
   *  the first time.
   *
   *  DETERMINISTIC BECAUSE THE ID IS A HASH. There is no allocator, so "mint the
   *  row this leg would have had" is a pure function of the target the leg
   *  already names: the whole document (Bob, 5.3 — a citation with no stated
   *  part means the whole document and reads `document`, never `unstated`), the
   *  capture `#captureForContent` resolves, and the chain as it stands. Running
   *  it twice, or in two sessions, or after a replay, produces the same id — so
   *  this is a read that happens to write rather than a migration with a
   *  direction.
   *
   *  IT WRITES THE COLUMN AS WELL AS THE ROW, so the second read is a lookup.
   *  Not doing so would leave the projection permanently disagreeing with the
   *  row it resolves to, which is the drift `inquiry_basis` is delete-then-
   *  inserted to prevent.
   *
   *  THE HONEST NULLS, and each is a different fact stated rather than invented:
   *  a leg whose target is an INQUIRY has no capture behind it at all (an
   *  inquiry is not a document — DEC-21 — and IC-83's "every leg targets
   *  content" is written about the information arm); a leg whose target
   *  information object the record holds no bytes for has nothing to address.
   *  Both answer null and say which. */
  ensureLegContent(bundleId, ord) {
    const leg = this.#one(
      `SELECT bundle_id, ord, target_id, target_type, content_id
         FROM inquiry_basis WHERE bundle_id=? AND ord=?`, bundleId, ord);
    if (!leg) return { ok: false, reason: "NO_LEG",
                       detail: localize("leg-earning.index.no_basis_leg_ord_on", "no basis leg {ord} on {bundleId}", { ord: String(ord), bundleId: String(bundleId) }) };
    if (leg.content_id)
      return { ok: true, content_id: leg.content_id, minted: false, backfilled: false };
    /* R3 (N522): another group's finding is no document of this record: its grades are the edition's it names. */
    if (isImportedRef(leg.target_id))
      return { ok: true, content_id: null, minted: false, backfilled: false,
               null_case: "IMPORTED_TARGET",
               why: localize("leg-earning.index.basis_ord_rests_on_target", "basis[{ord}] rests on {target_id}, another team's finding, graded as the edition this leg names publishes it. This record holds no part of it, so it has no content row here", { ord: String(ord), target_id: String(leg.target_id) }) };
    /* REC-83: THE CASE IS NAMED, NOT ONLY DESCRIBED. IC-83's AMENDMENT 2 says
       the reads must state WHICH of the two legitimate nulls they met and never
       collapse them, and a reader that has to pattern-match an English sentence
       to tell them apart is a reader that will collapse them. The code is
       decided HERE because this is where the distinction is made; every read
       carries it rather than re-deriving it from `target_type`. */
    if (leg.target_type !== "information")
      return { ok: true, content_id: null, minted: false, backfilled: false,
               null_case: "INQUIRY_TARGET",
               why: localize("leg-earning.index.basis_ord_rests_on_target_2", "basis[{ord}] rests on {target_id}, which is an inquiry rather than a document. An inquiry has no capture and therefore no part to point at — the content axis ranges over documents (DEC-21), and this is undetermined and stated rather than a document-extent row invented for it", { ord: String(ord), target_id: String(leg.target_id) }) };
    const sha = this.content.captureFor(leg.target_id);
    if (!sha)
      return { ok: true, content_id: null, minted: false, backfilled: false,
               null_case: "NO_BYTES_HELD",
               why: localize("leg-earning.index.this_record_holds_no_capture", "this record holds no capture of {target_id}, so there are no bytes for a content row to address. Absence here is a fact about what was captured and never evidence about what the document says (CLAUDE.md's sparse rule)", { target_id: String(leg.target_id) }) };
    const out = this.content.mint({ bundleId: leg.target_id, captureSha: sha,
                                   extent: { kind: "document" },
                                   mintedBy: CONTENT_MINTED_BY_PLANE });
    if (!out.ok) return out;
    this.sql.exec(`UPDATE inquiry_basis SET content_id=? WHERE bundle_id=? AND ord=?`,
      out.content_id, bundleId, ord);
    return { ...out, backfilled: true };
  }


  /** IC-84 (4)'s other half — THE LEGACY BACKFILL, WIRED.
   *
   *  REC-82 landed `ensureLegContent` as a pure function with NO CALLER and
   *  said so in its own suite rather than leaving the gap to be found. This is
   *  the caller: the first read that asks what a leg earns mints the
   *  `document` row a leg written before the column existed should always have
   *  had. Deterministic because the id is a hash, so it is a read that happens
   *  to write rather than a migration with a direction — running it twice, in
   *  two sessions, or after a replay produces the same id.
   *
   *  ONE TRANSACTION FOR THE WHOLE BASIS, not one per leg.
   *
   *  THE TWO LEGITIMATE NULLS COME BACK AS THEMSELVES AND ARE CARRIED, NEVER
   *  COLLAPSED (IC-83's AMENDMENT 2): an inquiry target has no capture and no
   *  part to point at (DEC-21), and a target the record holds no bytes of has
   *  nothing to address. `ensureLegContent` answers each with its own `why`,
   *  and this pass puts that sentence on the leg so every read that meets the
   *  null states WHICH it is.
   *
   *  BOUNDED, AND THE BOUND IS STATED IN THE ANSWER. A basis's leg count is
   *  unbounded by the schema and `ensureLegContent` does a small fixed number
   *  of reads per leg, so an unbounded backfill behind a member-callable read
   *  is REC-66's amplification arriving at a new door. It is capped, and a read
   *  that hit the cap says so and leaves the rest for the next read — safe
   *  precisely because the id is a pure function of the leg. R3's test
   *  (`test/m/leg-earning/earned-basis.test.mjs`) drives the bound over 51 legs and
   *  the next read's continuation. */
  #backfillLegContent(bundleId, legs) {
    const need = legs.filter((l) => !l.content_id);
    const run = need.slice(0, LEG_BACKFILL_MAX);
    if (!run.length) return { ran: 0, truncated: false };
    const outcomes = new Map();
    this.record.transact(() => {
      for (const l of run) outcomes.set(l.ord, this.ensureLegContent(bundleId, l.ord));
    });
    for (const l of run) {
      const o = outcomes.get(l.ord);
      if (!o || !o.ok) { l.why_no_content = o && o.detail ? o.detail : null; continue; }
      if (o.content_id) { l.content_id = o.content_id; l.backfilled = !!o.backfilled; }
      else { l.null_case = o.null_case || null; l.why_no_content = o.why || null; }
    }
    return { ran: run.length, truncated: need.length > run.length };
  }

  /* ===================== REC-18 · THE EARNED BASIS GRADES ===========   *
   * DATA-MODEL D1(b), as DEC-15 closed it: a document leg's CONNECTION grade is
   * EARNED — the strongest resolution of that document's captures to the
   * inquiry's SUBJECT ENTITY — and its CAPTURE grade is earned from the capture
   * record. Both are computed HERE, server-side, and the write path refuses a
   * leg stating anything else (checkEarnedLeg). The rule is the recogniser's own,
   * moved up one layer: "the RECOGNISER never mints a D; the model holds it so a
   * member can testify, never the machine" (the legacy `schema.mjs`, deleted since).
   *
   * ONE FUNCTION, THREE CONSUMERS, and that is deliberate: op=promote's write
   * path, the ratification gate, and op=earnedbasis (the read a surface uses to
   * fill a leg in BEFORE writing it) all call this. A member who cannot learn
   * what a leg earns is a member the refusal pressures into inventing one, which
   * is the failure mode the old process's CLAUDE.md named about gates.
   */

  /* THE CAPTURE-AXIS CEILING is doctrine rather than a tuning knob, and as of
     REC-43 / DEC-39 it is DECLARED IN THE RECORD'S GRAMMAR rather than here.
     `static EARNED_CAPTURE_CEILING = "B"` stood on this line until 2026-08-04
     and the value is unchanged; what moved is WHERE it is written, so that the
     published co-attestation fence could be composed from it (affordances.mjs
     could not import the legacy store, which imported it). The doctrine, the reason
     for the direction and the derivation of the unreachable letter above it are
     all at the declaration in `record-grammar` (`grades.mjs`), and `checkEarnedLeg`
     is the arm that refuses a leg claiming more than this. This class
     keeps no copy: a second literal "B" here is precisely the drift the move
     exists to prevent. */

  /** The earned registry for one inquiry over one set of basis targets.
   *
   *  CONNECTION: the strongest resolution of each target document's captures to
   *  the subject entity, through #strongestResolutionsFor — the SAME collapse
   *  op=concerns, op=connect and op=thread make, reused rather than restated so
   *  a leg's grade cannot drift from the grade that document appears at in the
   *  reverse index. A/B/C ONLY: a grade-D resolution is a member's testimony
   *  (op=resolvetestify), so a document known to concern the subject only by
   *  testimony earns NOTHING here and its leg is testimony, with its own author
   *  and date. That is the machine-never-mints-a-D rule holding at this layer
   *  too, and it is why the D rows are dropped rather than passed through.
   *
   *  CAPTURE: whether the record holds registered captures for that document.
   *  Read from `register`, which is what op=promote writes when a bundle's
   *  bytes are registered — the capture record itself, never a caller's claim.
   *
   *  Bounded by the TARGETS asked about (a basis, or a caller's list) and not by
   *  the corpus, and it runs two indexed reads per call rather than a probe per
   *  leg — publishedRegistryFor's shape and for its reason. */
  /*  REC-83 / IC-84 (3) — THE THIRD ARGUMENT, AND WHY THE ANSWER STAYS
   *  BYTE-IDENTICAL WITHOUT IT. `contentIds` is the set of content rows the
   *  caller's legs point at. Given none — which is every existing caller: the
   *  write path (`earnedRegistryForDoc`), the ratification gate, and the two
   *  internal registry reads — this function returns EXACTLY what it returned
   *  before this item, with no `earned.content` key at all. That is not
   *  caution: a document-grain leg's earned basis must not move because the
   *  record learned to answer at a finer grain, and the over-strictness arm of
   *  this item's control set asserts it against a figure measured on the
   *  pristine tree.
   *
   *  THE CONTENT BLOCK IS DERIVED FROM `earned.connection`, NOT BESIDE IT. A
   *  `document` row earns what its document earns, taken from the map this
   *  function just built rather than recomputed — so the two grains cannot
   *  disagree, which is the same reason this is ONE function with three
   *  consumers in the first place. */
  earned(subjectEntity, targetIds = [], contentIds = []) {
    const asked = [...new Set((Array.isArray(targetIds) ? targetIds : [])
      .filter((t) => typeof t === "string" && t))];
    /* R8, R9: a held standard and a duty occurrence earn by their own rules, after the documents; neither joins the
       connection or the document capture reads below. */
    const standardIds = asked.filter(isStandardId);
    const occurrenceIds = asked.filter((t) => !isStandardId(t) && parseOccurrenceRef(t) !== null);
    const ids = asked.filter((t) => !standardIds.includes(t) && !occurrenceIds.includes(t));
    const ent = subjectEntity
      ? (() => { const r = this.entities.readEntity({ entityId: subjectEntity });
                 return r && r.found && r.entity ? r.entity : null; })()
      : null;
    const out = { subject_entity: subjectEntity || null,
                  subject_label: ent ? ent.label : null,
                  subject_known: !!ent,
                  /* MK-2 / IC-142: a `testimony` map joins these two ONLY when a
                     target asked about IS an authored observation (CASE 0 below)
                     — REC-83's `content` precedent, for its reason: a caller who
                     asked about no observation gets an answer byte-identical to
                     the one it got before the axis existed, and every existing
                     consumer is on that path. Readers take its absence as "no
                     target here is an observation", which is exactly what it is. */
                  earned: { connection: {}, capture: {} } };
    if (!ids.length) return this.#earnHeld(out, standardIds, occurrenceIds);
    const want = new Set(ids);
    if (subjectEntity) {
      /* Collapse per CAPTURE first (the established collapse), then take the
         strongest of a document's captures — a document may hold several, and
         D1(b)'s words are "the strongest resolution of that document's
         CAPTURES". Doing it in this order rather than one max over the raw rows
         keeps the two steps visible and keeps the per-capture step the shared
         one. */
      const perCapture = this.entities.strongestByCapture(subjectEntity);
      for (const c of perCapture.values()) {
        if (!c.bundle_id || !want.has(c.bundle_id)) continue;
        /* A/B/C ONLY. The machine never mints a D.
           REC-51 LEFT THIS LITERAL DELIBERATELY, and it is the ONE grade-letter
           literal still standing anywhere in src/. It is NOT a copy of
           `BASIS_GRADES` — it is a strict SUBSET of it carrying its own
           doctrine: the grades a MACHINE may mint. Grade D is a member's
           TESTIMONY (op=resolvetestify), recorded with an author and a date, and
           the recogniser never produces one; `checkEarnedLeg` types that 'D' at
           the enforcement point itself, so there is no exported constant to
           compose from and MINTING ONE WOULD BE A RULING — what a machine may
           earn, and whether that set follows the catalog when the catalog moves,
           is a doctrine question and no DEC is open in it. Deriving it (say, as
           "all but the weakest") would silently answer it.
           So it is held the way REC-50 held op=acquire's archive letter: OPEN BY
           DECISION, NOT BY OVERSIGHT, and guarded by R1's test
           (`test/m/leg-earning/earned.test.mjs`) rather than by this comment: it
           drives a resolution at every letter of `BASIS_GRADES` and holds that
           the letters earned are its STRONGEST-FIRST PREFIX short of the
           testimony grade. Pinning that relation asserts no VALUE, so it is not a
           ruling; what it buys is that a catalog change which reorders or renames
           the vocabulary FAILS there by name instead of leaving this subset
           quietly meaning something new. */
        if (!["A", "B", "C"].includes(c.grade)) continue;
        const cur = out.earned.connection[c.bundle_id];
        if (!cur || GRADE_RANK[c.grade] > GRADE_RANK[cur.grade])
          out.earned.connection[c.bundle_id] = { grade: c.grade, capture_sha: c.capture_sha, captures: 0 };
      }
      for (const c of perCapture.values())
        if (c.bundle_id && out.earned.connection[c.bundle_id]) out.earned.connection[c.bundle_id].captures++;
      for (const [id, e] of Object.entries(out.earned.connection))
        /* mode 'value': `resolutions` holds the grade ITSELF, so the leg must
           state this letter and no other. */
        e.mode = "value",
        e.why = localize("leg-earning.index.id_resolves_to_subjectentity_v1", "{id} resolves to {subjectEntity}{v1} at grade {grade} — the strongest of the {captures} capture(s) of that document the recogniser matched to this subject. Grade states HOW it was matched (framework 8.1) and nothing about how credible the document is.", { id: String(id), subjectEntity: String(subjectEntity), v1: String(ent ? ` (${ent.label})` : ""), grade: String(e.grade), captures: String(e.captures) });
    }
    /* THE CAPTURE RECORD IS BOTH PLACES A CAPTURE LANDS, and asking only one of
       them would earn nothing for half the corpus. `register` holds the captures
       a promotion REGISTERED against a bundle's files; `readings` holds the ones
       a captured document's provenance carried. A document acquired through
       op=acquire has both; one intaken with a provenance document has only the
       second. The union is what "the record holds bytes for this document"
       actually means. */
    /* ================= REC-88 / D-349 · THE FIDELITY BOUND ================
     *
     * THE CHAIN TRAVELS WITH THE CAPTURE, IN THE SAME READ. The union above is
     * unchanged in WHAT it enumerates — one row per distinct (bundle, capture)
     * — and gains a LEFT JOIN onto `reading_text_source`, the projection that
     * already holds every capture's chain. So this is still ONE indexed read
     * and this function is still the two-reads-per-call shape it was built in;
     * what moved is that the rows come back per capture and the count is taken
     * here instead of by `GROUP BY`. `count(*)` over the same union and a
     * length over the same rows are the same number by construction, and the
     * §7 pin asserts it stayed 1 where it was 1.
     *
     * A LEFT join, deliberately: a capture the record holds bytes of but has
     * never READ has no row there, and that is not a missing fact — it is an
     * UNTRANSCRIBED capture, which `captureBound(null, …)` already answers for
     * by passing the byte grade through. An INNER join would have silently
     * dropped every unread capture out of the capture axis, which is most of
     * the corpus (CAP-9 measured 88 captured documents and 0 readings on this
     * project's own instance) — the fence-tighter-than-its-rule failure, and it
     * would have read as this item working. */
    /* The scan sits in the `for` header for an instrument that read loops by their spelling (provenance: REC-88's
       `derivation-bounds.test.mjs`, deleted in T20); hoisted to a `const`, the query, rows and work are the same. */
    const perBundle = new Map();
    for (const r of this.#rows(
      `SELECT u.bundle_id AS bundle_id, u.capture_sha AS capture_sha, ts.chain AS chain,
              (SELECT ra.authored FROM register ra WHERE ra.capture_sha = u.capture_sha) AS authored FROM (
         SELECT bundle_id, capture_sha FROM register WHERE bundle_id IN (SELECT value FROM json_each(?))
         UNION
         SELECT bundle_id, capture_sha FROM readings WHERE bundle_id IN (SELECT value FROM json_each(?))
       ) u LEFT JOIN reading_text_source ts ON ts.capture_sha = u.capture_sha`,
      /* D-443: the list is bound TWICE, so one variable per id failed from ~50 targets (D-36). */
      JSON.stringify(ids), JSON.stringify(ids))) {
      if (!r.bundle_id) continue;
      if (!perBundle.has(r.bundle_id))
        perBundle.set(r.bundle_id, { n: 0, bound: null, transcribed: 0, authored: 0, byteBest: null, unruled: 0,
                                     measured: 0, authoredRoutes: [], authoredVias: [] });
      const e = perBundle.get(r.bundle_id);
      /* MK-1 / D-184: A MEMBER'S AUTHORED WORDS ARE NOT A CAPTURE ON THIS AXIS.
         The capture axis measures the act of reading a document in (DEC-21's
         amendment); nobody read these bytes in from anywhere, so they contribute
         NO LETTER and are not counted as a capture — `captureBound(null, …)`
         would otherwise have passed the byte grade straight through and earned an
         observation the fetch ceiling, which is strength it does not have
         (`MEMBER-KNOWLEDGE-DESIGN.md` §3). Counted apart, so the entry below can
         SAY why the axis is undetermined rather than fall silent. */
      if (r.authored === 1) { e.authored++; continue; }
      e.n++;
      /* THE RULE ITSELF IS `captureBound`'S AND IS NOT RESTATED HERE. It is
         handed the capture's chain and the BYTE grade, and it answers the
         weakest link of the two — a letter, or null for UNDETERMINED. This file
         does not know that an OCR step weakens and an attestation does not, it
         does not know that an unmeasured transcription is null rather than
         "fine", and it must not learn: DEC-4's arithmetic has one home. */
      /* One capture's letter, by the one rule `#captureLetter` holds (R8 reads a standard's text by it too). */
      const { byteGrade, authoredRoute, authoredVia, transcribed, bound: b } = this.#captureLetter(r.capture_sha, r.chain);
      if (byteGrade == null) { e.unruled++; if (transcribed) e.transcribed++; continue; }
      if (authoredRoute) {
        if (!e.authoredRoutes.includes(authoredRoute)) e.authoredRoutes.push(authoredRoute);
        if (!e.authoredVias.includes(authoredVia)) e.authoredVias.push(authoredVia);
      }
      else e.measured++;
      e.byteBest = e.byteBest == null ? byteGrade
        : (BASIS_GRADES.indexOf(byteGrade) < BASIS_GRADES.indexOf(e.byteBest) ? byteGrade : e.byteBest);
      if (transcribed) e.transcribed++;
      if (b == null) continue;          /* undetermined contributes no letter; `e.bound` stays null unless another capture supplies one */
      /* THE STRONGEST OVER THE DOCUMENT'S CAPTURES, which is the collapse this
         same function already makes on the connection axis ("the strongest
         resolution of that document's CAPTURES") — reused so the two axes
         cannot drift about what a document with several captures means.
         `mode: 'ceiling'` decides the direction on its own: the entry states
         the MAXIMUM any leg may claim, so a document one of whose captures
         genuinely supports B must not be refused a B because a second, weaker
         capture of the same document exists. That would be a fence tighter than
         its rule. Every capture's own bound is still visible to a reader
         through `op=textprovenance`, which publishes the chain per capture. */
      e.bound = e.bound == null ? b
        : (BASIS_GRADES.indexOf(b) < BASIS_GRADES.indexOf(e.bound) ? b : e.bound);
    }
    for (const [bundleId, e] of perBundle) {
      /* MK-1 — CASE 0: THE DOCUMENT IS A MEMBER'S AUTHORED OBSERVATION AND HOLDS
         NO CAPTURE OF ANYTHING. Present with a NULL grade, on CASE 2's rule: an
         absent entry would say "the record holds no bytes for this document",
         which is false — it holds exactly the member's words. The leg may state
         no capture grade, which suspends the axis and names it; it may not state
         a letter. Its grade is testimony, on the axis MK-2 built beside this one. */
      if (!e.n && e.authored) {
        /* MK-2 / IC-142 — THE TESTIMONY AXIS, EARNED FROM THE REGISTER. What the
           record holds is that these bytes are a member's authored words (the
           flag only op=testify can set, C-53.8), and the ruling is what that is
           worth: TESTIMONY_GRADE, on the observing member's trust. mode 'value'
           on resolution's precedent — the record holds the letter, so a leg
           states that letter and no other (checkTestimonyLeg).
           NOTHING ELSE IS READ HERE, AND THAT ABSENCE IS THE RULE: no
           attestation, no co-signature, no count of members who agree. The
           design's words (section 3): a second member's attestation does NOT
           raise it, because a co-signature is not a second observation. A
           second member who saw the same thing records their own, and the case
           then rests on two testimonies, each at this letter. */
        (out.earned.testimony ||= {})[bundleId] = {
          mode: "value", grade: TESTIMONY_GRADE, authored: e.authored,
          why: localize("leg-earning.index.bundleid_is_a_members_own", "{bundleId} is a member's own firsthand observation, recorded through op=testify: it is graded as testimony, {TESTIMONY_GRADE}, and stands on the observing member's trust. Nothing raises it — another member agreeing with it is a co-signature, not a second observation.", { bundleId: String(bundleId), TESTIMONY_GRADE: String(TESTIMONY_GRADE) }) };
        out.earned.capture[bundleId] = {
          mode: "ceiling", grade: null, captures: 0, authored: e.authored,
          determined: false,
          undetermined_because: "CAPTURE_AXIS_AUTHORED",
          /* CORRECTED BY MK-2, never exempted: this read "this build does not
             yet carry that axis", which was true until the axis landed. */
          empty_level: localize("leg-earning.index.testimony_this_document_is_a", "testimony — this document is a member's own firsthand observation, graded on that member's trust on the testimony axis at {TESTIMONY_GRADE} (MEMBER-KNOWLEDGE-DESIGN.md section 3); the capture axis does not apply to it", { TESTIMONY_GRADE: String(TESTIMONY_GRADE) }),
          why: localize("leg-earning.index.bundleid_is_a_members_authored", "{bundleId} is a member's authored observation: its bytes are the member's own words, recorded through op=testify, and nothing was read in from anywhere. The capture axis measures that act, so it earns no letter here — a {EARNED_CAPTURE_CEILING} would be true of the bytes and would read as strength the observation does not have. A leg may state NO capture grade, which suspends the axis and names it; it may not state a letter. Its grade is testimony, {TESTIMONY_GRADE}, on the testimony axis.", { bundleId: String(bundleId), EARNED_CAPTURE_CEILING: String(EARNED_CAPTURE_CEILING), TESTIMONY_GRADE: String(TESTIMONY_GRADE) }) };
        continue;
      }
      if (!e.n) continue;
      const captureWord = word("leg-earning.capture_word", { bundle_id: String(bundleId), n: String(e.n) });
      /* The unreachable letter is DERIVED, never typed (REC-48): it is the rank
         immediately above EARNED_CAPTURE_CEILING in the same BASIS_GRADES array
         checkEarnedLeg compares this leg against, so the sentence a member reads
         and the refusal that enforces it cannot say different things. */
      const ceiling = word("leg-earning.ceiling.grade_reachable_capture", { unreachable_capture_grade: String(UNREACHABLE_CAPTURE_GRADE) });
      /* CASE 1 — NOTHING TRANSCRIBED THIS DOCUMENT'S TEXT, so there is no
         fidelity to bound the bytes by and the answer is the one this record
         has given since REC-18, BYTE FOR BYTE. That identity is not caution: a
         leg on publisher-typed text must not move because the record learned to
         ask a question whose answer for it is "no change", and IC-84's §7
         over-strictness arm pins exactly that. No new key appears here. */
      /* K538 (provenance R26, R51, R63), R16 (K2457): no capture of this document came by a measured route, so the
         ceiling below is the most an author may state, not a measurement: said so, beside the letter, each route the
         captures came by named in words (provenance's answered `route`), in `AUTHORED_ROUTE_WORDS`' order. */
      const asAuthored = !e.measured && e.authoredRoutes.length ? {
        stated_as: "authored", route_basis: [...e.authoredRoutes].sort(),
        why: word("leg-earning.why.fetched_route_measures", { captures: String(captureWord), routes: String(authoredRouteWords(e.authoredVias)), ceiling: String(EARNED_CAPTURE_CEILING) }) } : null;
      if (!e.transcribed && e.bound === EARNED_CAPTURE_CEILING) {
        out.earned.capture[bundleId] = {
          /* mode 'ceiling', and the difference from the connection axis is not a
             softening — it is the record being honest about what it holds. There
             is no per-document capture grade column anywhere in this schema, so
             the record cannot say "this document's capture is worth C"; what it
             CAN say is that it holds bytes for the document and what the strongest
             capture this plane produces is worth. A leg may not claim more than
             that (which is what makes grade A unreachable rather than merely
             discouraged); a weaker letter is the member's account of a poorer
             route and stays theirs. */
          mode: "ceiling",
          grade: EARNED_CAPTURE_CEILING, captures: e.n,
          why: word("leg-earning.why.strongest_capture_grade", { capture_word: String(captureWord), earned_capture_ceiling: String(EARNED_CAPTURE_CEILING) }),
          ceiling, ...(asAuthored || {}) };
        continue;
      }
      /* CASE 2 — EVERY TRANSCRIPTION OF THIS DOCUMENT IS UNMEASURED, so the
         bound is UNDETERMINED and the axis says so. THE ENTRY IS STILL PRESENT
         WITH A NULL GRADE, and that distinction is the whole of DEC-49's rule
         applied to a grade: an ABSENT entry means "the record holds no bytes for
         this document", a PRESENT entry with a null grade means "the record
         holds the bytes and cannot say what the text derived from them is worth".
         Collapsing the two would tell a member to go capture a document the
         record already has. The empty level is NAMED rather than described,
         because a member who is told what is missing can go and get it. */
      if (e.bound == null && !e.transcribed) {
        /* N82: no capture of this document came by a route any ruling grades (provenance R26's unruled via). */
        out.earned.capture[bundleId] = {
          mode: "ceiling", grade: null, captures: e.n,
          determined: false,
          undetermined_because: "CAPTURE_GRADE_VIA_UNRULED",
          empty_level: localize("leg-earning.index.capture_route_no_ruling", "capture route — the bytes of this document were served by a route no ruling grades"),
          why: word("leg-earning.why.served_route_ruling", { capture_word: String(captureWord) }),
          ceiling };
        continue;
      }
      if (e.bound == null) {
        out.earned.capture[bundleId] = {
          mode: "ceiling", grade: null, captures: e.n,
          determined: false,
          undetermined_because: "CAPTURE_FIDELITY_UNMEASURED",
          empty_level: localize("leg-earning.index.transcription_fidelity_unmeasured", "transcription fidelity — this document's text was derived by a machine and no step in that derivation carries a measured fidelity (the MEASUREMENTS ledger, per engine, per version)"),
          why: localize("leg-earning.index.captureword_but_every_transcription_of", "{captureWord}, but every transcription of its text is UNMEASURED: no step in the provenance of this document's text carries a measured fidelity, so what a leg resting on that text may claim about how it was captured is undetermined. That is a statement, not a permission — DEC-4 bounds the capture axis by transcription fidelity as its weakest link, so an unmeasured derivation bounds it to nothing rather than to {EARNED_CAPTURE_CEILING}. A leg may state NO capture grade, which suspends the axis and names it; it may not state a letter this record cannot support.", { captureWord: String(captureWord), EARNED_CAPTURE_CEILING: String(EARNED_CAPTURE_CEILING) }),
          ceiling };
        continue;
      }
      /* CASE 3 — A MEASURED FIDELITY, AND IT IS THE CEILING NOW. When the
         weakest link is the BYTES the letter is unchanged and the entry is
         byte-identical to case 1 by construction (`captureBound` never raises,
         so `bound === EARNED_CAPTURE_CEILING` means fidelity did not bind) —
         which is why a document OCR'd at B earns exactly what it earned before
         and gains no key. When the weakest link is the FIDELITY the letter
         falls, and only then does the entry say so. */
      if (e.bound === EARNED_CAPTURE_CEILING) {
        out.earned.capture[bundleId] = {
          mode: "ceiling",
          grade: EARNED_CAPTURE_CEILING, captures: e.n,
          why: word("leg-earning.why.strongest_capture_grade", { capture_word: String(captureWord), earned_capture_ceiling: String(EARNED_CAPTURE_CEILING) }),
          ceiling, ...(asAuthored || {}) };
        continue;
      }
      if (!e.transcribed || e.bound === e.byteBest) {
        /* N82: the ROUTE binds (an archive replay, provenance R25), not the transcription. */
        out.earned.capture[bundleId] = {
          mode: "ceiling", grade: e.bound, captures: e.n,
          bounded_by: "CAPTURE_BOUNDED_BY_ROUTE",
          why: word("leg-earning.why.strongest_route_group", { capture_word: String(captureWord), bound: String(e.bound) }),
          ceiling };
        continue;
      }
      out.earned.capture[bundleId] = {
        mode: "ceiling", grade: e.bound, captures: e.n,
        bounded_by: "CAPTURE_BOUNDED_BY_FIDELITY",
        /* THE WORDING AVOIDS "grade a": the capture rule's letters have one
           home and are composed from the constant, never typed beside the
           word "grade" (found by `hygiene.test.mjs` detector (B), deleted in
           T20, which could not tell the article from the letter). */
        why: localize("leg-earning.index.fidelity_bound_bytes_fetched", "{captureWord}, and the bytes as your team's Civicsmith fetched them would be worth {EARNED_CAPTURE_CEILING} — but this document's TEXT was derived by a machine and that derivation is measured at {bound}. The capture axis is bounded by the weakest link of byte provenance and transcription fidelity, with no third scale (DEC-4), so the strongest capture grade this document can earn is {bound}. Transcription never RAISES a capture grade, and it is not a separate measurement a member can cite instead.", { captureWord: String(captureWord), EARNED_CAPTURE_CEILING: String(EARNED_CAPTURE_CEILING), bound: String(e.bound) }),
        ceiling };
    }
    /* REC-83 / IC-84 (3): THE SAME REGISTRY, AT CONTENT GRAIN. Keyed by content
       row, added only when the caller named rows — so the answer every existing
       consumer gets is unchanged, and a `document`-extent row's connection is
       the document's own entry above rather than a second computation of it. */
    if (Array.isArray(contentIds) && contentIds.length)
      out.earned.content = this.content.standings(contentIds, out.earned.connection);
    for (const [id, axis] of Object.entries(this.connections.portionAxes(contentIds, { entityId: subjectEntity }))) if (out.earned.content?.[id]?.connection?.grain === "portion") out.earned.content[id].connection = axis;
    /* R15 (D21; D4): a passage of an AI transcription earns its capture ceiling at the passage's own grain. */
    if (out.earned.content) for (const st of Object.values(out.earned.content)) this.#aiPassageCeiling(st);
    return this.#earnHeld(out, standardIds, occurrenceIds);
  }

  /* R1, R8: ONE capture's letter on the capture axis. THE BYTE GRADE IS THE CAPTURE'S OWN (N82, K182), from how the
     bytes were fetched (provenance R24–R26): a direct receipt earns the ceiling, an archive replay one rank below, and
     bytes with no recorded route keep the ceiling as the most an author may state (R26). A route no ruling grades is
     UNDETERMINED and contributes no letter (`byteGrade` null). K538 (provenance R51): bytes received through the
     doorbell, never fetched, are the second route no fetch measures: like R26's unrecorded route, a leg on them keeps
     its author's letter under the ceiling, stated as authored, never as measured; which of the two it was is answered
     as `authoredRoute`. The bound is `captureBound`'s over the capture's text chain (DEC-4's arithmetic has one home,
     there): a letter, or null for undetermined. */
  #captureLetter(captureSha, chainJson) {
    const chain = safeJson(chainJson);
    const cg = this.provenance.captureGrade(captureSha) || {};
    const authored = !(cg.determined && cg.grade) && AUTHORED_ROUTE_BASES.includes(cg.basis);
    const byteGrade = cg.determined && cg.grade ? cg.grade : authored ? (cg.ceiling || EARNED_CAPTURE_CEILING) : null;
    return { byteGrade, authoredRoute: authored ? cg.basis : null,
             authoredVia: authored ? (cg.basis === "CAPTURE_ROUTE_UNRECORDED" ? "unrecorded" : cg.route) : null,
             transcribed: isTranscribed(chain),
             bound: byteGrade == null ? null : captureBound(chain, byteGrade) };
  }

  /* R15 (D21; D4): a content row cited as text whose chain holds an `ai_transcription` step covering the row's
     extent (text-chain R104: a page step covering its page; any such step for a row with no page) is a passage of an AI
     transcription. Its capture axis is answered at the passage's grain, replacing content's pointer to the document:
     UNDETERMINED (what a model read off a picture is graded undetermined until its accuracy is measured), except where
     a member attested the text against the page over an extent covering the row (`content.attestText`, made against
     the row's own chain: content's standing answers `determinant: "attestation"`), where it is the capture's own grade,
     from how its bytes came in (`#captureLetter` with no chain): an authored route stated as authored, an unruled one
     undetermined. Every other row is left as content answers it. */
  #aiPassageCeiling(st) {
    if (!st || st.cited_as === "bytes" || !Array.isArray(st.chain)) return;
    const page = st.extent && Number.isInteger(st.extent.page) ? st.extent.page : null;
    const ai = st.chain.some((x) => x && x.step === "ai_transcription" && (page == null || stepCovers(x, page)));
    if (!ai) return;
    const ref = st.ref || describeExtent(st.extent);
    const base = { grain: "passage", mode: "ceiling", capture_sha: st.capture_sha };
    const attested = st.transcription && st.transcription.determinant === "attestation";
    if (!attested) {
      st.capture = { ...base, grade: null, determined: false, undetermined_because: "CAPTURE_FIDELITY_UNMEASURED",
        empty_level: localize("leg-earning.index.passage_ai_reading_member_check", "a member's check — this passage's text is the AI's reading of the page, graded undetermined until its accuracy is measured or a member checks it against the page"),
        why: localize("leg-earning.index.ref_of_bundle_id_was", "{ref} of {bundle_id} was read off the page by an AI, and that reading is graded undetermined until its accuracy is measured, so what a leg resting on this passage may claim about how it was captured is undetermined. A member who checks the passage against the page (op=attesttext) gives it the capture's own grade. A leg may state NO capture grade; it may not state a letter.", { ref: String(ref), bundle_id: String(st.bundle_id) }) };
      return;
    }
    const by = Array.isArray(st.transcription.by) ? st.transcription.by : [];
    const l = this.#captureLetter(st.capture_sha, null);
    if (l.byteGrade == null) {
      st.capture = { ...base, grade: null, determined: false, undetermined_because: "CAPTURE_GRADE_VIA_UNRULED", by,
        why: word("leg-earning.why.read_off_page", { ref: String(ref), bundle_id: String(st.bundle_id) }) };
      return;
    }
    st.capture = { ...base, grade: l.byteGrade, determined: true, determinant: "attestation", by,
      ...(l.authoredRoute ? { stated_as: "authored", route_basis: [l.authoredRoute] } : {}),
      why: word("leg-earning.why.read_off_page_ai", { passage: String(ref), capture: String(st.bundle_id), attestor: String(by.join(", ") || "a member"), grade: String(l.byteGrade), rest: String(l.authoredRoute ? ` — the letter its author may give under the ceiling, stated as authored and never `
                            + `as measured (${authoredRouteWords([l.authoredVia])}).` : ".") }) };
  }

  /* R8, R9: the entries a held standard and a duty occurrence earn, added to `out` (an `occurrence` map only when an
     occurrence was asked about, on the `testimony` map's rule: every other caller's answer is unchanged). */
  #earnHeld(out, standardIds, occurrenceIds) {
    for (const id of standardIds) out.earned.capture[id] = this.#standardCeiling(id);
    if (occurrenceIds.length) {
      out.earned.occurrence = {};
      for (const ref of occurrenceIds) out.earned.occurrence[ref] = this.#occurrenceDerivation(ref);
    }
    return out;
  }

  /** R8 (K1447 (iii)): what a leg on a held standard may claim on the capture axis — the ceiling of the capture holding
   *  the standard's text at the version the leg cites (the `STD-` id is that version, `standards` R18), by R1's rule
   *  for one capture (`#captureLetter`). A standard whose text spans several captures earns the WEAKEST of them, since
   *  a leg on it rests on all of its text; any capture undetermined makes the standard undetermined, naming why. No
   *  connection grade (the entry is on the capture axis alone, `axis: "capture"`); `mode: "ceiling"`, so R2's
   *  `legCapped` caps a stated capture letter to it and refuses any against an undetermined one. A standard holding no
   *  captured text answers undetermined with `STANDARD_NO_TEXT`'s reason; one the record does not hold, undetermined
   *  with `NO_SUCH_STANDARD`. Never throws. */
  #standardCeiling(id) {
    const ceiling = word("leg-earning.ceiling.grade_reachable_capture", { unreachable_capture_grade: String(UNREACHABLE_CAPTURE_GRADE) });
    const undetermined = (because, why, extra = {}) => ({ mode: "ceiling", axis: "capture", standard: id, grade: null,
      determined: false, undetermined_because: because, why, ...extra, ceiling });
    let read;
    try { read = this.standards.standardRead({ id, viewer: SYSTEM_READER }); } catch { read = null; }
    if (!read || read.ok !== true)
      return undetermined("NO_SUCH_STANDARD", localize("leg-earning.index.the_record_holds_no_standard", "the record holds no standard {id}, so what a leg resting on it may claim about how its text was captured is undetermined. A leg may state NO capture grade; it may not state a letter.", { id: String(id) }));
    const noText = () => {
      const row = STANDARDS_CHECKS && STANDARDS_CHECKS.STANDARD_NO_TEXT;
      return undetermined("STANDARD_NO_TEXT", localize("leg-earning.index.id_holds_no_captured_text", "{id} holds no captured text at this version, so nothing bounds what a leg resting on it may claim on the capture axis: undetermined. A leg may state NO capture grade; it may not state a letter.", { id: String(id) }), row ? { check: row.check, translation: row.translation } : {});
    };
    const caps = [...new Set((Array.isArray(read.text) ? read.text : [])
      .map((cid) => { try { return this.content.contentRow(cid); } catch { return null; } })
      .map((r) => (r && typeof r.capture_sha === "string" && r.capture_sha ? r.capture_sha : null)).filter(Boolean))];
    if (!caps.length) return noText();
    const rows = this.#rows(
      `SELECT c.value AS capture_sha, ts.chain AS chain,
              (SELECT ra.authored FROM register ra WHERE ra.capture_sha = c.value) AS authored
         FROM json_each(?) c LEFT JOIN reading_text_source ts ON ts.capture_sha = c.value`, JSON.stringify(caps));
    let weakest = null, bounded = null;
    for (const r of rows) {
      if (r.authored === 1)
        return undetermined("CAPTURE_AXIS_AUTHORED", localize("leg-earning.index.id_s_text_is_held", "{id}'s text is held in a member's authored words, which nobody read in from anywhere: the capture axis does not apply to it, and a leg may state no letter on it.", { id: String(id) }),
          { captures: caps.length });
      const l = this.#captureLetter(r.capture_sha, r.chain);
      if (l.byteGrade == null)
        return undetermined("CAPTURE_GRADE_VIA_UNRULED", localize("leg-earning.index.id_s_text_is_held_2", "{id}'s text is held in a capture served by a route no ruling grades, so what a leg resting on it may claim about how it was captured is undetermined.", { id: String(id) }),
          { captures: caps.length });
      if (l.bound == null)
        return undetermined("CAPTURE_FIDELITY_UNMEASURED", localize("leg-earning.index.id_s_text_was_derived", "{id}'s text was derived by a machine and no step in that derivation carries a measured fidelity, so what a leg resting on it may claim about how it was captured is undetermined (DEC-4).", { id: String(id) }), { captures: caps.length });
      if (weakest == null || BASIS_GRADES.indexOf(l.bound) > BASIS_GRADES.indexOf(weakest)) {
        weakest = l.bound;
        bounded = l.bound === EARNED_CAPTURE_CEILING ? null
          : l.transcribed && l.bound !== l.byteGrade ? "CAPTURE_BOUNDED_BY_FIDELITY" : "CAPTURE_BOUNDED_BY_ROUTE";
      }
    }
    return { mode: "ceiling", axis: "capture", standard: id, grade: weakest, captures: caps.length,
             ...(bounded ? { bounded_by: bounded } : {}),
             why: word("leg-earning.why.text_held_capture", { id: String(id), caps: String(caps.length), weakest: String(weakest) }),
             ceiling };
  }

  /** R9 (K1447 (i)): what the record derives for a leg on a duty occurrence (`inquiry-grammar` R15's reference
   *  `occurrence:<DUT id>/<key>`): the occurrence's derivation as `duties.occurrencesOf` states it (the source in force,
   *  the trigger date, the due date and the level searched), its state and why, and NO grade of its own (`grade: null`,
   *  `mode: "derived"`): the leg's grade is `strength`'s to derive (T33-47), and R2's `legCapped` answers null against
   *  it. Read as of the module's clock, over `duties`' own window, as a machine credential (the registry gates
   *  nothing, R1). A duty the record does not hold, an occurrence the duty does not derive in that window, and an occurrence
   *  `duties` answers undetermined are each answered `determined: false` with the reason. Never throws. */
  #occurrenceDerivation(ref) {
    const parsed = parseOccurrenceRef(ref) || {};
    const base = { mode: "derived", grade: null, duty: parsed.duty ?? null, key: parsed.key ?? null };
    const undetermined = (because, why, extra = {}) => ({ ...base, determined: false, undetermined_because: because,
                                                          why, ...extra });
    let r;
    try { r = this.duties.occurrencesOf({ dutyId: parsed.duty, asOf: this.#when(), viewer: SYSTEM_READER }); }
    catch (e) { r = { ok: false, reason: "DUTIES_UNREADABLE", detail: String(e && e.message || e).slice(0, 200) }; }
    if (!r || r.ok !== true)
      return undetermined(r && r.reason ? r.reason : "NO_SUCH_DUTY", localize("leg-earning.index.the_record_could_not_derive", "the record could not derive {ref}: {v1}. Its derivation is undetermined.", { ref: String(ref), v1: String((r && (r.detail || r.reason)) || "duties answered nothing") }));
    const occ = (Array.isArray(r.occurrences) ? r.occurrences : []).find((o) => o && o.key === parsed.key);
    if (!occ)
      return undetermined("OCCURRENCE_NOT_DERIVED", localize("leg-earning.index.duty_derives_no_occurrence_key", "{duty} derives no occurrence {key} between {from} and {to} as of {as_of}, so this leg's derivation is undetermined{v1}.", { duty: String(parsed.duty), key: String(parsed.key), from: String(r.from), to: String(r.to), as_of: String(r.as_of), v1: String(Array.isArray(r.source_errors) && r.source_errors.length ? " (a source of its triggers could not be read whole)" : "") }),
        { as_of: r.as_of });
    const derived = { ...base, derivation: occ.derivation ?? null, state: occ.state ?? null, as_of: r.as_of,
                      trigger: occ.trigger ?? null, due: occ.due ?? null };
    if (occ.state === "undetermined")
      return { ...derived, determined: false, undetermined_because: "OCCURRENCE_UNDETERMINED",
               why: word("leg-earning.why.duties_answers_undetermined", { ref: String(ref), why: String(occ.why) }) };
    return { ...derived, determined: true,
             why: word("leg-earning.why.derived_duties_leg", { ref: String(ref), as_of: String(r.as_of), state: String(occ.state), why: String(occ.why) }) };
  }

  /* The registry as the WRITE PATH and the GATE need it: the subject this
     document declares, over the targets this document's basis names. Takes the
     frontmatter because at promote time the bytes are the only authority — the
     projection column is written from them a few lines later. */
  earnedForDoc(fm, legs) {
    const subject = fm && typeof fm.subject_entity === "string" && fm.subject_entity
      ? fm.subject_entity : null;
    return this.earned(subject,
      (Array.isArray(legs) ? legs : []).map((l) => l && l.target).filter((t) => typeof t === "string"));
  }

  /* REC-11 / R6 (was inquiry R11's and R29's walk): would writing edges bundleId -> each of `targets` close a
   * cycle in the basis graph? The graph is the inquiry-typed rows of
   * inquiry_basis; by induction every prior write kept it acyclic, so a cycle
   * through the NEW edges exists iff bundleId is reachable FROM one of the
   * targets along stored edges. Depth-first with a visited set, so the walk is
   * bounded by the store's edge count and needs no depth bound here (REC-12's
   * read-time walk carries one because IT must answer under a budget; a write
   * guard over an acyclic store terminates by construction). bundleId's own
   * outgoing edges are irrelevant: this promotion REPLACES them, and the walk
   * stops the moment it reaches bundleId anyway.
   *
   * Returns the full cycle path [bundleId, target, ..., bundleId] for the
   * refusal to name, or null. */
  cyclePath(bundleId, targets) {
    for (const t of targets) {
      const path = [bundleId, t];
      const found = this.#basisReach(t, bundleId, new Set([t]), path);
      if (found) return found;
    }
    return null;
  }
  #basisReach(from, goal, seen, path) {
    const next = this.#rows(
      `SELECT target_id FROM inquiry_basis WHERE bundle_id=? AND target_type='inquiry' ORDER BY ord`, from);
    for (const r of next) {
      if (r.target_id === goal) return [...path, goal];
      if (seen.has(r.target_id)) continue;
      seen.add(r.target_id);
      const found = this.#basisReach(r.target_id, goal, seen, [...path, r.target_id]);
      if (found) return found;
    }
    return null;
  }

  /* REC-11: read a bundle's basis legs back, in document order — the ord that
     makes a leg addressable. A read of the PROJECTION; bundle.md stays the
     authority. */
  /* R4 (B4, STRENGTH #1): `limit`, a positive integer, bounds the read in SQL (at most `limit` legs, the first by
     ord, `truncated` measured by reading one more); without it the basis is read whole, as a walk over it needs. */
  basisFor(bundleId, { limit = null } = {}) {
    if (!bundleId) return { ok: false, reason: "NO_ID", detail: "basis requires ?id=" };
    const cols = `ord, target_id, target_type, role, grade, grade_axis, grade_source, note, at, ground`;
    if (Number.isInteger(limit) && limit > 0) {
      const rows = this.#rows(`SELECT ${cols} FROM inquiry_basis WHERE bundle_id=? ORDER BY ord LIMIT ?`, bundleId, limit + 1);
      return { ok: true, bundleId, legs: rows.slice(0, limit), limit, truncated: rows.length > limit };
    }
    const legs = this.#rows(`SELECT ${cols} FROM inquiry_basis WHERE bundle_id=? ORDER BY ord`, bundleId);
    return { ok: true, bundleId, legs };
  }

  /* REC-11: "which inquiries rest on this document" — E2's question and
     REC-17's re-evaluation obligation — as ONE indexed lookup on
     inquiry_basis_target, never a graph walk. Answers for an INFO- target and
     for an INQ- target alike, because a leg to an inquiry is the same edge. */
  restingOn(targetId) {
    if (!targetId) return { ok: false, reason: "NO_ID", detail: "restson requires ?id=" };
    /* D-280, site (d) — `#restsOnLive`'s UNCONFIRMED TWIN. `inquiry_basis` is a
       projection of `references[]` that drops the STATUS, so this read could
       not tell a leg somebody still rests on from one they recorded the
       decision to withdraw. IT PUBLISHES THE STATUS RATHER THAN FILTERING ON
       IT, which is `op=backlinks`' posture and deliberately NOT `#restsOnLive`'s:
       this is the projection read back — "which inquiries name this document as
       a leg" — and a withdrawn leg is a fact the record keeps. Dropping rows
       here would make a READ disagree with the table it reads, and a caller
       that wants the live set has `#restsOnLive`'s ops. Additive: no row and no
       field is removed (IC-61). */
    const own = new Map();
    const dependents = this.#rows(
      `SELECT bundle_id, ord, role, grade, grade_axis, grade_source
       FROM inquiry_basis WHERE target_id=? ORDER BY bundle_id, ord`, targetId)
      .map((d) => ({ ...d,
        status: this.#legSevered(d.bundle_id, d.ord, targetId, own) ? "severed" : "confirmed" }));
    return { ok: true, targetId, dependents };
  }


  /** REC-220 — WHICH VERSION EACH LEG RESTS ON, AND WHETHER THE RECORD CAN SAY (Bob, 2026-09-25 00:40Z,
   *  rule 1). Sets `version` on every leg onto a DOCUMENT, in place, from the leg's own BYTES:
   *
   *    `pinned`        the bytes name the capture — `extent_capture` (written by op=cite at the act since
   *                    REC-220, or by op=narrow, or by the author) or a `content_id` (a hash over its
   *                    capture). `by` says which. This is a fact the record holds.
   *    `only_capture`  no pin, and the record holds exactly ONE capture of the document: there is only one
   *                    version the leg can rest on.
   *    `undetermined`  no pin, and the record holds SEVERAL captures. The leg's content row is about the
   *                    capture the resolver answered when the question was first projected, carried
   *                    forward since in a DERIVED table (REC-82) — not a record of which bytes the member
   *                    read. That row's capture is named as `resolved_capture`, and it is never back-filled
   *                    into the leg by guess.
   *
   *  A leg onto a question (no bytes, DEC-21) or one whose document the record holds no capture of gets
   *  no `version`; its `null_case` already says which. TWO set-based reads, never one per leg (the
   *  derivation-bounds class): the document's bytes once, one grouped count per CHUNK of targets, one content read per chunk of ids. */
  #legVersions(id, legs) {
    const docs = legs.filter((l) => normalizeType(l.target_type) === "information");
    if (!docs.length) return;
    const md = this.#one(`SELECT content FROM files WHERE bundle_id=? AND path='bundle.md'`, id);
    const bytesLegs = md && md.content !== null ? (parseFrontmatter(md.content).data?.basis || []) : [];
    /* CHUNKED under D-36's ~100-variable ceiling (`ID_CHUNK`): the count names
       each chunk TWICE (both halves of the union), so it takes half a chunk at a time. */
    const targets = [...new Set(docs.map((l) => l.target))];
    const held = new Map();
    const half = Math.floor(ID_CHUNK / 2);
    for (let i = 0; i < targets.length; i += half) {
      const part = targets.slice(i, i + half), qs = part.map(() => "?").join(",");
      for (const r of this.#rows(
        `SELECT bundle_id AS t, COUNT(DISTINCT capture_sha) AS n FROM (
           SELECT bundle_id, capture_sha FROM register WHERE bundle_id IN (${qs})
           UNION ALL
           SELECT bundle_id, capture_sha FROM readings WHERE bundle_id IN (${qs}))
         GROUP BY bundle_id`, ...part, ...part)) held.set(r.t, r.n);
    }
    const cids = [...new Set(docs.map((l) => l.content_id).filter(Boolean))];
    const capOf = new Map();
    for (let i = 0; i < cids.length; i += ID_CHUNK) {
      const part = cids.slice(i, i + ID_CHUNK);
      for (const r of this.#rows(
        `SELECT content_id, capture_sha FROM content WHERE content_id IN (${part.map(() => "?").join(",")})`,
        ...part)) capOf.set(r.content_id, r.capture_sha);
    }
    for (const l of docs) {
      const n = held.get(l.target) || 0;
      if (!n) continue;
      const bl = bytesLegs[l.ord] && typeof bytesLegs[l.ord] === "object" && bytesLegs[l.ord].target === l.target
        ? bytesLegs[l.ord] : {};
      const cap = l.content_id ? capOf.get(l.content_id) ?? null : null;
      const pin = typeof bl.extent_capture === "string" && bl.extent_capture.trim() ? "extent_capture"
                : legContentId(bl) ? "content_id" : null;
      l.version = pin ? { state: "pinned", by: pin, capture: cap }
                : n === 1 ? { state: "only_capture", capture: cap }
                : { state: "undetermined", resolved_capture: cap, captures_held: n,
                    detail: localize("leg-earning.index.the_record_holds_n_captures", "the record holds {n} captures of {target} and this leg's bytes name none of them, so which version it was made against is undetermined. The capture named is the one the record resolved when this question was first projected; it is not a record of what the member read, and nothing here moves it", { n: String(n), target: String(l.target) }) };
    }
  }

  /* R3: the subject entity an inquiry's own document declares (`subject_entity`, trimmed), or null for none or an
     unreadable document; never throws. */
  #subjectOf(id) {
    try {
      const md = this.record.readFile(id, "bundle.md");
      const fm = md && typeof md.text === "string" ? parseFrontmatter(md.text).data : null;
      const s = fm && typeof fm.subject_entity === "string" ? fm.subject_entity.trim() : "";
      return s || null;
    } catch { return null; }
  }

  /** R3, R11: the earned registry over an inquiry's legs as `viewer` may read it, each document leg with its content
   *  row (backfilled, bounded) and which capture it rests on. */
  earnedBasis({ id, targets = null, viewer = null } = {}) {
    if (!id) return { ok: false, reason: "NO_ID", detail: "earnedbasis requires ?id=<inquiry>" };
    if (!this.membership.inSight(id, viewer)) return { ok: false, reason: "NO_SUCH_BUNDLE", target: id };
    const b = this.#one(`SELECT object_type FROM bundles WHERE bundle_id=?`, id);
    if (!b) return { ok: false, reason: "NO_SUCH_BUNDLE", target: id };
    if (normalizeType(b.object_type) !== "inquiry")
      return { ok: false, reason: "NOT_AN_INQUIRY", target: id,
               detail: localize("leg-earning.index.id_is_a_normalizetype_an", "{id} is a {normalizeType}. An earned basis grade is a fact about an INQUIRY's legs — what each candidate target earns against the question's subject — and only an inquiry has a basis.", { id: String(id), normalizeType: String(normalizeType(b.object_type)) }) };
    const asked = targets
      ? String(targets).split(",").map((s) => s.trim()).filter(Boolean).slice(0, EARNED_TARGETS_MAX)
      : this.#rows(`SELECT DISTINCT target_id FROM inquiry_basis WHERE bundle_id=? ORDER BY target_id`, id)
          .map((r) => r.target_id);
    /* R3 (N522): a leg on an imported finding reference is a line of the question's own document, which the viewer
       sees (checked above); it is no bundle for the gate to ask, and it earns nothing here. */
    const sees = (t) => isImportedRef(t) || this.membership.inSight(t, viewer);
    const visible = asked.filter(sees);
    const withheld = visible.length !== asked.length;
    /* ================= REC-83 / IC-84 (3) · THE LEG PASS ==================
     *
     * The registry above answers per DOCUMENT, which is the question a member
     * asks BEFORE writing a leg ("what would this target earn me?"). This pass
     * answers the other question, which only exists now that a leg can name a
     * PART: what does the leg I ALREADY WROTE earn, given the extent it names?
     *
     * IT RUNS EVEN WHEN `targets` WAS GIVEN, because the legs are a fact about
     * the inquiry and not about the caller's list — a surface filling in a new
     * leg still wants to see what the existing ones stand on.
     *
     * THE READ IS NOT CAPPED, AND THAT IS A DECISION RATHER THAN A DEFAULT
     * (found when a first draft capped it at `CONTENT_EARNED_MAX`). This read is
     * over exactly the population the `asked` read three lines up already
     * enumerates UNCAPPED: the same table, the same bundle, one row per leg.
     * Capping one and not the other would publish two different populations in
     * one answer and silently omit legs whose targets are listed — the drift
     * this method's own comments warn about, installed by a bound nobody asked
     * for. A basis is bounded by what a member authored in one document, and the
     * answer says so by listing it whole. What IS bounded is the BACKFILL below,
     * because it WRITES; nothing inside a loop over these rows reads or writes
     * the store but through it.
     *
     * D-15, THE SAME POSTURE ONE OBJECT DOWN: a leg whose target the viewer may
     * not see is DROPPED, and the fact that something was dropped is stated with
     * no id and no count — op=backlinks' posture, which this op already takes
     * for `asked`. */
    const legRows = this.#rows(
      `SELECT ord, target_id, target_type, content_id FROM inquiry_basis
        WHERE bundle_id=? ORDER BY ord`, id);
    const legsVisible = legRows.filter((l) => sees(l.target_id));
    const legsWithheld = legsVisible.length !== legRows.length;
    const legs = legsVisible.map((l) => ({ ord: l.ord, target: l.target_id,
                                           target_type: l.target_type, content_id: l.content_id }));
    /* IC-84 (4): THE BACKFILL, WIRED HERE AND NOWHERE ELSE.
     *
     * A READ THAT WRITES, DELIBERATELY AND DECLARED. `op=earnedbasis` is
     * `mutating: false` in op-declarations' table of ops and stays so, and the reason is not
     * convenience — the old plane `index.mjs`'s doctrine was that *"a mutating
     * arm hiding inside a non-mutating op would pass the gate that exists to stop
     * exactly that"*, and op-declarations holds that gate now. This is not that arm. Nothing here is an ACT: the row minted is
     * `hash(capture, canonical extent, chain)` over rows the record already
     * holds, so its value is fixed before this call and running it twice, in
     * two sessions, or after a replay produces the same id. It changes no state
     * a caller could have caused differently and grants nobody anything —
     * which is why IC-83 could rule *"a legacy leg is backfilled to its
     * `document` row on first read"* in the first place. Flipping the op to
     * `mutating: true` would be the alternative and it is WORSE than the
     * problem: SESSION_OPS (op-declarations') would then gate a read the shipped composer already
     * calls, an undeclared interface change on I3 wearing the costume of
     * caution. THE REVERSAL, if this reading is rejected, is one line — delete
     * this call and let `op=promote`'s projection mint the row at the leg's
     * next promotion, which it already does, through R12's write. */
    const backfill = this.#backfillLegContent(id, legs);
    /* The subject the question's own document declares, as inquiry's projection records it (trimmed, none when
       empty): read from the bytes, which are the authority, and not from inquiry's later table (P4). */
    const reg = this.earned(this.#subjectOf(id), visible,
      legs.map((l) => l.content_id).filter(Boolean));
    /* THE TWO LEGITIMATE NULLS, STATED AS WHICH AND NEVER COLLAPSED (IC-83's
       AMENDMENT 2). A leg whose target is an INQUIRY has no capture and no part
       to point at (DEC-21); a leg whose target information object this record
       holds no bytes of has nothing to address. Both are `content_id: NULL` and
       they are DIFFERENT FACTS — one is about what kind of thing was cited, the
       other about what this record has captured — so the discriminator comes
       from `ensureLegContent`, which is where the distinction is decided, and
       is carried here rather than re-derived. A leg still NULL with no case
       named is one the bound above did not reach, and that is said too. */
    this.#legVersions(id, legs);
    for (const l of legs) {
      if (l.content_id) continue;
      if (!l.null_case && !l.why_no_content) {
        l.null_case = "NOT_YET_RESOLVED";
        l.why_no_content = word("leg-earning.why_no_content", { leg_backfill_max: String(LEG_BACKFILL_MAX) });
      }
    }
    return { ok: true, bundleId: id, ...reg, asked: visible,
             legs,
             /* The bound, published rather than left to be inferred from a
                short list — REC-60's rule about an answer that was cut. */
             ...(backfill.truncated ? { backfill_truncated: true } : {}),
             ...(legsWithheld ? { legs_out_of_view: true } : {}),
             /* Stated, never silently shortened — and with no id and no count,
                because the count IS the leak (op=backlinks' posture). */
             ...(withheld ? { out_of_view: true } : {}),
             detail: reg.subject_entity
               ? localize("leg-earning.index.id_names_subject_entity_v1", "{id} names {subject_entity}{v1} as its subject. A target listed under earned.connection may be written as a leg with grade_source: resolution AT THAT GRADE and no other; one listed under earned.capture may be written with grade_source: capture at that grade. A target absent from a list earns nothing on that axis — the honest leg is testimony (grade D, with an author and a date) or no grade at all, which suspends the axis and names the leg rather than pretending to a number.", { id: String(id), subject_entity: String(reg.subject_entity), v1: String(reg.subject_label ? ` (${reg.subject_label})` : "") })
               : localize("leg-earning.index.id_names_no_subject_entity", "{id} names NO subject entity, so no leg of it earns an A/B/C connection grade. That is a stated position, not a defect (DEC-15): the capture axis still earns from the capture record, and a connection a member can account for is testimony at grade D.", { id: String(id) }) };
  }

}

const instances = new WeakMap();

/** The one leg-earning instance for `host` (the Durable Object's `ctx`); `deps` are read on the first call only. At
 *  creation the table exists (R12) and is declared to record-core. */
export function legEarningOf(host, deps) {
  let k = instances.get(host);
  if (!k) {
    const d = deps || {};
    const record = d.record || recordOf(host);
    const membership = d.membership || membershipOf(host, { record });
    const promotion = d.promotion || promotionOf(host, { record, membership });
    const content = d.content || contentOf(host, { record, membership });
    k = new LegEarning({ ...d, host, storage: d.storage || host.storage, record, membership, promotion, content });
    instances.set(host, k);
    if (typeof record.declareTable === "function")
      record.declareTable("leg-earning", LEG_EARNING_TABLES.map((t) => ({ ...t, keys: [...t.keys] })));
  }
  return k;
}

/** Which declaration names this module's table (record-core R21: each owner declares its own). */
export function legEarningOwns(t) {
  const name = typeof t === "string" ? t : t && t.name;
  return LEG_EARNING_TABLES.some((x) => x.name === name);
}

/* The Durable Object routes this module answers (K3), as entries of plane's op map, for `plane` to take when `inquiry`'s
   job (T33-45) re-points them here. `url` carries the control plane's stamps (`viewer`). R4: `basis` and `restson` are
   in-process reads the control plane routes to no member; R3's `earnedbasis` is gated by the viewer. */
export function legEarningOps(k, url) {
  const q = (key) => url.searchParams.get(key);
  return {
    basis: () => k.basisFor(q("id")),
    restson: () => k.restingOn(q("id")),
    earnedbasis: () => k.earnedBasis({ id: q("id"), targets: q("targets"), viewer: q("viewer") }),
  };
}
