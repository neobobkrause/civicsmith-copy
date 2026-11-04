/* case-tensions — what a case says about the record after it is signed, and how a member's words are credited in it
 * (requirements: `build/requirements/case-tensions.md`; BIO_Publication_v0_1.md §3 rule 7, §4, §7;
 * MEMBER-KNOWLEDGE-DESIGN.md §4): which case editions a finding serves (R1), the flags raised when a pinned finding is
 * revised and their discharge (R2, R3), the tensions found after publication (R4), and the attribution level each
 * member chooses for their observation, or attested capture, in a case edition (R5–R7). `publication` calls it inside
 * its own acts; `queue-producers`, `review` and `ratification` read it.
 *
 * Split from `publication` by copy (K617, K1505; T33-62), no requirement changing meaning: `caseTensions`,
 * `caseRelation`, `flagCasesOnRevision`, `dischargeCaseFlags`, `caseFlags`, the attribution reads and act, with their
 * comments; the C-92 rows (`./checks.mjs`); the three tables they write (`./schema.mjs`). `publication`'s deletion job
 * (T33-63) deletes its copy, creates this module from its factory and registers the provider below.
 *
 * THE SEAM (K1505 (3), K31's pattern; `publication` R61). This module sits before `publication` (P4), whose tables
 * (`cases`, `published_case_members`, `published_cases`, `case_documents`) and splice (its R21, `reauthorSection`) the
 * moved code reads. It reaches them only through one provider `publication` registers at start
 * (`registerPublicationProvider`), whose doors answer exactly the rows the code read before the split:
 *   pins(bundleId, sha)              the roster rows pinning that sha: `[{case_id, edition, version_sha, role,
 *                                    project_id}]` by case and edition (R1, R2)
 *   preparations(bundleId)           the unsigned case documents whose text names it as a list entry: `[{case_id,
 *                                    edition, text, ratified}]`, `ratified` whether that case edition is (R1)
 *   caseDocument(caseId, edition)    `{case_id, edition, doc_sha, text, signed, project_id}` or null, as the plane (R4–R7)
 *   members(caseId, edition)         the edition's roster `[{bundle_id, version_sha}]` by its order (R4)
 *   latestRatified({project, after, limit})   each case's latest ratified edition `[{case_id, edition, project_id}]`,
 *                                    owned by `project` when given, in case id order after `after` (R4)
 *   signedDocumentsNaming(text, limit)   the ratified case documents whose text holds `text`: `[{text}]` (R5)
 *   reauthorSection(args)            `publication` R21's splice (R5, R7)
 * With no provider, R1 and R4 answer undetermined, R2 raises nothing, and R5/R7 refuse before writing.
 *
 * REACHED as `caseTensionsOf(host, deps)` (K61, K1563 (1)): one instance per host, created on the first call with
 * `deps`, returned to every later caller. At creation it creates its tables and declares them to record-core (R10),
 * registers with promotion the fact `caseMember` (R1) and its step's projection, the revision flag (R2).
 * `deps` (each reached through its factory on the same host unless given; a test passes its own):
 *   record, membership, promotion   layer 2: `head`, `readFile`, `declareTable`; `memberFacts`, `projectOwners`;
 *                                   `registerStep`, `registerFact`, the fact `producingGroup`.
 *   basisVersions  `testimonyReach` (R5's reach).
 *   contradiction  `unresolvedRecordOn` (its R29), for R4.
 *   capture        `captureAccountsOf` (R7's attesting member).
 *   now            the clock for the instants it writes when the caller gives none, an ISO string.
 *
 * READ CONTRACTS it joins in its own SQL: provenance's `register` (R5's author). */

import { recordOf, stampInstant } from "../record-core/index.mjs";
import { membershipOf } from "../membership/index.mjs";
import { promotionOf } from "../promotion/index.mjs";
import { basisVersionsOf } from "../basis-versions/index.mjs";
import { contradictionOf } from "../contradiction/index.mjs";
import { captureOf } from "../capture/index.mjs";
import { observerRef } from "../provenance/index.mjs";
import { parseFrontmatter, isMachineIdentity } from "../record-grammar/index.mjs";
import { disclosedCandidates, caseDocumentBlocks, SECTIONS, ATTRIBUTION_LEVELS, attributionFrontmatterLines,
         attributionBodyLines, materialsOf, materialAttestationLines } from "../case-grammar/index.mjs";
import { ATTRIBUTION_ACT_CHECKS } from "./checks.mjs";
import { CASE_TENSIONS_TABLES, migrateCaseTensions } from "./schema.mjs";
import { word, localize } from "../setup-words/index.mjs";

export { ATTRIBUTION_ACT_CHECKS, rowOf } from "./checks.mjs";
export { CASE_TENSIONS_SCHEMA, CASE_TENSIONS_TABLES, migrateCaseTensions } from "./schema.mjs";

/* CASE-4 / DEC-72 / REC-60: the page size for `op=caseflags` (R3). A CHOSEN CONSTANT and never a finding — the flag
   table grows with every revision of every published member and has no natural ceiling, so the read publishes `limit`
   and `truncated` beside its answer rather than scanning whatever is there. */
export const CASE_FLAGS_LIMIT = 500;
/** R5 (DEC-88, K1030): the longest reason an attribution choice keeps, in code points; a longer one is refused. */
export const ATTRIBUTION_REASON_MAX = 2000;
/** R4: the cases one `caseTensions` page answers, its default and its ceiling. */
export const CASE_TENSIONS_MAX = 200;
/** R5: the ratified documents one `attributionStatedFor` reads. */
export const STATED_FOR_DOCS = 50;

/* The provider's doors (`publication` R61, K1505 (3)). */
export const PUBLICATION_DOORS = Object.freeze(["pins", "preparations", "caseDocument", "members", "latestRatified",
                                                "signedDocumentsNaming", "reauthorSection"]);

/* A caller's page size: a whole number of rows, floored, clamped to 1–max, the default when absent or not a number. */
const pageOf = (limit, max) => Math.max(1, Math.min(Math.floor(Number(limit)) || max, max));
const HEX64 = /^[0-9a-f]{64}$/;
const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");
const NO_PROVIDER = localize("case-tensions.index.no_module_has_registered", "no module has registered the publication provider, so this module reads no case");

export class CaseTensions {
  #deps;
  #provider = null;   // {module, ...doors}, filled once (K1505 (3))
  purgeDeclaration = null;   // R10: record-core's answer to this module's declaration, set at creation

  constructor({ storage, record, membership, promotion, host = null, basisVersions = null, contradiction = null,
                capture = null, now = null } = {}) {
    this.sql = storage.sql;
    this.record = record;
    this.membership = membership;
    this.promotion = promotion;
    this.#deps = { host, basisVersions, contradiction, capture };
    this.now = typeof now === "function" ? now : () => new Date().toISOString();
  }

  /* The modules reached lazily: each is created on the same host on first use, unless a test passed its own. */
  get basisVersions() { return this.#deps.basisVersions ||= basisVersionsOf(this.#deps.host); }
  get contradiction() { return this.#deps.contradiction ||= contradictionOf(this.#deps.host); }
  get capture() { return this.#deps.capture ||= captureOf(this.#deps.host, { record: this.record }); }

  migrate() { migrateCaseTensions(this.sql); }

  #rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  #one(q, ...a) { for (const r of this.sql.exec(q, ...a)) return r; return null; }

  /* A held bundle's current `bundle_sha`, from record-core, or null. */
  #headSha(bundleId) {
    let h = null;
    try { h = this.record.head(bundleId); } catch { h = null; }
    return h && typeof h.bundleSha === "string" ? h.bundleSha : null;
  }

  /* A live file's inline text as `{content}` (record-core R13), or null when it is not held inline. */
  #fileText(bundleId, path) {
    let f = null;
    try { f = this.record.readFile(bundleId, path); } catch { f = null; }
    return f && typeof f.text === "string" ? { content: f.text } : null;
  }

  /* The instance's producing group, promotion's fact (instance-setup provides it); null when
     no module provides it, which the attribution prose states rather than filling. */
  #producingGroup() {
    const f = this.promotion.fact("producingGroup");
    return f && f.ok ? f.value ?? null : null;
  }

  /* ---------------------------------------------------------------- the seam: publication's provider */

  /** K1505 (3), `publication` R61: `publication` fills, once at start, the doors this module reads its tables and splice
   *  through (`PUBLICATION_DOORS`). Called as `registerPublicationProvider(provider)` or
   *  `registerPublicationProvider(module, provider)`. A second registration is refused `PROVIDER_DECLARED`; one missing
   *  a door `PROVIDER_MALFORMED`. */
  registerPublicationProvider(moduleOrProvider, maybeProvider = undefined) {
    const provider = typeof moduleOrProvider === "string" ? maybeProvider : moduleOrProvider;
    const module = typeof moduleOrProvider === "string" ? str(moduleOrProvider)
                 : str(provider && provider.module) || "unnamed";
    if (!provider || typeof provider !== "object" || !PUBLICATION_DOORS.every((d) => typeof provider[d] === "function"))
      return { ok: false, reason: "PROVIDER_MALFORMED",
               detail: localize("case-tensions.index.the_publication_provider_gives_the", "the publication provider gives the doors {PUBLICATION_DOORS}", { PUBLICATION_DOORS: String(PUBLICATION_DOORS.join(", ")) }) };
    if (this.#provider)
      return { ok: false, reason: "PROVIDER_DECLARED", module: this.#provider.module,
               detail: localize("case-tensions.index.the_publication_provider_is_already", "the publication provider is already registered by {module}", { module: String(this.#provider.module) }) };
    this.#provider = { module, ...Object.fromEntries(PUBLICATION_DOORS.map((d) => [d, provider[d]])) };
    return { ok: true, module };
  }

  /** Whether a provider is registered, and by whom. */
  publicationProvider() { return this.#provider ? { registered: true, module: this.#provider.module } : { registered: false, module: null }; }

  /* One door's answer, or `fallback` when no provider is registered or the door throws. */
  #ask(door, fallback, ...args) {
    if (!this.#provider) return fallback;
    try { const r = this.#provider[door](...args); return r === undefined ? fallback : r; } catch { return fallback; }
  }
  #list(door, ...args) { const r = this.#ask(door, [], ...args); return Array.isArray(r) ? r : []; }
  #doc(caseId, edition) {
    const d = this.#ask("caseDocument", null, caseId, Number(edition));
    return d && typeof d === "object" && typeof d.text === "string" ? d : null;
  }

  /* ---------------------------------------------------------------- R4: tensions after publication */

  /** R4 (was publication R50; N345; DEC-84 item 13, DEC-85): for each case whose LATEST ratified edition `project` owns
   *  (every such case when absent), in case id order after `after`, at most `limit` cases (1–CASE_TENSIONS_MAX, that by
   *  default), with `cursor` the last case answered when more follow: the candidates `contradiction.unresolvedRecordOn`
   *  answers over each member at its pinned sha that the edition did not disclose, each with its case, edition, member,
   *  candidate and state; and each candidate the edition disclosed that the read no longer answers,
   *  `resolved_since: true`. Sight is the owning project's owners': a candidate with a side any owner may not see is
   *  answered as the read answers it for that owner, `unseen_other_side: true` with nothing of that side (DEC-85); a
   *  case whose project has no owner is read by nobody, every side withheld. A member whose read fails or is cut is
   *  stated `undetermined` or `truncated`, never dropped. Read as the plane, for `queue`: it writes nothing, never
   *  throws and composes no strength (R8); the signed edition never changes (publication R24). */
  caseTensions({ project = null, after = null, limit = null } = {}) {
    try {
      const cap = pageOf(limit, CASE_TENSIONS_MAX);
      const pid = str(project);
      if (!this.#provider)
        return { ok: true, wrote: false, project: pid || null, cases: [], limit: cap, cursor: null, undetermined: true,
                 why: NO_PROVIDER };
      const rows = this.#provider.latestRatified({ project: pid || null, after: typeof after === "string" ? after : "",
                                                   limit: cap + 1 });
      if (!Array.isArray(rows)) throw new Error("the provider answered no cases");
      const more = rows.length > cap;
      if (more) rows.length = cap;
      const cases = rows.map((r) => this.#caseTensionsOne(r.case_id, Number(r.edition), r.project_id ?? null));
      return { ok: true, wrote: false, project: pid || null, cases, limit: cap,
               cursor: more ? rows[rows.length - 1].case_id : null,
               says: word("case-tensions.says.contradiction_found_published") };
    } catch (e) {
      return { ok: true, wrote: false, project: str(project) || null, cases: [], limit: pageOf(limit, CASE_TENSIONS_MAX),
               cursor: null, undetermined: true, why: String(e && e.message || e).slice(0, 160) };
    }
  }

  /* R4: one case edition's tensions since publication, read under its owners' sight. */
  #caseTensionsOne(caseId, edition, projectId) {
    const d = this.#provider.caseDocument(caseId, edition);
    const doc = d && d.signed && typeof d.text === "string" ? d : null;
    const disclosed = doc ? disclosedCandidates(doc.text) : new Set();
    let owners = [];
    try { owners = projectId ? this.membership.projectOwners(projectId) || [] : []; } catch { owners = []; }
    /* No owner reads as nobody: a viewer that sees nothing, so every side is withheld (fail closed, DEC-85). */
    const viewers = owners.length ? owners.map((m) => `member:${m}`) : [""];
    const members = this.#provider.members(caseId, edition);
    if (!Array.isArray(members)) throw new Error("the provider answered no roster");
    const tensions = [], resolvedSince = [], unread = [];
    const answered = new Set();
    for (const m of members) {
      if (!m.version_sha) { unread.push({ member: m.bundle_id, undetermined: true, why: word("case-tensions.why.version_pinned") }); continue; }
      const byCandidate = new Map();
      let undetermined = false, truncated = false;
      for (const viewer of viewers) {
        let r = null;
        try { r = this.contradiction.unresolvedRecordOn({ finding: m.bundle_id, sha: m.version_sha, viewer }); }
        catch { r = null; }
        if (!r || r.undetermined || !Array.isArray(r.candidates)) { undetermined = true; continue; }
        if (r.truncated) truncated = true;
        if (r.undetermined_legs) undetermined = true;
        for (const c of r.candidates) {
          const had = byCandidate.get(c.candidate);
          /* An owner who may not see a side decides: the unseen answer replaces a seen one, never the reverse. */
          if (!had || (c.unseen_other_side && !had.unseen_other_side)) byCandidate.set(c.candidate, c);
        }
      }
      if (undetermined || truncated)
        unread.push({ member: m.bundle_id, ...(undetermined ? { undetermined: true } : {}),
                      ...(truncated ? { truncated: true } : {}) });
      for (const [id, c] of byCandidate) {
        answered.add(id);
        if (disclosed.has(id)) continue;
        tensions.push({ case: caseId, edition, member: m.bundle_id, candidate: id, state: c.state ?? null,
                        ...(c.unseen_other_side ? { unseen_other_side: true, ...(c.side ? { side: c.side } : {}) }
                                                : { a: c.a ?? null, b: c.b ?? null, ...(c.kind ? { kind: c.kind } : {}),
                                                    explanation: c.explanation ?? null }),
                        depth: 1 });
      }
    }
    /* A disclosed candidate the reads no longer answer has been resolved since, unless a read was not made whole. */
    if (!unread.length)
      for (const id of disclosed) if (!answered.has(id)) resolvedSince.push({ case: caseId, edition, candidate: id, resolved_since: true });
    return { case: caseId, edition, project: projectId, tensions, resolved_since: resolvedSince,
             ...(unread.length ? { unread } : {}) };
  }

  /* ================== CASE-4 / DEC-72: THE CASE RELATION (R1, was publication R4) ====================
   *
   * THE ONE PREDICATE THAT REPLACES `current_state === "published"`. Bob's ruling (DEC-72) ends `published` as an
   * inquiry lifecycle state: *"A finding's lifecycle ends at `concluded`; publication is the case relation."* So every
   * act that refused because a document was published — cannot divide, cannot restructure, cannot move a version, a
   * basis leg that is FROZEN rather than working, and reopen's own gate — now asks this (promotion's fact `caseMember`).
   *
   * IT IS ANSWERED BY THE PIN. It has to be the current version and not merely "has this id ever been published": a
   * finding that was published, reopened and revised is NOT a case member any more — the case holds the old version
   * forever and the working document has moved on.
   *
   * TWO ARMS, BECAUSE PUBLICATION IS TWO ACTS.
   *
   *   PINNED — the ratified relation. The roster row names this document's current `bundle_sha`; it exists only after
   *   the case edition's commit, which writes the roster and the pins out of the SIGNED BYTES.
   *
   *   PREPARED — the window between `op=publish` and the signature, where the case exists in the bytes and NOWHERE
   *   ELSE: an unsigned case document naming this document at its CURRENT sha, in an edition not yet ratified. It is a
   *   REFUSAL INPUT ONLY: nothing here commits a case fact. Without it, a member could publish under one composed
   *   strength and ratify under another.
   *
   * Returns the pinned rows themselves rather than a bare boolean, because the revision flag below needs to know WHICH
   * case editions froze WHICH hash. With no provider the relation cannot be read: `undetermined`, never a quiet "no". */
  caseRelation(bundleId) {
    const sha = this.#headSha(bundleId);
    if (!sha) return { member: false, pinned: [], prepared: null };
    if (!this.#provider) return { member: false, pinned: [], prepared: null, undetermined: true, why: NO_PROVIDER };
    const pinned = this.#list("pins", bundleId, sha)
      .map((r) => ({ case_id: r.case_id, edition: Number(r.edition), version_sha: r.version_sha, role: r.role ?? null }));
    const claim = this.#caseClaimInBytes(bundleId, sha);
    const prepared = claim && !claim.ratified ? { case_id: claim.case_id, edition: claim.edition } : null;
    return { member: pinned.length > 0 || prepared !== null, pinned, prepared };
  }

  /* THE PREPARED CLAIM, read off the CASE DOCUMENT: op=publish authors one per case edition, naming every member AT THE
   * SHA it just promoted them to. Only an unsigned document whose text names this bundle as a list entry can claim it
   * (the provider's index, as `attributionStatedFor`'s); the parse is the authority. It is a refusal input only, and
   * every refusal it feeds names the TARGET and never the case. Null when no claim is made. */
  #caseClaimInBytes(bundleId, sha) {
    for (const d of this.#list("preparations", bundleId)) {
      if (!d || typeof d.text !== "string") continue;
      const fm = parseFrontmatter(d.text).data || {};
      const rows = Array.isArray(fm.case_roles) ? fm.case_roles : [];
      if (rows.some((r) => r && r.target === bundleId && r.version_sha === sha))
        return { case_id: d.case_id, edition: Number(d.edition), ratified: !!d.ratified };
    }
    return null;
  }

  /* ============= CASE-4 / DEC-72: THE REVISION FLAG, SET AT THE MINT (R2, was publication R5) ==========
   *
   * `CASE-AS-PRODUCTION.md`: *"A case is a frozen, signed edition, honest as of its date. When a member finding is
   * later revised (new version minted), the containing cases are FLAGGED, never silently updated and never
   * automatically re-published."*
   *
   * Called from promotion's step (registered at creation), the ONE write that mints a version, with the sha the new
   * version is REPLACING: every route that can revise a member arrives there. A revision is definitionally a version
   * whose hash is not the one the case froze, so every case edition holding that pin is flagged.
   *
   * THE OBSERVATION IS DERIVED; THE FLAG IS WRITTEN DOWN, once, at the instant the revision mints, and nothing in this
   * module deletes one. ONE ROW PER (case edition, member, revised version); `ON CONFLICT DO NOTHING` because the key is
   * exactly the event's own identity. THE FLAG IS NOT AN ASSERTION ABOUT THE CASE: both halves are hashes this plane
   * holds, so the record says "these two hashes differ", a measurement and not an attribution. */
  flagCasesOnRevision(bundleId, replacedSha, when) {
    if (!bundleId || !replacedSha) return [];
    const frozen = this.#list("pins", bundleId, replacedSha);
    if (!frozen.length) return [];
    const revised = this.#headSha(bundleId);
    /* A revision that did not actually move the hash is not a revision. */
    if (!revised || revised === replacedSha) return [];
    const raised = [];
    for (const fz of frozen) {
      /* THE OWNING PROJECT, the case IDENTITY's (a case does not change hands between editions). NULL for a case
         published before DEC-72, which genuinely has no owning project. */
      const project = fz.project_id ?? null;
      this.sql.exec(
        `INSERT INTO case_revision_flags
           (case_id, edition, bundle_id, pinned_sha, revised_sha, project_id, since)
         VALUES (?,?,?,?,?,?,?)
         ON CONFLICT(case_id, edition, bundle_id, revised_sha) DO NOTHING`,
        fz.case_id, Number(fz.edition), bundleId, replacedSha, revised, project, when);
      raised.push({ case_id: fz.case_id, edition: Number(fz.edition), bundle_id: bundleId,
                    pinned_sha: replacedSha, revised_sha: revised, project_id: project, since: when });
    }
    return raised;
  }

  /* ============ CASE-4 / DEC-72: THE DISCHARGE, AND ITS SCOPE (R2) ===============
   *
   * *"New editions are each owning project's deliberate act."* So the act that discharges a flag is a NEW RATIFIED
   * EDITION OF THAT CASE (publication's commit calls this), never a bare acknowledgement op, which would commit a
   * case-level assertion from an unsigned request. SCOPED TO case_id AND NOTHING WIDER (D-266): there is no statement
   * that could clear a flag carrying a different case_id. IT IS A DISCHARGE AND NOT A CLEAR: the ACT is added to the
   * row. ONLY OUTSTANDING ROWS ARE STAMPED, so a second edition never re-describes what the first discharged. */
  dischargeCaseFlags(caseId, edition, by, when) {
    if (!caseId) return 0;
    const outstanding = this.#rows(
      `SELECT case_id, edition, bundle_id, revised_sha FROM case_revision_flags
        WHERE case_id=? AND acted_at IS NULL`, caseId);
    if (!outstanding.length) return 0;
    this.sql.exec(
      `UPDATE case_revision_flags SET acted_at=?, acted_by=?, acted_edition=?
        WHERE case_id=? AND acted_at IS NULL`, when, by ?? null, edition ?? null, caseId);
    return outstanding.length;
  }

  /** R3 (was publication R6; CASE-4 / DEC-72): THE READ. `op=caseflags`. Answers by case, by member finding, or over the
   *  whole store, DISCHARGED rows included: a project that acted is a fact about the record. NOT GATED BY VIEWER: every
   *  fact in a row is already public (the published case, its pins, the revised version's own hash). THE SCAN IS
   *  BOUNDED AND THE BOUND IS PUBLISHED, `limit` beside `truncated`, one more row asked for than may be used; the cap is
   *  the caller's to lower and not to raise, a whole number of rows. */
  caseFlags({ caseId = null, target = null, outstandingOnly = false, limit = null } = {}) {
    const where = [], args = [];
    if (caseId) { where.push(`case_id=?`); args.push(String(caseId).trim()); }
    if (target) { where.push(`bundle_id=?`); args.push(String(target).trim()); }
    if (outstandingOnly) where.push(`acted_at IS NULL`);
    const cap = pageOf(limit, CASE_FLAGS_LIMIT);
    const rows = this.#rows(
      `SELECT case_id, edition, bundle_id, pinned_sha, revised_sha, project_id, since,
              acted_at, acted_by, acted_edition
         FROM case_revision_flags
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY since, case_id, edition, bundle_id
        LIMIT ?`, ...args, cap + 1);
    const truncated = rows.length > cap;
    if (truncated) rows.length = cap;
    const flags = rows.map((r) => ({
      case_id: r.case_id, edition: r.edition, bundle_id: r.bundle_id,
      pinned_sha: r.pinned_sha, revised_sha: r.revised_sha,
      /* THE PROJECT THAT MUST ACT. NULL is STATED and never elided. */
      project_id: r.project_id ?? null,
      since: r.since,
      outstanding: r.acted_at === null || r.acted_at === undefined,
      acted: (r.acted_at === null || r.acted_at === undefined) ? null
        : { at: r.acted_at, by: r.acted_by ?? null, edition: r.acted_edition ?? null },
    }));
    return { ok: true, ...(caseId ? { caseId: String(caseId).trim() } : {}),
             ...(target ? { target: String(target).trim() } : {}),
             flags, count: flags.length,
             /* THE BOUND, BESIDE THE ANSWER: a truncated answer's `outstanding` and `projects_owing` are about THIS PAGE. */
             limit: cap, truncated,
             outstanding: flags.filter((x) => x.outstanding).length,
             /* WHICH PROJECTS STILL OWE AN ACT, deduplicated; a case whose project is unknown appears as null. */
             projects_owing: [...new Set(flags.filter((x) => x.outstanding)
               .map((x) => x.project_id))].sort((a, b) => String(a) < String(b) ? -1 : 1),
             /* SET-BUT-NEVER-CLEAR, SAID IN THE ANSWER. */
             doctrine: localize("case-tensions.index.a_revision_flag_is_set", "a revision flag is SET AND NEVER CLEARED: it is DISCHARGED by the owning project publishing a new edition of that case, which is recorded beside it rather than replacing it. A case with several owning projects is not discharged by one of them acting (DEC-72, D-266's scoping, D-79's ageing).") };
  }

  /* ---------------------------------------------------------------- R5–R7: attribution */

  /** R5 — MK-7 / §4.1's discriminator — WHICH OF THESE OBSERVATIONS STILL NAME THEIR AUTHOR IN THEIR OWN FILES. An
   *  observation written before MK-6 carries the member in `data/provenance.json` and the Session Log, and §4.1 keeps
   *  it FENCED. Asked STRUCTURALLY of the fields MK-6 moved — every provenance document's `author`, every chain hop's
   *  `who`, every `| Authored |` Session Log line — each must be `observerRef(<id>)`. A file that cannot be read or
   *  parsed is NOT in reference form: undetermined is fenced, never let through. */
  observationsNamingAuthor(ids) {
    const out = [];
    for (const id of [...new Set((Array.isArray(ids) ? ids : []).filter((x) => typeof x === "string" && x))].slice(0, 200)) {
      const ref = observerRef(id);
      const prov = this.#fileText(id, "data/provenance.json");
      const md = this.#fileText(id, "bundle.md");
      let form = false;
      try {
        const docs = JSON.parse(String(prov && prov.content || "")).documents;
        const authored = String(md && md.content || "").split("\n").filter((l) => /^### Session \S+ \| Authored \| /.test(l));
        form = Array.isArray(docs) && docs.length > 0 && authored.length > 0
          && docs.every((d) => d && d.author === ref
               && (Array.isArray(d.provenance_chain) ? d.provenance_chain : []).every((h) => h && h.who === ref))
          && authored.every((l) => l.endsWith(`| Authored | ${ref}`));
      } catch { form = false; }
      if (!form) out.push(id);
    }
    return out;
  }

  /** R6 (was publication R39) — MK-7 / §4.3 — THE LEVEL IN FORCE FOR ONE OBSERVATION AT ONE CASE EDITION, with the
   *  reason its author gave (null before DEC-88; K1076): the author's act at this edition, or else the latest earlier
   *  edition's (a later edition INHERITS the prior choice until the author changes it). None is none: nothing is ever
   *  prefilled. R7: a capture's SHA-256 (never a bundle id) reads its attesting member's choice, on the same rule. */
  attributionInForce(caseId, edition, observation) {
    if (typeof observation === "string" && HEX64.test(observation))
      return this.#one(`SELECT level, edition, chosen_by, chosen_at, reason FROM capture_attributions
                         WHERE case_id=? AND capture_sha=? AND edition<=? ORDER BY edition DESC LIMIT 1`,
                       caseId, observation, edition) || null;
    return this.#one(`SELECT level, edition, chosen_by, chosen_at, reason FROM observation_attributions
                       WHERE case_id=? AND bundle_id=? AND edition<=? ORDER BY edition DESC LIMIT 1`,
                     caseId, observation, edition) || null;
  }

  /* R5 — EVERY OBSERVATION ONE CASE DOCUMENT REACHES, at any depth, in first-reached order (§4.3: one level per
     observation per edition however many findings reach it, a `via` observation included). */
  #observationsReachedBy(docText) {
    const cf = (parseFrontmatter(String(docText || "")).data || {}).case_findings;
    const reach = this.basisVersions.testimonyReach((Array.isArray(cf) ? cf : []).map((x) => String(x ?? "").trim()));
    return [...new Set([...reach.self, ...reach.via.map((v) => v.observation)])];
  }

  /* R7 (DEC-119 (3)): THE OFF-THE-RECORD CAPTURES ONE CASE DOCUMENT REACHES: each capture its `sources:` block
     (case-grammar R1) states with no basis, the Withheld statement, in the document's order, once each. */
  #capturesReachedBy(docText) {
    let rows = null;
    try { rows = caseDocumentBlocks(String(docText || "")).sources; } catch { rows = null; }
    return [...new Set((Array.isArray(rows) ? rows : [])
      .filter((r) => r && typeof r.capture === "string" && HEX64.test(r.capture) && (r.basis == null || r.basis === "null"))
      .map((r) => r.capture))];
  }

  /* R5, R7: everything an edition's attribution statements are about: its observations, then its off-the-record
     captures, keyed by their SHA-256. */
  #attributedReachedBy(docText) {
    return [...this.#observationsReachedBy(docText), ...this.#capturesReachedBy(docText)];
  }

  /** R5 — MK-7 / §4.3, §4.6 — THE EDITION'S ATTRIBUTION STATEMENTS, DERIVED FROM THE ACTS AND NEVER FROM THE OWNER'S
   *  INPUT. One row per reached observation (or capture, R7): the level in force and what that level PUBLISHES —
   *  `group` the producing group (null when this store records none, stated in the prose), `project` the publishing
   *  project, `cover` the administrator's cover for the author, `name` the author's handle. The author's member id is
   *  never a value here. A level whose published value cannot be produced is UNCHOSEN with its reason. With no
   *  observations named, those the edition's own document reaches. */
  attributionStatements(caseId, edition, project, observations = undefined) {
    const obsList = Array.isArray(observations) ? observations : (() => {
      const d = this.#doc(caseId, edition);
      return d ? this.#attributedReachedBy(d.text) : [];
    })();
    return obsList.map((obs) => {
      /* R7 (K1315): an off-the-record capture's row carries `capture`, its SHA-256, in `observation`'s place. */
      const key = HEX64.test(String(obs)) ? { capture: obs } : { observation: obs };
      const act = this.attributionInForce(caseId, edition, obs);
      if (!act) return { ...key, level: null, shown: null, chosen_at_edition: null,
                         why: word("case-tensions.why.author_chosen_level") };
      /* R7: a capture's level publishes its attesting member's values, the member who chose it. */
      const g = HEX64.test(String(obs)) ? { author: act.chosen_by }
        : this.#one(`SELECT author FROM register WHERE bundle_id=? AND authored=1 LIMIT 1`, obs);
      const m = g ? this.membership.memberFacts(g.author) : null;
      /* WHAT EACH LEVEL PUBLISHES, and nothing else (a projection, not a refusal site, so it carries no DEC-49 marker). */
      const shown = act.level === "group" ? this.#producingGroup()
        : act.level === "project" ? project
        : act.level === "cover" ? (m && m.cover ? m.cover : null)
        : act.level === "name" ? (m && m.handle ? m.handle : null)
        : null;
      if (shown === null && act.level !== "group")
        return { ...key, level: null, shown: null, chosen_at_edition: null,
                 why: word("case-tensions.why.author_chose_edition", { level: String(act.level), edition: String(act.edition), level3: String(act.level === "name" ? "handle" : act.level) }) };
      return { ...key, level: act.level, shown, chosen_at_edition: Number(act.edition), why: null };
    });
  }

  /* R5 — RE-AUTHOR ONE UNSIGNED CASE DOCUMENT'S ATTRIBUTION RUNS FROM THE ACTS, through publication's one splice (its
     R21): only the two runs change, only while unsigned and only over the hash read, so the new hash is what the owner
     signs and a signature over the old bytes is refused as stale. A document carrying no run is left as it is and says
     so. */
  #reauthorAttributions(doc) {
    if (!SECTIONS.attribution(doc.text.split("\n")))
      return { case_id: doc.case_id, edition: doc.edition, reauthored: false,
               why: word("case-tensions.why.case_document_carries") };
    const fm = parseFrontmatter(doc.text).data || {};
    const rows = this.attributionStatements(doc.case_id, Number(doc.edition), String(fm.case_project ?? "").trim(),
                                            this.#attributedReachedBy(doc.text));
    return this.#splice({ caseId: doc.case_id, edition: Number(doc.edition), docSha: doc.doc_sha, section: "attribution",
      /* case-grammar R33, R35 (notice case-grammar:202): the body is spelled in the words of the document's own format,
         so a `/7` draft prepared before the format in force moved keeps its `group` words; `/8` and later say `team`. */
      lines: { frontmatter: attributionFrontmatterLines(rows), body: attributionBodyLines(rows, fm.format) } });
  }

  /* publication R21's splice through the provider, its answer without `ok`; a splice that cannot be made says so. */
  #splice(args) {
    const r = this.#ask("reauthorSection", null, args);
    if (!r || typeof r !== "object") return { case_id: args.caseId, edition: args.edition, reauthored: false,
                                               why: word("case-tensions.why.case_document_re") };
    const { ok: _ok, ...out } = r;
    return out;
  }

  /** R5 — WHAT op=caseratify NEEDS TO JUDGE ONE CASE DOCUMENT'S ATTRIBUTION (§4.4): every observation it reaches (and,
   *  R7, every off-the-record capture), those still naming their author in their own bytes (§4.1, fenced), what the
   *  signed-for-review bytes STATE, and what the acts say NOW. `publication`'s `caseDocumentFacts` reads it. */
  attributionFacts(doc) {
    const fm = parseFrontmatter(String(doc && doc.text || "")).data || {};
    const observations = this.#observationsReachedBy(doc && doc.text);
    const reached = [...observations, ...this.#capturesReachedBy(doc && doc.text)];
    const stated = (Array.isArray(fm.observation_attributions) ? fm.observation_attributions : [])
      .map((r) => ({ ...(r && r.capture != null && r.observation == null ? { capture: String(r.capture) }
                                                                         : { observation: String(r && r.observation != null ? r.observation : "") }),
                     level: r && typeof r.level === "string" && r.level !== "null" ? r.level : null,
                     shown: r && r.shown != null && r.shown !== "null" ? String(r.shown) : null }));
    const current = this.attributionStatements(doc.case_id, Number(doc.edition), String(fm.case_project ?? "").trim(), reached);
    return { reached, legacy: this.observationsNamingAuthor(observations), stated, current };
  }

  /** R5 — DOES ANY RATIFIED CASE DOCUMENT STATE A CHOSEN LEVEL FOR THIS OBSERVATION (or capture, R7)? op=ratify asks it
   *  before an observation's own bytes cross as a case's evidence. Bounded; the text match is the index, the parse the
   *  authority. With no provider, none is known to: false. */
  attributionStatedFor(observation) {
    const id = String(observation ?? "");
    if (!id) return false;
    const field = HEX64.test(id) ? "capture" : "observation";
    const docs = this.#list("signedDocumentsNaming", `  - ${field}: ${id}`, STATED_FOR_DOCS);
    return docs.some((d) => {
      const rows = (parseFrontmatter(String(d && d.text || "")).data || {}).observation_attributions;
      return Array.isArray(rows) && rows.some((r) => r && String(r[field]) === id
        && ATTRIBUTION_LEVELS.includes(r.level));
    });
  }

  /** R5, R7 — op=attribute: THE ATTRIBUTION ACT (MEMBER-KNOWLEDGE-DESIGN.md §4.2–§4.6). The observation's AUTHOR, and
   *  only they, chooses what one case edition publishes of who said it: `group | project | cover | name`, per (case
   *  edition, observation). It lands at the edition's PREPARED AND UNSIGNED case document and re-authors that
   *  document's attribution runs, so the level is in the bytes its owner signs. `by` is the control plane's stamp and
   *  nothing else. DEC-88: `reason`, the author's words on why this level, is recorded with the choice (C-92.13). R7
   *  (DEC-119 (3)): `capture` in place of `observation` names a capture the edition's document states as Withheld, and
   *  its attesting member chooses, by this same act, how the edition credits their attestation. */
  attributeObservation({ caseId = null, edition = null, observation = null, capture = null, level = null, reason = null,
                         by = null } = {}) {
    const refusal = (code, detail, extra) => {
      const row = ATTRIBUTION_ACT_CHECKS[code];
      return { ok: false, reason: code, code, check: row.check, translation: row.translation,
               detail, ...(extra || {}) };
    };
    const who = typeof by === "string" ? by.trim() : "";
    /* DEC-49 REGION is-attribute-act */
    if (!who || isMachineIdentity(who))
      return refusal("ATTRIBUTION_NOT_A_MEMBER",
        who ? localize("case-tensions.index.who_is_a_machine_credential", "'{who}' is a machine credential, and how a member's words are attributed is that member's own choice", { who: String(who.slice(0, 60)) }) : localize("case-tensions.index.this_call_carries_nobody", "this call carries nobody; the plane stamps who chose from the credential"));
    const lv = typeof level === "string" ? level.trim() : "";
    if (!lv)
      return refusal("ATTRIBUTION_NO_LEVEL",
        localize("case-tensions.index.no_level_was_chosen", "no level was chosen. There is no default (MEMBER-KNOWLEDGE-DESIGN.md §4): choose one of {ATTRIBUTION_LEVELS}", { ATTRIBUTION_LEVELS: String(ATTRIBUTION_LEVELS.join(", ")) }), { allowed: ATTRIBUTION_LEVELS });
    /* DEC-88 (C-92.13): the author's words on why this level, stored as written. Blank is empty after trim; the
       bound counts code points (K1030, K1050's reading). Asked before the level is judged, so nothing is written. */
    const why = typeof reason === "string" ? reason : null;
    const chars = why == null ? 0 : [...why].length;
    if (why == null || !why.trim() || chars > ATTRIBUTION_REASON_MAX)
      return refusal("ATTRIBUTION_NO_REASON",
        why == null
          ? (reason === undefined || reason === null
              ? localize("case-tensions.index.give_the_reason_you_choose", "give the reason you choose this level, in your own words (reason=…)")
              : localize("case-tensions.index.the_reason_must_be_your", "the reason must be your words, as text; a {v1} was sent", { v1: String(typeof reason) }))
          : !why.trim() ? localize("case-tensions.index.the_reason_is_blank", "the reason is blank. Say in your own words why you choose this level")
          : localize("case-tensions.index.the_reason_is_chars_characters", "the reason is {chars} characters, over the {ATTRIBUTION_REASON_MAX} a choice's reason is kept to. Refused rather than cut", { chars: String(chars), ATTRIBUTION_REASON_MAX: String(ATTRIBUTION_REASON_MAX) }), { limit: ATTRIBUTION_REASON_MAX });
    if (!ATTRIBUTION_LEVELS.includes(lv))
      return refusal("ATTRIBUTION_LEVEL_UNKNOWN",
        localize("case-tensions.index.lv_is_not_a_level", "'{lv}' is not a level; choose one of {ATTRIBUTION_LEVELS}", { lv: String(lv.slice(0, 40)), ATTRIBUTION_LEVELS: String(ATTRIBUTION_LEVELS.join(", ")) }),
        { allowed: ATTRIBUTION_LEVELS });
    /* END DEC-49 REGION is-attribute-act */
    const cap = typeof capture === "string" && capture.trim() ? capture.trim().toLowerCase() : "";
    const obs = cap ? "" : typeof observation === "string" ? observation.trim() : "";
    const subject = cap || obs;
    const cid = typeof caseId === "string" ? caseId.trim() : "";
    const ed = Number(edition);
    /* The edition's case document, through publication's provider (none registered: no document, so the act is refused
       below before anything is written). */
    const doc = cid && Number.isInteger(ed) && ed >= 1 ? this.#doc(cid, ed) : null;
    const reg = obs ? this.#one(`SELECT author FROM register WHERE bundle_id=? AND authored=1 LIMIT 1`, obs) : null;
    const named = cap ? { capture: cap } : { observation: obs || null };
    /* DEC-49 REGION is-attribute-author */
    if (cap) {
      /* A capture is "such a capture" only where the named edition's document states its source as Withheld: one
         answer for a capture no such document names, so the act is not a way to learn what cases exist. */
      if (!HEX64.test(cap) || !doc || !this.#capturesReachedBy(doc.text).includes(cap))
        return refusal("ATTRIBUTION_NOT_AN_OBSERVATION",
          localize("case-tensions.index.cap_is_not_material_from", "{cap} is not material from a source the named case edition shows as Withheld, so it has no attesting member to choose how they are credited", { cap: String(cap.slice(0, 80)) }), named);
      let actors = [];
      try { actors = (this.capture.captureAccountsOf(cap).actors || []).map((r) => String(r.actor || "").replace(/^member:/, "")); }
      catch { actors = []; }
      if (!actors.includes(who.replace(/^member:/, "")))
        return refusal("ATTRIBUTION_NOT_THE_AUTHOR",
          localize("case-tensions.index.cap_was_attested_by_another", "{cap} was attested by another member. Only the member who attested off-the-record material chooses how a case credits them: not a project owner, not an administrator, and not a default (DEC-119 (3))", { cap: String(cap) }), named);
    } else {
      if (!reg)
        return refusal("ATTRIBUTION_NOT_AN_OBSERVATION",
          localize("case-tensions.index.v1_is_not_a_members", "{v1} is not a member's firsthand observation in this record, so it has no author to choose how it is attributed", { v1: String(obs ? obs.slice(0, 80) : "(none named)") }), named);
      if (reg.author !== who)
        return refusal("ATTRIBUTION_NOT_THE_AUTHOR",
          localize("case-tensions.index.obs_was_recorded_by_another", "{obs} was recorded by another member. Only an observation's author chooses how a case shows who said it: not a project owner, not an administrator, and not a default (§4.2)", { obs: String(obs) }), named);
    }
    const me = this.membership.memberFacts(who);
    if (!me || me.status !== "active")
      return refusal("ATTRIBUTION_AUTHOR_NOT_ACTIVE",
        localize("case-tensions.index.the_v1_of_subject_is", "the {v1} of {subject} is not an active member, and nobody takes this act for them (§4.5)", { v1: String(cap ? "attesting member" : "author"), subject: String(subject) }), named);
    /* END DEC-49 REGION is-attribute-author */
    const reaches = !!doc && (cap ? true : this.#observationsReachedBy(doc.text).includes(obs));
    /* DEC-49 REGION is-attribute-edition
       ONE ANSWER for no such document and a document that does not reach this observation, so the act is not
       a way to learn what cases exist: the author is told only about an edition that uses their words. */
    if (!reaches)
      return refusal("ATTRIBUTION_NOT_REACHED",
        localize("case-tensions.index.no_prepared_case_edition_v1", "no prepared case edition {v1} rests on {obs}. An attribution is chosen for an edition that uses the observation, once op=publish has prepared its case document", { v1: String(cid ? `${cid.slice(0, 60)} edition ${Number.isInteger(ed) ? ed : "(none)"}` : "(none named)"), obs: String(obs) }), { ...named, caseId: cid || null, edition: Number.isInteger(ed) ? ed : null });
    if (doc.signed)
      return refusal("ATTRIBUTION_EDITION_RATIFIED",
        localize("case-tensions.index.cid_edition_ed_is_already", "{cid} edition {ed} is already signed, and a signed edition answers forever; your choice applies to the next edition, which inherits it until you change it (§4.3)", { cid: String(cid), ed: String(ed) }), { ...named, caseId: cid, edition: ed });
    if (lv === "name" && !(me.handle && String(me.handle).trim()))
      return refusal("ATTRIBUTION_NAME_NO_HANDLE",
        localize("case-tensions.index.name_publishes_the_handle", "'name' publishes the handle you appear under in this record, and you have none (§4.6). Choose another level, or set a handle first"), named);
    /* END DEC-49 REGION is-attribute-edition */
    const prior = this.attributionInForce(cid, ed, subject);
    const when = stampInstant("second");
    /* The same level again at the same edition writes nothing, so the first reason stands (K1058); another level is a
       new choice, recorded with its own reason. */
    const same = !!(prior && Number(prior.edition) === ed && prior.level === lv);
    if (!same && cap)
      this.sql.exec(`INSERT INTO capture_attributions (case_id, edition, capture_sha, level, chosen_by, chosen_at, reason)
                     VALUES (?,?,?,?,?,?,?) ON CONFLICT(case_id, edition, capture_sha) DO UPDATE SET
                       level=excluded.level, chosen_by=excluded.chosen_by, chosen_at=excluded.chosen_at,
                       reason=excluded.reason`,
                    cid, ed, cap, lv, who, when, why);
    else if (!same)
      this.sql.exec(`INSERT INTO observation_attributions (case_id, edition, bundle_id, level, chosen_by, chosen_at, reason)
                     VALUES (?,?,?,?,?,?,?) ON CONFLICT(case_id, edition, bundle_id) DO UPDATE SET
                       level=excluded.level, chosen_by=excluded.chosen_by, chosen_at=excluded.chosen_at,
                       reason=excluded.reason`,
                    cid, ed, obs, lv, who, when, why);
    const held = this.attributionInForce(cid, ed, subject);
    const reauthored = this.#reauthorAttributions(doc);
    /* R7 (K1317): the capture's attesting member row in the attestations section follows the choice. */
    const attested = cap ? this.#reauthorCaptureAttestation(cid, ed, cap, who, lv, me) : null;
    const fm = parseFrontmatter(doc.text).data || {};
    const stmt = this.attributionStatements(cid, ed, String(fm.case_project ?? "").trim(), [subject])[0];
    return { ok: true, existed: same, ...(cap ? { capture: cap, observation: null } : { observation: obs }), caseId: cid, edition: ed, level: lv, shown: stmt.shown,
             reason: held ? held.reason ?? null : null,
             previous: prior ? { level: prior.level, edition: Number(prior.edition) } : null,
             case_document: reauthored, ...(attested ? { attestations: attested } : {}),
             stated: word("case-tensions.stated.edition_now_states", { ed: String(ed), cid: String(cid), subject: String(subject), lv: String(lv) }) };
  }

  /* R7 (K1317; case-authoring R48): RE-AUTHOR THE CAPTURE'S ATTESTING MEMBER ROW in the unsigned document's
     `material_attestations:` section, through publication R21's one splice: each `member` row the chooser made for a
     material whose SHA-256 is the capture is replaced by one stating the chosen level, carrying the member's handle (or
     cover) and the account's signature only at `cover` or `name`, never at `group` or `project`. Every other row is kept
     as written. A document with no such section or row is left as it is and the answer says so. */
  #reauthorCaptureAttestation(caseId, edition, cap, who, level, me) {
    const doc = this.#doc(caseId, edition);
    if (!doc || doc.signed) return { reauthored: false, why: word("case-tensions.why.unsigned_case_document") };
    let m = null;
    try { m = materialsOf(parseFrontmatter(doc.text).data || {}); } catch { m = null; }
    const rows = m && Array.isArray(m.attestations) ? m.attestations : null;
    const refs = new Set((m && Array.isArray(m.materials) ? m.materials : [])
      .filter((x) => x && String(x.sha || "").toLowerCase() === cap).map((x) => x.ref));
    const bare = (v) => String(v ?? "").replace(/^member:/, "");
    const mine = (r) => r && r.by_kind === "member" && refs.has(r.ref)
      && (!r.sha || String(r.sha).toLowerCase() === cap)
      && (r.by == null || r.by === "null" || ["group", "project"].includes(r.level)
          || [bare(who), me.handle, me.cover].filter(Boolean).includes(bare(r.by)));
    if (!rows || !rows.some(mine))
      return { reauthored: false, why: word("case-tensions.why.case_document_states") };
    let signature = null;
    try {
      const accounts = (this.capture.captureAccountsOf(cap).accounts || []).filter((a) => bare(a.by) === bare(who));
      signature = accounts.length ? accounts[accounts.length - 1].signature ?? null : null;
    } catch { signature = null; }
    const named = level === "cover" || level === "name";
    const next = rows.map((r) => (!mine(r) ? r : { ...r, level,
      by: named ? (level === "name" ? me.handle ?? null : me.cover ?? null) : null,
      signature: named ? (r.signature && r.signature !== "null" ? r.signature : signature) : null }));
    return this.#splice({ caseId, edition, docSha: doc.doc_sha, section: "attestations",
      lines: { frontmatter: materialAttestationLines(next), body: [] } });
  }
}

const instances = new WeakMap();

/** The one instance for a host (K61, K1563 (1)). The first call creates it with `deps` (a test passes its own),
 *  creates its tables and declares them to record-core (R10), and registers with promotion what this module provides:
 *  the fact `caseMember` (R1; an undetermined relation throws, so promotion answers FACT_FAILED and never false) and,
 *  as its step's projection, the revision flag (R2), raised in the promotion's transaction after the new version is
 *  written. */
export function caseTensionsOf(host, deps) {
  let c = instances.get(host);
  if (!c) {
    const d = deps || {};
    const storage = d.storage || host.storage;
    const record = d.record || recordOf(host);
    const membership = d.membership || membershipOf(host, { record });
    const promotion = d.promotion || promotionOf(host, { record, membership });
    c = new CaseTensions({ ...d, host, storage, record, membership, promotion });
    instances.set(host, c);
    c.migrate();
    /* R10: the declaration's answer is kept, so a refused one (TABLE_DECLARED: nothing declared) is seen. */
    c.purgeDeclaration = record.declareTable("case-tensions", CASE_TENSIONS_TABLES.map((t) => ({ ...t, keys: [...t.keys] })));
    promotion.registerFact("caseMember", "case-tensions", (id) => {
      const r = c.caseRelation(id);
      if (r.undetermined) throw new Error(r.why);
      return !!r.member;
    });
    /* R2: `base` is the sha this promotion REPLACES; a case edition that froze it is flagged. A pure INSERT that
       refuses nothing, so no promotion fails on it. */
    promotion.registerStep("case-tensions", {
      project: (x) => { c.flagCasesOnRevision(x.bundleId, x.base ?? null, stampInstant("second")); return null; } });
  }
  return c;
}

/** Which declaration names one of this module's tables (record-core R21: each owner declares its own). */
export function caseTensionsOwns(t) {
  const name = typeof t === "string" ? t : t && t.name;
  return CASE_TENSIONS_TABLES.some((x) => x.name === name);
}

/** The module's ops (K1122's pattern), as entries of the plane's op map: `by` is the control plane's stamp, read from
 *  the query, so a caller's own copy in a body never wins. */
export function caseTensionsOps(c, url, body) {
  const q = (k) => url.searchParams.get(k);
  const b = body && typeof body === "object" ? body : {};
  return {
    /* CASE-4 / DEC-72: unstamped; every field is already served to a stranger (R3). */
    caseflags: () => c.caseFlags({ caseId: q("case"), target: q("target"), limit: q("limit"),
                                   outstandingOnly: q("outstanding") === "1" }),
    /* MK-7: WHO CHOSE comes from the query string, where the control plane stamped it (R5). */
    attribute: () => c.attributeObservation({ caseId: b.caseId ?? null, edition: b.edition ?? null,
                                              observation: b.observation ?? null, capture: b.capture ?? null,
                                              level: b.level ?? null,
                                              reason: b.reason ?? null, by: q("by") }),
  };
}

/* R12 (T51; K4168; op-declarations R80, op-grades R49): the ops this module serves that the screens send, declared by their owner beside
   the ops map: each row's class, weight and description are the op's existing rows', its fields are what the arm reads. */
export const DECLARED_OPS = Object.freeze({
  attribute: { classes: ["admin","member"], mutating: true, weight: "reasoned", description: localize("case-tensions.declared.attribute", "author-directed: an observation's author chooses its attribution level for one prepared case edition, keyed by (case, edition, observation); writes an `observation_attributions` row and re-authors the unsigned case document"),
    fields: { accepts: ["caseId","edition","observation","capture","level","reason"], requires: ["caseId","edition",["observation","capture"],"level","reason"] } },
});
