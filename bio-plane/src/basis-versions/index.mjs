/* basis-versions — an inquiry's basis versions (requirements: `build/requirements/basis-versions.md`). An inquiry's
 * basis holds several VERSIONS, each a complete, named, described alternative account of the support for its claim,
 * frozen once written (INVESTIGATIVE-SESSION §6). This module holds the versions and their legs, their six-act state
 * machine, the version a project stands on (CURRENT, §7), a project's conclusion as the adoption of that version's claim
 * (§7.1), and narrowing a leg to a part of its document (Content Framework §14.4). Every act is a member's; a machine
 * proposes a version (`appendVersion`, through `run-productions`' `op=suggest`) and holds no act that moves one (R30).
 *
 * Extracted from the legacy modules (T7-3; K3, K91, K102, N64, N67): `store.mjs` (PL-1's projection and freeze, PL-2's
 * six acts and CURRENT, PL-3's append, REC-13/REC-124/REC-136's conclusion and its record, REC-86's narrowing, D-235's
 * collections, REC-119's earned leg letters, MK-1's testimony reach, the shared-question producer's
 * `#projectsDrawingOn`), `schema.mjs` (the two tables, now `./schema.mjs`). The grammar (`./grammar.mjs`) and the check rows
 * (`./checks.mjs`) moved from the check catalogue in T19 (K766, K787). The legacy code's comments moved with it,
 * shortened where they only restated it.
 *
 * REACHED as `basisVersionsOf(host, deps)` (K61): one instance per host (the Durable Object's `ctx`), created on the
 * first call with `deps`, returned to every later caller. At creation it declares its tables to purge (R34), registers
 * its version grammar in record-core's C-2.8 slot after inquiry-grammar's (R43), joins
 * every promotion with its check (R6) and its projection (R7), and registers retrieval's `no_project_conclusion`
 * decoration (R42). `deps`:
 *   record, membership, promotion, content   the modules it uses, through their factories on the same host unless a
 *                test passes its own.
 *   inquiry      `{earned(subject, targetIds), legCapped(stated, earned, targetId), cyclePath(id, targetIds),
 *                basisFor(id, {limit})}`, inquiry's R13, R14, cycle read and R16, each through `inquiryOf(host)` unless
 *                a test passes its own.
 *   retrieval    the host's retrieval instance (`retrievalOf(host)`), which R42 registers its projection decoration
 *                with. The plane's host passes it on the first call, right after it creates retrieval with its clock;
 *                a host that passes none (a test of another module) has no projection to decorate.
 *   now          the module's clock, an ISO instant at second precision (default: the wall clock). */

import { parseFrontmatter, isMachineIdentity, normalizeType, LEGACY_TYPE_ALIASES, OBJECT_TYPES, STATES, vocabFor,
         createSha256 } from "../record-grammar/index.mjs";
import { checkLegExtentGrammar, INQUIRY_GRAMMAR_CHECKS, biasAppliedFindings, readBiasApplied } from "../inquiry-grammar/index.mjs";
import { readingSourceFromColumns } from "../textchain.mjs";
import { recordOf, stampInstant } from "../record-core/index.mjs";
import { membershipOf, viewerPredicate, GATE_MARK, listenerRefusal } from "../membership/index.mjs";
import { promotionOf, EDGE_REASON_MAX } from "../promotion/index.mjs";
import { appendStateHistory, setScalar, setOrAddScalar, appendSessionLog } from "../promotion/text.mjs";
/* R48: `biasNotInForce`, inquiry's one spelling of a bias application not in force (its R61); R49:
   `machinePassageUnchecked`, its one spelling of a machine-passage read that answered nothing usable (its R62) */
import { inquiryOf, legCapped, actNoBasis, biasNotInForce, machinePassageUnchecked,
         dividedCannotRestructure } from "../inquiry/index.mjs";
import { word, localize } from "../setup-words/index.mjs";
import { biasOf } from "../bias/index.mjs";
/* The extent grammar is content's face (N99): its `extentRelation` holds D-670's space rule and the `envelope` kind,
   which the retired check catalogue's copy (legacy-checks) did not. */
import { contentOf, mintLabel, contentMintState, CONTENT_MINTED_BY_PLANE, legContentId, legExtent, canonicalExtent,
         describeExtent, extentRelation, CONTENT_EXTENT_CHECKS, CONTENT_EARNED_MAX } from "../content/index.mjs";
import { acceptedWorkOf, ACCEPTED_WORK_CHECKS } from "../accepted-work/index.mjs";
/* the version grammar is `basis-version-grammar`'s (T51, CR-9; K624, K3946): imported, and re-exported whole below so
   every reader of this module's names keeps them (K3268) */
import { basisVersionFindings, versionsIn, compositionDiff, sameComposition, registerBasisVersionGrammar,
         isImportedRef, isDerivedKindRef, VERSION_KIND_CHECKS, VERSION_MACHINE, versionNeedsReason,
         VERSION_NAME_RE } from "../basis-version-grammar/index.mjs";
import { BASIS_VERSION_CHECKS, VERSION_ACT_CHECKS, CONCLUDE_ACT_CHECKS, NARROW_CHECKS, isBoilerplate } from "./checks.mjs";
import { fmSafe, quoted, typedValue, randHex, setVersionField, setCurrentVersionRow, appendFmRows,
         appendConclusionEntry } from "./text.mjs";
import { BASIS_VERSIONS_TABLES, migrateBasisVersions } from "./schema.mjs";
import { ConcludeFamily, READING_MIN, CONCLUSION_BIAS_EFFECTS } from "./conclude.mjs";
import { VERSION_REASON_MAX, drawsOn, EXTENT_FIELDS, LEG_COPY_KEYS } from "./shared.mjs";

export { READING_MIN, CONCLUSION_BIAS_EFFECTS, VERSION_REASON_MAX };

export * from "../basis-version-grammar/index.mjs";
export { BASIS_VERSION_CHECKS, VERSION_ACT_CHECKS, CONCLUDE_ACT_CHECKS, NARROW_CHECKS, BOILERPLATE_FORMS, isBoilerplate }
  from "./checks.mjs";
export { BASIS_VERSIONS_SCHEMA, BASIS_VERSIONS_TABLES } from "./schema.mjs";

/** R9: versions per read (default and ceiling), and legs per version returned. */
export const BASIS_VERSIONS_LIMIT_DEFAULT = 200;
export const BASIS_VERSIONS_LIMIT_MAX = 1000;
export const BASIS_VERSION_LEGS_MAX = 500;
/** R59: the keys of a typed leg's label as of the reading, this module's (the words are the design stream's), read by
 *  `case-disclosures` R39. */
export const TYPED_FROZEN_UNCHECKED_KEY = "content.typed.frozen.unchecked";
export const TYPED_FROZEN_CHECKED_KEY = "content.typed.frozen.checked";
/** R25: candidates listed per source. */
export const NARROW_CANDIDATES_MAX = 50;
/** R37: projects named per inquiry. */
export const PROJECTS_DRAWING_MAX = 32;
/** R37: candidate citers examined at most, per read. */
export const PROJECTS_DRAWING_EXAMINED = 256;
/** R41: inquiries answered per page (default and ceiling). */
export const PROJECT_QUESTIONS_MAX = 500;
/** R39: roots and rows of the testimony walk, and its depth guard. */
export const TESTIMONY_REACH_MAX = 200;
export const TESTIMONY_REACH_DEPTH = 64;
/** R12 (C-25.32): the shortest reason the version grammar stores on a state that needs one (C-25.19's floor). */
export const VERSION_REASON_MIN = 8;
/** R14: the six acts and the state each moves a version to; `current` and `hide` move none. */
export const VERSION_ACT_TO = Object.freeze({
  accept: "accepted", reject: "rejected", consider: "considering", revert: "suggested", current: null, hide: null,
});

/* The per-arm fields of a reading position, without kind and ref: exactly the shape a content extent takes. */
function posFields(pos) {
  const { kind, ref, ...rest } = pos;
  return rest;
}

/* A content extent as the leg fields `op=cite` and the frontmatter carry. */
function extentLegFields(extent) {
  const e = extent && typeof extent === "object" ? extent : {};
  const out = { extent_kind: e.kind };
  const FIELD_OF = { page: "extent_page", rect: "extent_rect", sheet: "extent_sheet", cell: "extent_cell",
                     slide: "extent_slide", shape: "extent_shape", para: "extent_para", run: "extent_run",
                     range: "extent_range", table: "extent_table", part: "extent_part", cited_as: "extent_cited_as" };
  for (const [f, k] of Object.entries(FIELD_OF)) if (e[f] !== undefined && e[f] !== null) out[k] = e[f];
  return out;
}

const safeJson = (s) => { try { return s == null ? null : JSON.parse(s); } catch { return null; } };
const isInquiryId = (id) => normalizeType(OBJECT_TYPES[String(id ?? "").split("-")[0]]) === "inquiry";
/* Every stored `object_type` spelling of an inquiry, the declared one and its legacy aliases, for a bounded SQL read. */
const INQUIRY_TYPES = JSON.stringify(["inquiry", ...Object.keys(LEGACY_TYPE_ALIASES)
  .filter((t) => LEGACY_TYPE_ALIASES[t] === "inquiry")]);
/* R49: a version leg as the machine-passage read is handed it, inquiry R62's leg shape with its version: `{version,
   ord, target, content_id?, extent_capture?, extent_*?}`, `ord` its row in `basis_version_legs`, fields absent when
   the row does not carry them. */
function passageLeg(version, ord, row) {
  const r = row && typeof row === "object" ? row : {};
  const out = { version, ord, target: typeof r.target === "string" ? r.target.trim() : (r.target ?? null) };
  for (const [k, v] of Object.entries(r))
    if ((k === "content_id" || k === "extent_capture" || k.startsWith("extent_")) && v !== undefined && v !== null && v !== "")
      out[k] = v;
  return out;
}

export class BasisVersions {
  #concFamily = null;        // R16–R21's family (`./conclude.mjs`)
  #candidateSource = null;   // R25's extract arm: {module, fn}
  #machinePassage = null;    // R49's read: {module, fn}

  constructor({ storage, record, membership, promotion, content, inquiry = null, acceptedWork = null, bias = null,
                now } = {}) {
    this.storage = storage;
    this.sql = storage.sql;
    this.record = record;
    this.membership = membership;
    this.promotion = promotion;
    this.content = content;
    this.inquiry = inquiry;
    /* R3 (N522): accepted-work's instance on the same host, whose leg check (its R3) the promotion check asks */
    this.acceptedWork = acceptedWork;
    /* R48: bias's `statementInForce` (its R49), an instance or a function answering one, reached on first use */
    this.biasSource = bias;
    this.now = typeof now === "function" ? now : () => stampInstant("second");
  }

  #rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  #one(q, ...a) { for (const r of this.sql.exec(q, ...a)) return r; return null; }

  migrate() { migrateBasisVersions(this.sql); }

  /* ---- sight (R33) ---- */

  /* The D-15 bundle gate over a QUALIFIED column: a machine sees everything, an absent or unrecognised viewer nothing. */
  #gate(col, viewer) {
    const gate = viewerPredicate(viewer);
    if (gate.scope === "member") return { sql: `${GATE_MARK} 1=1`, args: [] };
    if (gate.scope === "DENY") return { sql: gate.sql, args: [] };
    return { sql: `${GATE_MARK} (${col} IS NULL OR EXISTS (SELECT 1 FROM bundles b
              WHERE b.bundle_id = ${col} AND (${gate.sql})))`, args: gate.args };
  }

  /* A bundle the viewer may see, with its sha: null for one absent or invisible (one answer). */
  #visible(id, viewer) {
    const gate = viewerPredicate(viewer);
    const b = id ? this.#one(`SELECT b.bundle_id, b.object_type, b.current_state FROM bundles b
                                WHERE b.bundle_id=? AND (${gate.sql})`, id, ...gate.args) : null;
    if (!b) return null;
    const h = this.record.head(id);
    return h ? { ...b, bundle_sha: h.bundleSha } : null;
  }

  /* A held bundle with its sha, for an internal caller that asks no sight (R28). */
  #held(id) {
    const b = id ? this.#one(`SELECT bundle_id, object_type, current_state FROM bundles WHERE bundle_id=?`, id) : null;
    const h = b ? this.record.head(id) : null;
    return h ? { ...b, bundle_sha: h.bundleSha } : null;
  }

  /* R52 (T50; N1070; `inquiry` R64): a divided question's document is closed, so an act that would revise it answers
     inquiry's one refusal, `dividedCannotRestructure`, with the text and children inquiry's check gives the same
     revision, and nothing is written. Null for a question in any other state. `extra` adds the act's own fields. */
  #dividedRefusal(b, extra = {}) {
    if (!b || b.current_state !== "divided") return null;
    let into = [];
    try {
      const fm = parseFrontmatter(this.#doc(b.bundle_id) ?? "").data;
      into = fm && fm.division && Array.isArray(fm.division.into) ? fm.division.into.filter((x) => typeof x === "string") : [];
    } catch { into = []; }
    return dividedCannotRestructure(localize("basis-versions.index.bundle_id_was_divided_v1", "{bundle_id} was divided{v1}, and its children carry the question on, so its document is closed: no revision of it lands, whatever it changes (a leg severed, reinstated or added, a conclusion, a grouping). Work on the child that carries the part you mean. Nothing was written.", { bundle_id: String(b.bundle_id), v1: String(into.length ? ` into ${into.join(", ")}` : "") }), { ...extra, target: b.bundle_id, ...(into.length ? { children: into } : {}) });
  }

  #seen(id, viewer) {
    const gate = this.#gate("bx.bundle_id", viewer);
    return !!this.#one(`SELECT bx.bundle_id FROM bundles bx WHERE bx.bundle_id=? AND (${gate.sql})`, id, ...gate.args);
  }

  /* A bundle's live `bundle.md` text, or null. */
  #doc(id) {
    const f = this.record.readFile(id, "bundle.md");
    return f && typeof f.text === "string" ? f.text : null;
  }

  /* ---- the one write: a new revision of a document through promotion (R14, R15, R18, R19, R27, R28) ---- */

  #repromote({ bundleId, base, text, when, author, meta }) {
    const carried = [];
    for (const path of this.record.livePaths(bundleId) || []) {
      if (path === "bundle.md") continue;
      const f = this.record.readFile(bundleId, path);
      if (!f) continue;
      carried.push(typeof f.text === "string"
        ? { path, text: f.text, bytes: new TextEncoder().encode(f.text).length, sha256: f.sha256 }
        : { path, blobSha: f.blobSha, sha256: f.sha256, bytes: f.bytes });
    }
    const bytes = new TextEncoder().encode(text);
    return this.promotion.promote({
      bundleId, base, snapKey: `${when.replace(/[-:]/g, "")}_${randHex(4)}`, author,
      files: [{ path: "bundle.md", text, bytes: bytes.length, sha256: createSha256().update(bytes).hex() }, ...carried],
      meta });
  }

  /* ================================================================ its share of a promotion (R6, R7; K31) */

  /** R6: for an inquiry that is not a replay — the grammar (`BASIS_VERSION_REFUSED`), a leg naming a bundle the record
   *  does not hold (`VERSION_LEG_UNRESOLVED`, C-25.16), the version legs' content refusals (`content.citationRefusals`,
   *  through the same plan `basis[]` uses), and the freeze (`VERSION_FROZEN`, C-25.11). The freeze is exempt on replay
   *  too: history is append-only and a replay is the record re-stating what it said. */
  check(c) {
    const { pkg, bundleId, promotedType, docFm } = c;
    if (promotedType !== "inquiry" || !docFm || pkg.replay) return null;
    const vf = [];
    basisVersionFindings(docFm, vf);
    const verrs = vf.filter((x) => x.severity === "error");
    if (verrs.length)
      return { ok: false, reason: "BASIS_VERSION_REFUSED",
               findings: verrs.map((x) => ({ check: x.check, detail: x.message, code: x.code,
                                             /* four registries: a kind is C-27's, a leg extent relays C-45's codes,
                                                a leg on another group's finding inquiry-grammar's C-21.3 (N522) */
                                             translation: (BASIS_VERSION_CHECKS[x.code] ?? VERSION_KIND_CHECKS[x.code]
                                                           ?? CONTENT_EXTENT_CHECKS[x.code]
                                                           ?? INQUIRY_GRAMMAR_CHECKS[x.code])?.translation,
                                             ...(x.repairs ? { repairs: x.repairs } : {}) })) };
    const offered = versionsIn(docFm);
    /* DEC-49 REGION basis-version-resolve */
    for (const v of offered) {
      for (const leg of v.legs) {
        /* R3 (N522): another group's finding is not a bundle of this record; whether it is held is accepted-work's */
        if (isImportedRef(leg.target_id)) continue;
        /* R3 (K3873): a calculation is a row, an occurrence and a derived connection are named, not held, as bundles; whether
           each is held is inquiry's store-side check of a basis leg, as it was for the question's own */
        if (isDerivedKindRef(leg.target_id)) continue;
        if (!this.#one(`SELECT bundle_id FROM bundles WHERE bundle_id=?`, leg.target_id))
          return { ok: false, reason: "VERSION_LEG_UNRESOLVED", version: v.name, target: leg.target_id,
                   findings: [{ check: BASIS_VERSION_CHECKS.VERSION_LEG_UNRESOLVED.check,
                                code: "VERSION_LEG_UNRESOLVED",
                                translation: BASIS_VERSION_CHECKS.VERSION_LEG_UNRESOLVED.translation,
                                detail: localize("basis-versions.index.basis_version_name_rests_on", "basis version '{name}' rests on '{target_id}', which does not resolve in this store: an account of the evidence names material the record holds, or it points a reader at nothing while claiming support", { name: String(v.name), target_id: String(leg.target_id) }),
                                repairs: [localize("basis-versions.index.capture_or_promote_the_target", "capture or promote the target first, then compose the version on it"),
                                          localize("basis-versions.index.or_drop_the_leg_a", "or drop the leg — a version may honestly rest on less")] }] };
      }
    }
    /* END DEC-49 REGION basis-version-resolve */
    /* After the resolve arm, so a leg naming a target the record does not hold is told that first. */
    const vLegRows = Array.isArray(docFm.basis_version_legs) ? docFm.basis_version_legs : [];
    if (vLegRows.length) {
      const verrs2 = this.content.legRefusals(vLegRows, this.content.citationPlan(vLegRows), (i) =>
        `basis_version_legs[${i}] (version '${String(vLegRows[i]?.version ?? "").slice(0, 48)}')`);
      if (verrs2.length) return { ok: false, reason: "BASIS_VERSION_REFUSED", findings: verrs2 };
    }
    /* DEC-49 REGION basis-version-freeze — read before this promotion's delete-then-insert, against the composition
       this module computed at the earlier write, so a caller cannot supply the value it is checked against. */
    for (const v of offered) {
      const prior = this.#one(`SELECT composition FROM inquiry_basis_versions WHERE bundle_id=? AND name=?`, bundleId, v.name);
      if (!prior || sameComposition(prior.composition, v.composition)) continue;
      const changed = compositionDiff(prior.composition, v.composition);
      return { ok: false, reason: "VERSION_FROZEN", version: v.name, changed,
               findings: [{ check: BASIS_VERSION_CHECKS.VERSION_FROZEN.check, code: "VERSION_FROZEN",
                            translation: BASIS_VERSION_CHECKS.VERSION_FROZEN.translation,
                            detail: localize("basis-versions.index.basis_version_name_of_bundleid", "basis version '{name}' of {bundleId} is frozen and this promotion changes it in place ({changed}): a version is frozen once written, because two members exploring one version collide otherwise and comparison stops meaning anything when the thing being compared shifts underneath them", { name: String(v.name), bundleId: String(bundleId), changed: String(changed) }),
                            repairs: [localize("basis-versions.index.add_a_new_version_with", "add a NEW version with its own name and derived_from: '{name}'", { name: String(v.name) }),
                                      localize("basis-versions.index.or_restore_name_to_the", "or restore '{name}' to the composition the record holds", { name: String(v.name) })] }] };
    }
    /* END DEC-49 REGION basis-version-freeze */
    /* R3 (N522; DEC-112 (6), DEC-96 item 1): a leg on another group's finding rests on an acceptance in force at the
       edition it names, asked when the leg is written: in a version this promotion adds, a leg with no leg of the same
       finding and edition in the version it derives from. A held version is frozen and is not asked again, so a
       withdrawal never refuses an unrelated revision; it sends notices and moves no work (reevaluation's). */
    const fresh = [];
    const docLegs = Array.isArray(docFm.basis_version_legs) ? docFm.basis_version_legs : [];
    const byName = new Map(offered.map((v) => [v.name, v]));
    for (const v of offered) {
      if (!v.legs.some((l) => isImportedRef(l.target_id))) continue;
      if (this.#one(`SELECT 1 AS x FROM inquiry_basis_versions WHERE bundle_id=? AND name=?`, bundleId, v.name)) continue;
      const parent = v.derived_from ? byName.get(v.derived_from) : null;
      const inherited = new Set((parent ? parent.legs : []).filter((l) => isImportedRef(l.target_id))
        .map((l) => `${l.target_id}\u0000${l.edition ?? ""}`));
      for (const l of v.legs) {
        if (!isImportedRef(l.target_id) || inherited.has(`${l.target_id}\u0000${l.edition ?? ""}`)) continue;
        const row = docLegs[l.src_ord] || {};
        fresh.push({ version: v.name, leg: { ord: l.src_ord, target: l.target_id, target_edition: row.target_edition } });
      }
    }
    if (fresh.length) {
      let refused;
      try { refused = this.acceptedWork.acceptedLegRefusals({ legs: fresh.map((x) => x.leg), viewer: c.author ?? null }); }
      catch { refused = null; }
      const list = Array.isArray(refused) ? refused : null;
      /* a defect there is accepted-work's own C-21.5 for each leg asked, never a pass */
      const unreadable = ACCEPTED_WORK_CHECKS.ACCEPTED_WORK_UNREADABLE;
      const findings = list === null
        ? fresh.map((x) => ({ check: unreadable.check, code: "ACCEPTED_WORK_UNREADABLE", severity: "error",
                              translation: unreadable.translation, ord: x.leg.ord, ref: x.leg.target,
                              edition: x.leg.target_edition }))
        : list;
      if (findings.length)
        return { ok: false, reason: "BASIS_VERSION_REFUSED",
                 findings: findings.map((x) => {
                   const ord = x?.ord;
                   const owner = fresh.find((y) => y.leg.ord === ord);
                   return { ...x,
                            ...(owner ? { version: owner.version, detail: localize("basis-versions.index.basis_version_legs_ord_version", "basis_version_legs[{ord}] (version '{version}'): {why}", { ord: String(ord), version: String(owner.version), why: String(x?.detail ?? x?.message
                              ?? localize("basis-versions.index.rests_on_another_team_s", "rests on another team's finding whose acceptance at the edition named could not be established")) }) } : {}) };
                 }) };
    }
    /* R49 (N834): a member's revision cites as hers only the machine-proposed passages she took up. Asked over each leg
       of a version this revision adds (a held version is frozen and never asked again) and, where the revision accepts a
       version a machine authored, that version's legs, the accepting member as author. A machine's own promotion (its
       `suggested` version, R28) is never asked. */
    const author = typeof c.author === "string" ? c.author.trim() : "";
    /* only a machine is exempt: a promotion naming no author is not shown to be one, so it is asked (fail closed) */
    if (this.#machinePassage && !(author && isMachineIdentity(author))) {
      const asked = [];
      for (const v of offered) {
        const held = this.#one(`SELECT state FROM inquiry_basis_versions WHERE bundle_id=? AND name=?`, bundleId, v.name);
        const accepting = !!held && held.state !== "accepted" && v.state === "accepted"
          && typeof v.author === "string" && isMachineIdentity(v.author.trim());
        if (held && !accepting) continue;
        for (const l of v.legs) asked.push(passageLeg(v.name, l.src_ord, docLegs[l.src_ord]));
      }
      if (asked.length) {
        const refused = this.#machinePassageRefusal(asked, author);
        if (refused) return refused;
      }
    }
    return null;
  }

  /** R49: one registration of the read that says whether a member may cite as hers a passage a machine proposed; a
   *  malformed or second registration is refused by membership's one site (its R81), as R40's is. */
  onMachinePassage(module, fn) {
    const refused = listenerRefusal(this.#machinePassage, module, fn);
    if (refused) return refused;
    this.#machinePassage = { module, fn };
    return { ok: true, module };
  }

  /* R49: the registered read's verdict over `legs`, asked once: null when each may stand as `author`'s (or nothing is
     registered), its refusal unchanged, or inquiry R62's `MACHINE_PASSAGE_UNCHECKED` for a read that throws or answers
     anything else (fail closed). The viewer is the acting member, as R3's accepted-work read is asked. */
  #machinePassageRefusal(legs, author) {
    const src = this.#machinePassage;
    if (!src || !legs.length) return null;
    let ans;
    try { ans = src.fn({ legs, author, viewer: author }); }
    catch (e) { ans = { thrown: e }; }
    if (ans === null) return null;
    if (ans && typeof ans === "object" && !("thrown" in ans) && ans.ok === false && typeof ans.then !== "function")
      return ans;
    const row = machinePassageUnchecked(
      localize("basis-versions.index.the_read_registered_by_module", "the read registered by {module} that says whether {author} may cite as theirs a passage a machine proposed {outcome}, so {n} leg(s) of a basis version are refused rather than trusted. Nothing was written.",
        { module: String(src.module), author: String(author), n: String(legs.length),
          outcome: ans && typeof ans === "object" && "thrown" in ans
            ? localize("basis-versions.index.failed", "failed")
            : localize("basis-versions.index.answered_neither_a_verdict_nor", "answered neither a verdict nor a refusal") }),
      { legs: legs.map((l) => ({ version: l.version, ord: l.ord, target: l.target })) });
    return { ...row, ok: false, reason: row?.reason ?? row?.code ?? "MACHINE_PASSAGE_UNCHECKED",
             findings: Array.isArray(row?.findings) ? row.findings : [row] };
  }

  /** R7: both tables re-derived WHOLE from the document in the promotion's transaction, the ONLY write to either. Each
   *  document leg's content row is the one it names, else content's resolution over the leg's plan; there is no
   *  carry-forward, because a version is frozen and the content address answers the same id for the same referent. A
   *  replay reaches here with the check skipped: a leg the module would now refuse projects NULL, never a row minted
   *  retroactively. The answer lists `version_content`, read back out of the table. */
  project(c) {
    const { bundleId, promotedType, docFm, meta } = c;
    const isInquiry = promotedType === "inquiry";
    this.sql.exec(`DELETE FROM inquiry_basis_version_legs WHERE bundle_id=?`, bundleId);
    this.sql.exec(`DELETE FROM inquiry_basis_versions WHERE bundle_id=?`, bundleId);
    const vLegRowsAll = isInquiry && docFm && Array.isArray(docFm.basis_version_legs) ? docFm.basis_version_legs : [];
    if (!isInquiry || !docFm) return null;
    const vPlan = vLegRowsAll.length ? this.content.citationPlan(vLegRowsAll) : new Map();
    const at = (meta && meta.last_updated) || null;
    for (const v of versionsIn(docFm)) {
      this.sql.exec(
        `INSERT INTO inquiry_basis_versions
           (bundle_id,name,ord,description,relationship,state,derived_from,hidden,claim,run,author,at,
            regroup_by,regroup_at,regroup_note,composition,leg_count,state_by,state_at,state_reason,kind,affirmed_parts)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        bundleId, v.name, v.ord, v.description, v.relationship, v.state, v.derived_from,
        v.hidden, v.claim, v.run, v.author, v.at,
        v.regroup_by, v.regroup_at, v.regroup_note, v.composition, v.legs.length,
        v.state_by, v.state_at, v.state_reason, v.kind, v.affirmed_parts);
      for (let k = 0; k < v.legs.length; k++) {
        const l = v.legs[k];
        if (!l.target_id) continue;   // a replayed malformed shape: unprojectable
        let vContentId = null;
        const vp = vPlan.get(l.src_ord);
        if (vp && vp.isInfo) {
          const namedId = legContentId(vLegRowsAll[l.src_ord]);
          if (namedId) vContentId = namedId;
          else if (vp.captureSha) {
            const m = this.content.mint({ bundleId: l.target_id, captureSha: vp.captureSha, extent: vp.extent,
                                          mintedBy: CONTENT_MINTED_BY_PLANE, at, ctx: vp.ctx });
            if (m.ok) vContentId = m.content_id;
          }
        }
        this.sql.exec(
          `INSERT INTO inquiry_basis_version_legs
             (bundle_id,name,ord,target_id,target_type,role,grade,grade_axis,grade_source,note,at,ground,content_id,
              target_edition)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          bundleId, v.name, k, l.target_id, l.target_type, l.role,
          l.grade, l.grade_axis, l.grade_source, l.note, l.at, l.ground, vContentId,
          /* R3 (N522, K1305): the edition a leg on another group's finding names, as written */
          l.edition === null ? null : (/^\d+$/.test(l.edition) ? Number(l.edition) : null));
      }
    }
    if (!vLegRowsAll.length) return null;
    return { version_content: this.#rows(
      `SELECT name, ord, target_id, content_id FROM inquiry_basis_version_legs WHERE bundle_id=? ORDER BY name, ord`, bundleId)
      .map((r) => ({ version: r.name, ord: r.ord, target: r.target_id, content_id: r.content_id ?? null })) };
  }

  /* ================================================================ reads (R8–R11, R22, R23, R37, R39, R41, R42, R50) */

  /** D-235: the collections the record holds for one version, read once for `op=basisversions` and `op=suggest`'s
   *  answer. The ground labels come from the legs this answer carries, the blank label a legless part projects dropped.
   *  `composition_grades: "authored"` says the frozen string keeps what was AUTHORED while `legs[]` publishes what the
   *  record earns (R10). */
  versionCollections(bundleId, row) {
    const legs = this.#legsEarned(this.#rows(
      `SELECT ord, target_id, target_type, role, grade, grade_axis, grade_source, note, at, ground, content_id,
              target_edition
         FROM inquiry_basis_version_legs WHERE bundle_id=? AND name=? ORDER BY ord LIMIT ?`,
      bundleId, row.name, BASIS_VERSION_LEGS_MAX));
    const grounds = [...new Set(legs.map((l) => String(l.ground ?? "").trim()).filter(Boolean))].sort();
    /* R53: the distinct ground labels of ALL the version's legs in the reading's own order (the list `affirmed` must
       equal), read in SQL so the leg bound above never hides a part */
    const parts = this.#rows(
      `SELECT ground FROM inquiry_basis_version_legs WHERE bundle_id=? AND name=? AND ground IS NOT NULL AND ground <> ''
        GROUP BY ground ORDER BY MIN(ord)`, bundleId, row.name).map((r) => r.ground);
    return { legs, grounds, parts, leg_count: row.leg_count, legs_complete: legs.length === row.leg_count,
             composition_grades: "authored" };
  }

  /** R10 (REC-119 / D-411): each leg's capture letter as `inquiry.legCapped` bounds it, one registry call for the whole
   *  version. A leg is bounded when it is on the capture axis, carries a letter, and rests on something that is not an
   *  inquiry; `grade_authored` and `grade_why` are on every leg, so a consumer never reads absence as a value. */
  #legsEarned(rows) {
    if (!Array.isArray(rows) || !rows.length) return rows;
    const bounded = (r) => !!r && r.grade_axis === "capture" && r.grade != null
      && typeof r.target_id === "string" && !!r.target_id && normalizeType(r.target_type) !== "inquiry";
    /* R60 (leg-earning R18, R19, R10; PR 138): a leg naming a content row on the capture axis, or stating no letter, may
       rest on a member's typing, whose capture ceiling is the passage's own (`earned.content[cid].capture`, marked
       `record_graded`), not the document's: the record grades such a leg, stated or not, and a check moves it. */
    const passage = (r) => !!r && typeof r.content_id === "string" && !!r.content_id
      && (r.grade_axis === "capture" || r.grade == null)
      && typeof r.target_id === "string" && !!r.target_id && normalizeType(r.target_type) !== "inquiry";
    const targets = new Set(), contentIds = new Set();
    for (const r of rows) {
      if (bounded(r)) targets.add(r.target_id);
      if (passage(r)) { targets.add(r.target_id); contentIds.add(r.content_id); }
    }
    const inq = this.inquiry;
    const reg = targets.size && inq && typeof inq.earned === "function"
      ? (contentIds.size ? inq.earned(null, [...targets], [...contentIds]) : inq.earned(null, [...targets]))?.earned || {}
      : {};
    const cap = reg.capture || {};
    const typedOf = (r) => {
      const e = passage(r) ? reg.content?.[r.content_id]?.capture : null;
      return e && e.record_graded === true ? e : null;
    };
    return rows.map((r) => {
      const typed = typedOf(r);
      const res = (typed || bounded(r)) && inq && typeof inq.legCapped === "function"
        ? inq.legCapped(r.grade, typed || cap[r.target_id], r.target_id) : null;
      return { ...r, grade: res ? res.grade : r.grade, grade_authored: r.grade, grade_why: res ? res.why : null,
               ...(typed ? { graded_by: res && res.graded_by === "record" ? "record" : res ? "record_cap" : "stated" } : {}) };
    });
  }

  /** R59 (T53; DEC-464): a leg whose content row is a member's typing carries who typed and checked it as of the
   *  reading (`typed_at_freeze`: only members other than the typist whose attestation is at or before the version's
   *  `at`, in time order, by the team's handles) and as of now (`typed`, content R64's block). Derived here at the read
   *  from content; nothing is stored in the version (R7, R29). A checker whose instant is not kept is listed under
   *  `undetermined`, never placed before or after. A typing the viewer may not read carries neither. */
  #typedLegs(versions, viewer) {
    const c = this.content;
    if (!c || typeof c.transcriptionRead !== "function") return;
    const ids = new Set();
    for (const v of versions) for (const l of v.legs || []) if (typeof l.content_id === "string" && l.content_id) ids.add(l.content_id);
    if (!ids.size) return;
    /* the typings among the cited rows, in content's bounded batch read; a handle read only for those */
    const typedIds = new Set();
    const all = [...ids];
    if (typeof c.standings === "function")
      for (let i = 0; i < all.length; i += CONTENT_EARNED_MAX)
        for (const [cid, s] of Object.entries(c.standings(all.slice(i, i + CONTENT_EARNED_MAX)) || {}))
          if (s && s.typed) typedIds.add(cid);
    if (!typedIds.size) return;
    const reads = new Map();
    for (const cid of typedIds) {
      const t = c.transcriptionRead({ id: cid, viewer });
      if (t && t.ok && t.typed) reads.set(cid, t);
    }
    const instant = (x) => (typeof x === "string" && x ? Date.parse(x) : NaN);
    for (const v of versions) {
      const frozenAt = instant(v.at);
      for (const l of v.legs || []) {
        const t = reads.get(l.content_id);
        if (!t) continue;
        const checked_by = [], undetermined = [];
        const others = (t.attestations || []).filter((a) => a.attestor !== t.transcriber)
          .slice().sort((x, y) => String(x.at ?? "").localeCompare(String(y.at ?? "")) || String(x.attestor).localeCompare(String(y.attestor)));
        for (const a of others) {
          const when = instant(a.at);
          if (Number.isNaN(when) || Number.isNaN(frozenAt)) undetermined.push({ checker: a.attestor, at: a.at ?? null });
          else if (when <= frozenAt) checked_by.push({ checker: a.attestor, at: a.at });
        }
        l.typed_at_freeze = {
          typist: t.transcriber, checked_by,
          ...(undetermined.length ? { undetermined } : {}),
          label_key: checked_by.length ? TYPED_FROZEN_CHECKED_KEY : TYPED_FROZEN_UNCHECKED_KEY,
        };
        l.typed = t.typed;
      }
    }
  }

  /** R8–R11 (`op=basisversions`). Hidden versions are returned, flagged (DEC-29(b)); a version is whole or absent
   *  (the bound counts VERSIONS); an inquiry the viewer may not see answers exactly as one with no versions, and
   *  `inquiry_present` appears only when it is visible. The run a version names is reported, never joined (§14b.7). */
  basisVersions({ id = null, limit = null, offset = 0, viewer = null, project = null } = {}) {
    const refuse = (key, detail) => {
      const row = BASIS_VERSION_CHECKS[key];
      return { ok: false, reason: key, check: row.check, code: key, translation: row.translation, detail };
    };
    const inq = id == null ? "" : String(id).trim();
    if (!inq)
      return refuse("BASIS_VERSIONS_NO_INQUIRY",
        localize("basis-versions.index.op_basisversions_answers_for_one", "op=basisversions answers for ONE inquiry: pass id=<INQ-…>. Versions are versions of a question's basis, and there is no default question."));
    if (!isInquiryId(inq))
      return refuse("BASIS_VERSIONS_NOT_AN_INQUIRY",
        localize("basis-versions.index.inq_is_not_an_inquiry", "{inq} is not an inquiry. Only an inquiry has a basis, so only an inquiry has versions of one; an empty list here would say this thing has none when it could not have any.", { inq: String(inq.slice(0, 60)) }));
    const cap = Math.max(1, Math.min(BASIS_VERSIONS_LIMIT_MAX, Math.floor(Number(limit) || BASIS_VERSIONS_LIMIT_DEFAULT)));
    const from = Math.max(0, Math.floor(Number(offset) || 0));
    const present = this.#seen(inq, viewer);
    const total = present
      ? (this.#one(`SELECT COUNT(*) AS n FROM inquiry_basis_versions WHERE bundle_id=?`, inq)?.n ?? 0) : 0;
    const rows = present ? this.#rows(
      `SELECT * FROM inquiry_basis_versions WHERE bundle_id=? ORDER BY ord, name LIMIT ? OFFSET ?`, inq, cap, from) : [];
    const versions = rows.map((r) => {
      const rec = this.versionCollections(inq, r);
      return {
        name: r.name, description: r.description, relationship: r.relationship, grounds: rec.grounds, parts: rec.parts,
        state: r.state, derived_from: r.derived_from, hidden: r.hidden === 1, claim: r.claim, run: r.run,
        kind: r.kind ?? null, author: r.author, at: r.at,
        /* who moved it, when and why — null on a version nobody has moved */
        moved: r.state_by ? { by: r.state_by, at: r.state_at, reason: r.state_reason } : null,
        /* DEC-32 clause 4: null means nobody was asked, a different fact from an affirmation naming no parts */
        affirmed: r.affirmed_parts ? String(r.affirmed_parts).split("\t") : null,
        regroup: r.regroup_by ? { by: r.regroup_by, at: r.regroup_at, note: r.regroup_note } : null,
        composition: r.composition, composition_grades: rec.composition_grades,
        leg_count: rec.leg_count, legs_complete: rec.legs_complete, legs: rec.legs,
      };
    });
    this.#typedLegs(versions, viewer);
    const concRec = project ? this.conclusionRecordOf(project, inq, viewer) : null;
    return {
      ok: true, inquiry: inq, ...(present ? { inquiry_present: true } : {}),
      versions, count: versions.length, total, limit: cap, offset: from,
      truncated: from + versions.length < total,
      /* §7: CURRENT is a property of a named project's relationship, so an unnamed project gets no field at all */
      ...(project ? { current: this.currentOf(project, inq, viewer) } : {}),
      ...(project ? { conclusion: this.conclusionOf(project, inq, viewer) } : {}),
      ...(concRec ? { conclusion_stance: concRec.stance ? concRec.stance.state : "none",
                      conclusion_history: concRec.history } : {}),
      /* §7.1 item 5: the inquiry's own conclusion, the no-project relationship's, whether or not a project is named */
      no_project_conclusion: present ? this.noProjectConclusionOf(inq) : null,
    };
  }

  /** R55 (T51; N1215; DEC-330 A40; `op=versioncompare`): how two readings of one question differ, so no caller re-derives
   *  what "different" means. A read of the projection: writes nothing, never throws. An absent, invisible or non-inquiry
   *  target answers one refusal (R33). Five dimensions in a fixed order, each `{same, a, b}`; `legs` is
   *  `{taken_up, let_go, kept}` by target (with its extent, content id and capture), in each version's order. */
  compareVersions({ target = null, a = null, b = null, project = null, viewer = null } = {}) {
    /* R55 (DEC-337): the words are the list's, read by key through the row; no sentence is held here */
    const refuse = (key) => {
      const row = BASIS_VERSION_CHECKS[key];
      return { ok: false, reason: key, check: row.check, code: key, translation: row.translation };
    };
    try {
      const inq = String(target ?? "").trim();
      if (!inq || !isInquiryId(inq) || !this.#seen(inq, viewer))
        return refuse("VERSION_COMPARE_NO_INQUIRY");
      const na = String(a ?? "").trim(), nb = String(b ?? "").trim();
      if (!na || !nb) return refuse("VERSION_COMPARE_NO_VERSION");
      const get = (n) => this.#one(`SELECT * FROM inquiry_basis_versions WHERE bundle_id=? AND name=?`, inq, n);
      const ra = get(na), rb = get(nb);
      const missing = [[na, ra], [nb, rb]].filter(([, r]) => !r).map(([n]) => n);
      if (missing.length)
        return { ...refuse("VERSION_COMPARE_NO_SUCH_VERSION"), missing: missing.slice(0, 2) };
      const legsOf = (n) => this.#rows(
        `SELECT ord, target_id, content_id FROM inquiry_basis_version_legs WHERE bundle_id=? AND name=?
          ORDER BY ord`, inq, n);
      const doc = this.#doc(inq);
      const fmDoc = doc !== null ? (parseFrontmatter(doc).data || {}) : {};
      const docLegs = (Array.isArray(fmDoc.basis_version_legs) ? fmDoc.basis_version_legs : [])
        .filter((l) => l && typeof l === "object");
      /* a leg is its target with its extent, content id and pinned capture */
      const keyed = (n) => {
        const mine = docLegs.filter((l) => String(l.version ?? "").trim() === n);
        return legsOf(n).map((r) => {
          const d = mine[r.ord] || {};
          const ext = canonicalExtent(legExtent(d));
          const key = JSON.stringify([r.target_id, r.content_id ?? null, ext, d.extent_capture ?? null]);
          return { key, ord: r.ord, target: r.target_id, content_id: r.content_id ?? null, extent: legExtent(d),
                   extent_capture: d.extent_capture ?? null };
        });
      };
      const la = keyed(na), lb = keyed(nb);
      const inA = new Set(la.map((x) => x.key)), inB = new Set(lb.map((x) => x.key));
      const out = (x) => { const { key, ...rest } = x; return rest; };
      const legs = { taken_up: lb.filter((x) => !inA.has(x.key)).map(out), let_go: la.filter((x) => !inB.has(x.key)).map(out),
                     kept: lb.filter((x) => inA.has(x.key)).map(out) };
      const partsOf = (n) => this.#rows(
        `SELECT ground FROM inquiry_basis_version_legs WHERE bundle_id=? AND name=? ORDER BY ord`, inq, n)
        .map((r) => r.ground);
      const partition = (n) => JSON.stringify([...new Set(partsOf(n))].map((g) => [g, legsOf(n)
        .filter((_, i) => partsOf(n)[i] === g).map((l) => l.target_id)]));
      const cur = project ? this.currentOf(project, inq, viewer) : null;
      const side = (r, n) => ({ state: r.state, moved: r.state_by ? { by: r.state_by, at: r.state_at, reason: r.state_reason } : null,
                                ...(project ? { current: !!cur && cur.version === n } : {}) });
      const dim = (va, vb) => ({ same: JSON.stringify(va) === JSON.stringify(vb), a: va, b: vb });
      const dimensions = {
        claim: dim(ra.claim ?? null, rb.claim ?? null),
        legs: { same: !legs.taken_up.length && !legs.let_go.length
                       && JSON.stringify(la.map((x) => x.key)) === JSON.stringify(lb.map((x) => x.key)),
                a: la.map(out), b: lb.map(out) },
        relationship: dim({ relationship: ra.relationship, partition: partition(na) },
                          { relationship: rb.relationship, partition: partition(nb) }),
        decision: dim(side(ra, na), side(rb, nb)),
        origin: dim({ author: ra.author ?? null, kind: ra.kind ?? null, run: ra.run ?? null, derived_from: ra.derived_from ?? null },
                    { author: rb.author ?? null, kind: rb.kind ?? null, run: rb.run ?? null, derived_from: rb.derived_from ?? null }),
      };
      dimensions.relationship.a = { relationship: ra.relationship, partition: JSON.parse(dimensions.relationship.a.partition) };
      dimensions.relationship.b = { relationship: rb.relationship, partition: JSON.parse(dimensions.relationship.b.partition) };
      return { ok: true, a: na, b: nb, differs: Object.values(dimensions).filter((d) => !d.same).length, of: 5,
               dimensions, legs };
    } catch {
      return refuse("VERSION_COMPARE_NO_INQUIRY");
    }
  }

  /** R11, R13 (PL-2): what a project stands on, read from the project's own `bundle.md`: `{project, version, at, by}`,
   *  or null for a project the viewer may not see, a project with no document, or one naming no version for this
   *  inquiry (one answer). The ONE reader, paired with the make-current act's one writer. */
  currentOf(projectId, inquiryId, viewer) {
    const pid = String(projectId ?? "").trim();
    if (!pid || !this.#seen(pid, viewer)) return null;
    const text = this.#doc(pid);
    if (text === null) return null;
    const fm = parseFrontmatter(text).data || {};
    const rows = Array.isArray(fm.current_versions) ? fm.current_versions : [];
    for (const r of rows) {
      if (!r || typeof r !== "object") continue;
      if (String(r.inquiry ?? "").trim() !== String(inquiryId ?? "").trim()) continue;
      const name = String(r.version ?? "").trim();
      if (!name) continue;
      return { project: pid, version: name, at: typeof r.at === "string" ? r.at : null,
               by: typeof r.by === "string" ? r.by : null };
    }
    return null;
  }

  /** R22 (REC-136): a project's whole record on an inquiry, in the order written, and its stance (the latest entry).
   *  A row with no `act` is a conclusion (REC-124's writer wrote nothing else); a row naming an act this module does not
   *  know is carried as `unrecognised` and reads `undetermined`, never skipped. An invisible project, one with no
   *  document, and one that did nothing about the question answer the same empty record. Commentary is labelled
   *  `evidence: false`. */
  conclusionRecordOf(projectId, inquiryId, viewer) {
    const pid = String(projectId ?? "").trim();
    if (!pid || !this.#seen(pid, viewer)) return { history: [], stance: null };
    const text = this.#doc(pid);
    if (text === null) return { history: [], stance: null };
    return BasisVersions.#recordIn(parseFrontmatter(text).data || {}, pid, inquiryId);
  }

  /* R22's one reading of a project's parsed document: its rows for one question, in order, and the stance. Shared by
     `conclusionRecordOf` (after its sight test) and R41 (viewer-free), so the two cannot read a row differently. */
  static #recordIn(fm, pid, inquiryId) {
    const rows = Array.isArray(fm.conclusions) ? fm.conclusions : [];
    const s = (v) => (typeof v === "string" ? v : null);
    const want = String(inquiryId ?? "").trim();
    const history = [];
    for (const r of rows) {
      if (!r || typeof r !== "object" || String(r.inquiry ?? "").trim() !== want) continue;
      const by = s(r.by), at = s(r.at);
      const act = r.act === undefined ? "concluded" : s(r.act);
      const base = { project: pid, inquiry: want, relationship: "project", at, by };
      if (act === "concluded") {
        const commentary = s(r.commentary);
        history.push({ ...base, act: "concluded", state: "concluded", version: s(r.version), claim: s(r.claim),
                       claim_state: s(r.claim) ? "adopted" : "undetermined",
                       falsifier: s(r.falsifier) ?? "",
                       falsifier_override: s(r.falsifier_override_by)
                         ? { by: s(r.falsifier_override_by), at: s(r.falsifier_override_at) } : null,
                       commentary: commentary ? { text: commentary, by, at, evidence: false } : null,
                       /* R48: what a declared bias did to this conclusion, and the lens it was checked against */
                       bias_applied: readBiasApplied(r), bias_lens_sha: s(r.bias_statements_sha) });
      } else if (act === "withdrawn") {
        history.push({ ...base, act: "withdrawn", state: "withdrawn", version: s(r.withdraws_version),
                       withdraws_at: s(r.withdraws_at), reason: s(r.reason) ?? "" });
      } else {
        history.push({ ...base, act: "unrecognised", state: "undetermined", recorded_act: act,
                       detail: localize("basis-versions.index.this_entry_names_an_act", "this entry names an act your team's Civicsmith does not know, so what the project stood on after it is undetermined rather than guessed.") });
      }
    }
    return { history, stance: history.length ? history[history.length - 1] : null };
  }

  /** R22 (N67): the stance, only while it is a conclusion; null when the project concluded nothing, withdrew its
   *  latest conclusion, wrote an act this module does not know, or cannot be seen. */
  conclusionOf(projectId, inquiryId, viewer) {
    const { stance } = this.conclusionRecordOf(projectId, inquiryId, viewer);
    return stance && stance.act === "concluded" ? stance : null;
  }

  /* §7.1 item 5: the one sentence every read gives for a conclusion that adopted no claim a reader can check. */
  static undeterminedClaim(why = null) {
    return { state: "undetermined", text: null, version: null,
             detail: why
               ? why
               : localize("basis-versions.index.this_conclusion_adopted_no_claim", "this conclusion adopted no claim a reader can check. It was written before a conclusion named the reading whose claim it adopts (INVESTIGATIVE-SESSION.md §7.1 items 5-6), so WHICH claim it concluded is undetermined — never back-filled from its conclusion text, which is the member's words and not a claim any reading stated.") };
  }

  /** R23: the inquiry's own conclusion, the no-project relationship's (null when its state is not `concluded`). Its
   *  claim is `adopted` only when the named reading is still carried and still states the claim frozen; else
   *  `undetermined` with why — a hand-written pair of frontmatter keys is not evidence of an adoption. A conclusion
   *  written before versions reads undetermined and is never back-filled. */
  noProjectConclusionOf(inquiryId) {
    const b = this.#one(`SELECT current_state FROM bundles WHERE bundle_id=?`, inquiryId);
    if (!b || b.current_state !== "concluded") return null;
    const text = this.#doc(inquiryId);
    const fm = text !== null ? (parseFrontmatter(text).data || {}) : {};
    const s = (v) => (typeof v === "string" ? v : null);
    const nv = (s(fm.conclusion_version) ?? "").trim(), nc = (s(fm.conclusion_claim) ?? "").trim();
    let claim = BasisVersions.undeterminedClaim();
    if (nv || nc) {
      const v = nv ? this.#one(`SELECT claim FROM inquiry_basis_versions WHERE bundle_id=? AND name=?`, inquiryId, nv) : null;
      const matches = !!v && !!nc && fmSafe(String(v.claim ?? "").trim()) === nc;
      claim = matches
        ? { state: "adopted", text: nc, version: nv }
        : BasisVersions.undeterminedClaim(
            localize("basis-versions.index.this_conclusion_names_reading_nv", "this conclusion names reading '{nv}' and a claim, but {v1}, so which claim was concluded cannot be established from the record and is undetermined (INVESTIGATIVE-SESSION.md §7.1 item 6) — never taken on the frontmatter's word.", { nv: String(nv.slice(0, 80)), v1: String(!v
              ? localize("basis-versions.index.the_inquiry_carries_no_such", "the inquiry carries no such reading")
              : localize("basis-versions.index.that_reading_does_not_state", "that reading does not state the claim recorded")) }));
    }
    return { project: null, inquiry: String(inquiryId), relationship: "no_project", state: "concluded",
             relationship_established: false,
             relationship_detail: localize("basis-versions.index.this_conclusion_is_written_in", "this conclusion is written in the inquiry's own bytes and names no project, so the relationship that drew it cannot be established; it is read as the no-project relationship's (INVESTIGATIVE-SESSION.md §7.1 item 5)."),
             conclusion: s(fm.conclusion), falsifier: s(fm.falsifier) ?? "", claim };
  }

  /** R42 (N392, K593): the single-bundle projection's `no_project_conclusion` (retrieval R56), exactly as R11 answers
   *  it for the same viewer: R23's answer for an inquiry the viewer may see, else null; null for every other type. */
  projectionDecoration(row, { viewer = null } = {}) {
    const id = row && typeof row.bundle_id === "string" ? row.bundle_id : "";
    const inquiry = !!id && normalizeType(row.object_type) === "inquiry";
    try {
      return { no_project_conclusion: inquiry && this.#seen(id, viewer) ? this.noProjectConclusionOf(id) : null };
    } catch { return { no_project_conclusion: null }; }   /* never throws: a failure reads null */
  }

  /** R37 (N64): each project the viewer may see that draws on the inquiry — its document holds a `cites` reference to
   *  it not marked `severed`, R13's own test — in id order, `{id, title, current}`. Bounded at 32 projects, measured by
   *  reading one past the bound; the list carries `bound` and `truncated`. Writes nothing; never throws. */
  projectsDrawingOn(inquiryId, viewer) {
    const out = [];
    out.bound = PROJECTS_DRAWING_MAX;
    out.truncated = false;
    try {
      const inq = String(inquiryId ?? "").trim();
      if (!inq) return out;
      const gate = this.#gate("bx.bundle_id", viewer);
      /* Candidates are read in pages until one past the bound DRAWS on the question (a severed citer takes no slot),
         and at most PROJECTS_DRAWING_EXAMINED candidates are examined; reaching that cap with more left is truncation. */
      let after = "", examined = 0;
      for (;;) {
        const page = this.#rows(
          `SELECT DISTINCT rf.bundle_id AS pid, bx.title AS title FROM refs rf
            JOIN bundles bx ON bx.bundle_id = rf.bundle_id
            WHERE rf.target_id=? AND rf.kind='cites' AND bx.object_type='project' AND rf.bundle_id > ? AND (${gate.sql})
            ORDER BY rf.bundle_id LIMIT ?`, inq, after, ...gate.args, PROJECTS_DRAWING_MAX + 1);
        for (const r of page) {
          after = r.pid;
          if (examined++ >= PROJECTS_DRAWING_EXAMINED) { out.truncated = true; return out; }
          const text = this.#doc(r.pid);
          if (text === null) continue;
          if (!drawsOn(parseFrontmatter(text).data || {}, inq)) continue;
          if (out.length === PROJECTS_DRAWING_MAX) { out.truncated = true; return out; }
          out.push({ id: r.pid, title: r.title ?? null, current: this.currentOf(r.pid, inq, viewer) });
        }
        if (page.length <= PROJECTS_DRAWING_MAX) break;
      }
    } catch { /* never throws: what was read so far stands */ }
    return out;
  }

  /** R41 (N300): the inquiries a project draws on, by R13's own test, in id order after `after`, each with whether its
   *  basis holds a leg (inquiry R16's `basisFor`, limit 1) and the project's stance by R22. Viewer-free: its caller
   *  (`project-stage` R2, was publication R45) fences the project. The candidates are the document's live `cites`
   *  targets that the record holds as inquiries, read in one bounded statement, one past the page, so `cursor` (the
   *  last answered) is set only when more follow. `limit` absent, zero or not a number reads as 500, a negative one as 1 (connections R42's reading).
   *  Writes nothing; never throws: an empty or non-project id, or a project with no document, answers `items: []`; a
   *  `basisFor` that throws reads as no leg, so a failing read never cuts a page short behind a null cursor. */
  projectQuestions({ project = null, after = null, limit = null } = {}) {
    const out = { items: [], cursor: null };
    try {
      const pid = String(project ?? "").trim();
      if (!pid) return out;
      const p = this.#one(`SELECT object_type FROM bundles WHERE bundle_id=?`, pid);
      if (!p || normalizeType(p.object_type) !== "project") return out;
      const text = this.#doc(pid);
      if (text === null) return out;
      const fm = parseFrontmatter(text).data || {};
      const live = [...new Set((Array.isArray(fm.references) ? fm.references : [])
        .filter((x) => x && typeof x === "object" && x.rel === "cites" && x.status !== "severed")
        .map((x) => String(x.target ?? "").trim()).filter(Boolean))];
      if (!live.length) return out;
      const n = Math.floor(Number(limit));
      const cap = !Number.isFinite(n) || n === 0 ? PROJECT_QUESTIONS_MAX : Math.max(1, Math.min(PROJECT_QUESTIONS_MAX, n));
      const rows = this.#rows(
        `SELECT bundle_id FROM bundles WHERE bundle_id IN (SELECT value FROM json_each(?))
            AND object_type IN (SELECT value FROM json_each(?)) AND bundle_id > ?
          ORDER BY bundle_id LIMIT ?`, JSON.stringify(live), INQUIRY_TYPES, String(after ?? ""), cap + 1);
      for (const r of rows.slice(0, cap)) {
        /* a read that fails reads as one that answered no leg (not ok), so the page and its cursor stay whole */
        let basis = null;
        try { basis = this.inquiry.basisFor(r.bundle_id, { limit: 1 }); } catch { basis = null; }
        const { stance } = BasisVersions.#recordIn(fm, pid, r.bundle_id);
        out.items.push({ inquiry: r.bundle_id, legs: !!basis?.ok && Array.isArray(basis.legs) && basis.legs.length > 0,
                         stance: stance ? stance.state : "none" });
      }
      if (rows.length > cap) out.cursor = out.items[out.items.length - 1].inquiry;
    } catch { /* never throws: what was read so far stands */ }
    return out;
  }

  /** R50 (T47; N974, K3003, K3027 doubts 5, 7; `op=projectquestions`): R41 served to a viewer. A project the viewer may
   *  not see (membership R80), an absent one and one that is not a project answer alike, an empty page and never a
   *  refusal (R33). Otherwise R41's page less each inquiry the viewer may not see, left out unannounced and uncounted,
   *  each item carrying the inquiry's title as the record holds it (record-core R34); the cursor is R41's, so a page may
   *  hold fewer than `limit` and no inquiry is skipped. Writes nothing; never throws. */
  projectQuestionsFor({ project = null, after = null, limit = null, viewer = null } = {}) {
    let empty = { ok: true, project: null, items: [], cursor: null };
    try {
      const pid = String(project ?? "").trim();
      empty = { ...empty, project: pid };
      if (!pid || !this.membership.inSight(pid, viewer)) return empty;
      const p = this.record.bundleInfo(pid);
      if (!p || normalizeType(p.type) !== "project") return empty;
      const page = this.projectQuestions({ project: pid, after, limit });
      const items = [];
      for (const it of page.items) {
        if (!this.membership.inSight(it.inquiry, viewer)) continue;
        items.push({ ...it, title: this.record.bundleInfo(it.inquiry)?.title ?? null });
      }
      return { ok: true, project: pid, items, cursor: page.cursor };
    } catch { return empty; }   /* never throws: a failure reads as nothing to show */
  }

  /** R39 (MK-1 (A), N67): what would carry a member's authored observation into the published record. From each root
   *  the evidence graph is walked through every basis leg AND every version leg (an older reading of the basis is still
   *  bytes a published finding can point at); an observation is a bundle holding an authored register row. `self`
   *  names roots that ARE observations; `via` a finding and the observation it rests on. One bounded statement. */
  testimonyReach(ids) {
    const roots = [...new Set((Array.isArray(ids) ? ids : []).filter((x) => typeof x === "string" && x))]
      .slice(0, TESTIMONY_REACH_MAX);
    if (!roots.length) return { self: [], via: [] };
    const rows = this.#rows(
      `WITH RECURSIVE reach(root, id, depth) AS (
         SELECT value, value, 0 FROM json_each(?)
         UNION
         SELECT r.root, e.target_id, r.depth + 1 FROM reach r
           JOIN (SELECT bundle_id, target_id FROM inquiry_basis
                 UNION SELECT bundle_id, target_id FROM inquiry_basis_version_legs) e
             ON e.bundle_id = r.id
          WHERE r.depth < ${TESTIMONY_REACH_DEPTH})
       SELECT DISTINCT reach.root AS root, reach.id AS observation, MIN(reach.depth) AS depth
         FROM reach JOIN register g ON g.bundle_id = reach.id AND g.authored = 1
        GROUP BY reach.root, reach.id
        LIMIT ?`, JSON.stringify(roots), TESTIMONY_REACH_MAX);
    return { self: rows.filter((r) => r.depth === 0).map((r) => r.root),
             via: rows.filter((r) => r.depth > 0).map((r) => ({ finding: r.root, observation: r.observation })) };
  }

  /* ===== R47 (K861; plane R10) — THIS MODULE'S SHARE OF THE INSTANCE'S FIGURES =====
   *
   * PL-1 / IS-1: the inquiry's alternative accounts of its evidence and their legs, reported so a purge can PROVE it
   * took them (D-113). A COUNT AND NOTHING ELSE: how many readings of the evidence exist is an operator fact, and what
   * they say is not an operator surface. Shaped as record-core R63's `counts(hid)` with its key list; `plane` registers
   * it under this module's name through record-core's `registerCounts` (`src/plane/stats.mjs`), and this module
   * registers nothing itself, so no figure is registered twice. `hid` is R63's: membership's `hiddenBundles(viewer)` (its R88), the bundles the caller
   * may not see, or null for a caller that sees every bundle and for the direct internal call (purge's proof among
   * them), which count whole. A version drops when its `bundle_id` is in `hid`, a leg when its `bundle_id` or its
   * `target_id` is (D-464: a count over rows the caller could not all read is a disclosure of existence).
   * `COALESCE(k, '')`: a NULL key names no bundle, and `NULL NOT IN (…)` is NULL, so without it the row would be
   * dropped. Synchronous; writes nothing. */
  static COUNT_KEYS = Object.freeze(["basisVersions", "basisVersionLegs"]);

  counts(hid = null) {
    const n = (table, keys) => {
      const conds = [], args = [];
      if (hid) for (const k of keys) { conds.push(`COALESCE(${k}, '') NOT IN ${hid.sql}`); args.push(...hid.args); }
      return this.#one(`SELECT count(*) c FROM ${table}${conds.length ? ` WHERE ${conds.join(" AND ")}` : ""}`, ...args).c;
    };
    return { basisVersions: n("inquiry_basis_versions", ["bundle_id"]),
             basisVersionLegs: n("inquiry_basis_version_legs", ["bundle_id", "target_id"]) };
  }

  /* ================================================================ the six acts (R12–R15; PL-2) */

  /** ACCEPT — adopt this reading of the evidence (§6 rule 4's ADOPT). */
  versionAccept(a)   { return this.#moveVersionState("accept", a); }
  /** REJECT — the construct's DISMISS. Carries an authored reason, always. */
  versionReject(a)   { return this.#moveVersionState("reject", a); }
  /** CONSIDER — the construct's DEFER: not decided, and saying so on the record. */
  versionConsider(a) { return this.#moveVersionState("consider", a); }
  /** REVERT — put a reading back where nobody had acted on it; not from `accepted` (§6 rule 5). */
  versionRevert(a)   { return this.#moveVersionState("revert", a); }
  /** CURRENT — what THIS PROJECT stands on (§7). Not a state in the machine. */
  versionCurrent(a)  { return this.#moveVersionState("current", a); }
  /** HIDE — the prune flag: hides and never deletes (D-214, DEC-29(b)). */
  versionHide(a)     { return this.#moveVersionState("hide", a); }

  /* ONE implementation with six entry points: every guard is written once (two implementations of one rule are what
     absorbed IS-6's control). The four beats: CHOOSE (inquiry and version named, never
     defaulted), SEE WHAT WILL BE REFUSED (`preview` runs every guard and writes nothing), AUTHOR THE REASON (never
     prefilled), RECEIPT (the answer and a Session Log entry carry the same facts). A machine identity is refused on
     every act (§4: the AI holds no op that accepts). */
  #moveVersionState(act, args) {
    const a = args || {};
    const to = VERSION_ACT_TO[act] ?? null;
    const preview = a.preview === true || a.preview === "1" || a.preview === "true";
    const refuse = (key, detail, extra) => {
      const row = VERSION_ACT_CHECKS[key];
      return { ok: false, reason: key, check: row.check, code: key, translation: row.translation, act, detail,
               ...(extra || {}) };
    };
    const target = String(a.target ?? "").trim();
    if (!target)
      return refuse("VERSION_ACT_NO_INQUIRY",
        localize("basis-versions.index.a_reading_belongs_to_one", "a reading belongs to one question: pass target=<INQ-…>. There is no default question and there must not be one."));
    if (!isInquiryId(target))
      return refuse("VERSION_ACT_NOT_AN_INQUIRY",
        localize("basis-versions.index.target_is_not_an_inquiry", "{target} is not an inquiry, so it holds no readings of its evidence to act on.", { target: String(target.slice(0, 60)) }), { target });
    const vname = String(a.version ?? "").trim();
    if (!vname)
      return refuse("VERSION_ACT_NO_VERSION",
        localize("basis-versions.index.a_question_can_hold_several", "a question can hold several readings of its evidence: pass version=<name>. Acting on the wrong one is worse than being asked which was meant."), { target });
    const who = String(a.author ?? "").trim();
    if (!who || isMachineIdentity(who))
      return refuse("MACHINE_CANNOT_MOVE_VERSION",
        localize("basis-versions.index.op_version_act_moves_what", "op=version{act} moves what the record stands on or shows, and the credential that called it is {v1}. A machine credential may COMPOSE an account of the evidence and propose it, and may never accept it, turn it down, set it aside, hide it, or make it what a project stands on. Sign in as a member.", { act: String(act), v1: String(who ? "a machine" : "unnamed") }), { target, version: vname });
    const b = this.#visible(target, a.viewer ?? null);
    if (!b)
      return refuse("VERSION_ACT_NO_SUCH_VERSION",
        localize("basis-versions.index.no_question_by_that_id_3", "no question by that id is readable here, so it holds no reading by that name either."),
        { target, version: vname });
    let text = this.#doc(target);
    if (text === null)
      return refuse("VERSION_ACT_UNWRITABLE",
        localize("basis-versions.index.this_question_has_no_readable", "this question has no readable file, so nothing about its readings can be moved."), { target, version: vname });
    const fm = parseFrontmatter(text).data || {};
    const rows = Array.isArray(fm.basis_versions) ? fm.basis_versions : [];
    const idx = rows.findIndex((r) => r && typeof r === "object" && String(r.name ?? "").trim() === vname);
    if (idx < 0)
      return refuse("VERSION_ACT_NO_SUCH_VERSION",
        localize("basis-versions.index.this_question_holds_no_reading_2", "this question holds no reading named '{vname}'. Readings are named so a member can ask for one by name, and a name nobody wrote is refused rather than matched to the nearest.", { vname: String(vname.slice(0, 60)) }),
        { target, version: vname, known: rows.map((r) => String(r?.name ?? "").trim()).filter(Boolean).slice(0, 20) });
    const row = rows[idx];
    const from = typeof row.state === "string" ? row.state.trim() : "";
    /* C-25.31 in its place (R12): a row the writer cannot address in place is told before any judgement of the move,
       so `preview` answers it as the act does (R14). `current` rewrites only the project (R15), asked below. */
    if (act !== "current" && setVersionField(text, vname, "hidden", row.hidden === true) === null)
      return refuse("VERSION_ACT_UNWRITABLE",
        localize("basis-versions.index.this_questions_version_block_could", "this question's version block could not be rewritten in place, so nothing was changed."), { target, version: vname });
    /* R52: every act that writes the question's document (all but `current`, which writes the project) */
    if (act !== "current") {
      const divided = this.#dividedRefusal(b, { act, version: vname });
      if (divided) return divided;
    }

    /* CASE-3 / CASE-4 / DEC-72 clause 3: a state move on a case member is refused and pointed at the route DEC-12
       built (reopen, move, publish a new edition). `hide` and `current` move no state (`to === null`) and stay open.
       Asked after the reading is located, so a mistyped name is told first. */
    if (to !== null) {
      const member = this.promotion.fact("caseMember", target);
      /* a refusal relayed from another module states its verdict and code here, never only through the spread (N411) */
      if (!member.ok)
        return { ...member, ok: false, reason: member.reason, code: member.code, act, target, version: vname };
      if (member.value)
        return refuse("PUBLISHED_CANNOT_MOVE_VERSION",
          localize("basis-versions.index.vname_belongs_to_a_question", "'{vname}' belongs to a question that is PUBLISHED, and a published case froze this finding at the version its members signed. Moving a reading from {v1} to {to} would change what this finding rests on underneath an edition already on the record, leaving it deriving something the published bytes contradict. Reopen it (op=reopen), move the reading, and publish what changed as a new edition — the route DEC-12 built for exactly this, and the one op=inquiryground and op=inquirydivide already send you down. The pinned edition keeps its own signature and keeps answering.", { vname: String(vname), v1: String(from || "no recorded state"), to: String(to) }),
          { target, version: vname, from, to, state: b.current_state });
    }

    const why = String(a.reason ?? "").trim();
    if (versionNeedsReason(to) && !why)
      return refuse("VERSION_NO_REASON",
        to === "rejected"
          ? localize("basis-versions.index.op_version_act_records_why", "op=version{act} records WHY. The record of what was turned down is the anti-omission instrument (§6 rule 4) and it is worthless without the reason.", { act: String(act) })
          : localize("basis-versions.index.op_version_act_records_why_2", "op=version{act} records WHY. Setting a reading aside without saying why leaves the next reader unable to tell a judgement from an oversight.", { act: String(act) }),
        { target, version: vname, from, to });
    /* C-25.32: a reason that arrived and cannot be stored is a different refusal from one that never arrived. */
    if (why.length > VERSION_REASON_MAX || /["\\\r\n]/.test(why)
        || (versionNeedsReason(to) && why.length < VERSION_REASON_MIN))
      return refuse("VERSION_REASON_MALFORMED",
        localize("basis-versions.index.a_reason_is_at_most", "a reason is at most {VERSION_REASON_MAX} characters and cannot contain a quote, a backslash, or a newline: the restricted frontmatter grammar has no escapes. A reason for setting a reading aside or turning it down is at least {VERSION_REASON_MIN} characters, the shortest the record keeps.", { VERSION_REASON_MAX: String(VERSION_REASON_MAX), VERSION_REASON_MIN: String(VERSION_REASON_MIN) }),
        { target, version: vname, reason_length: why.length });
    if (to !== null && !(VERSION_MACHINE.edges[from] || []).includes(to))
      return refuse("VERSION_ILLEGAL_TRANSITION",
        localize("basis-versions.index.vname_is_v1_and_op", "'{vname}' is {v1} and op=version{act} would make it {to}. The states are not a one-way ladder and being considered or turned down is reversible, but a reading a member ACCEPTED is a historical fact: it is corrected by turning it down or by putting it back under consideration, never by returning it to something nobody acted on.", { vname: String(vname), v1: String(from || "in no recorded state"), act: String(act), to: String(to) }),
        { target, version: vname, from, to, legal: VERSION_MACHINE.edges[from] || [] });

    /* The transitive basis cycle at the accept, through inquiry's ONE walk: a leg naming an inquiry that rests on
       this one is harmless while a proposal and a circle the moment a member makes it what the answer rests on. */
    if (to === "accepted") {
      const legRows = Array.isArray(fm.basis_version_legs) ? fm.basis_version_legs : [];
      const inqTargets = [...new Set(legRows
        .filter((l) => l && typeof l === "object" && String(l.version ?? "").trim() === vname
                    && typeof l.target === "string" && isInquiryId(l.target))
        .map((l) => l.target))];
      if (inqTargets.length) {
        /* the factory always wires inquiry's walk (N204: this module mints no FACT_UNAVAILABLE of its own) */
        const cycle = this.inquiry.cyclePath(target, inqTargets);
        if (cycle)
          return refuse("VERSION_BASIS_CYCLE",
            localize("basis-versions.index.accepting_vname_would_close_a", "accepting '{vname}' would close a cycle: {cycle}. An inquiry's basis is a DAG, and the chain above already rests on {target}.", { vname: String(vname), cycle: String(cycle.join(" -> ")), target: String(target) }), { target, version: vname, path: cycle });
      }
    }

    /* D-271 / DEC-32 clause 4: accepting a reading of several separately sufficient parts affirms each by name, and
       the record keeps the parts in its own order (tab-separated). Only on accept, and only when there is more than one
       part to affirm between. */
    let affirmedParts = null;
    if (to === "accepted") {
      const vlegs = Array.isArray(fm.basis_version_legs) ? fm.basis_version_legs : [];
      const declared = [...new Set(vlegs
        .filter((l) => l && typeof l === "object" && String(l.version ?? "").trim() === vname)
        .map((l) => String(l.ground ?? "").trim()).filter(Boolean))];
      const aff = BasisVersions.#affirmation(declared, a.affirmed);
      if (aff.incomplete)
        return refuse("VERSION_AFFIRMATION_INCOMPLETE", BasisVersions.#affirmationDetail(vname, aff.incomplete),
                      BasisVersions.#affirmationExtra(target, vname, aff.incomplete));
      affirmedParts = aff.parts;
    }

    /* MAKE-CURRENT's own checks (§7): the project is named, visible, draws on the question, and the actor joined it. */
    let projectId = null, projectRow = null;
    if (act === "current") {
      if (from !== "accepted")
        return refuse("VERSION_NOT_ACCEPTED",
          localize("basis-versions.index.vname_is_v1_current_implies", "'{vname}' is {v1}. Current implies accepted (§6 rule 5), and exploring an unaccepted reading is done by CALCULATING OVER IT rather than by making it what everyone stands on — once a stance is shared, designating one temporarily would move a whole team's ground so one member could examine a possibility.", { vname: String(vname), v1: String(from || "in no recorded state") }), { target, version: vname, from });
      projectId = String(a.project ?? "").trim();
      if (!projectId)
        return refuse("VERSION_CURRENT_NO_PROJECT",
          localize("basis-versions.index.pass_project_proj_what_a", "pass project=<PROJ-…>: what a project stands on is the project's own dated declaration, and there is no default project."), { target, version: vname });
      projectRow = this.#visible(projectId, a.viewer ?? null);
      /* REC-149: at EXISTENCE the positional C-70.1; NONE falls to the unchanged answer below. */
      if (!projectRow) { const existence = this.membership.existenceAct(projectId, a.viewer ?? null); if (existence) return existence; }
      if (!projectRow || normalizeType(projectRow.object_type) !== "project")
        return refuse("VERSION_CURRENT_UNRELATED",
          localize("basis-versions.index.projectid_is_not_a_project", "{projectId} is not a project readable here, so it holds no stance to move.", { projectId: String(projectId.slice(0, 60)) }),
          { target, version: vname, project: projectId });
      /* REC-134: sight is not authority; the actor must have JOINED the project (Membership v2 §7.5). */
      const denied = this.membership.projectAuthority(projectId, a.identity ?? null, "joined", "versioncurrent");
      if (denied) return denied;
      const ptext = this.#doc(projectId);
      if (!drawsOn(ptext !== null ? (parseFrontmatter(ptext).data || {}) : {}, target))
        return refuse("VERSION_CURRENT_UNRELATED",
          localize("basis-versions.index.projectid_does_not_draw_on", "{projectId} does not draw on {target}, so it has no stance on this question to move. Cite the question into the project first.", { projectId: String(projectId), target: String(target) }), { target, version: vname, project: projectId });
      /* C-25.31 on the project's side, before the receipt, so `preview` answers it as the act does (R14) */
      if (setCurrentVersionRow(ptext, target, vname, who, "") === null)
        return refuse("VERSION_ACT_UNWRITABLE",
          localize("basis-versions.index.projectid_s_current_versions_block", "{projectId}'s current_versions block could not be rewritten in place, so its stance cannot be recorded.", { projectId: String(projectId) }),
          { target, version: vname, project: projectId });
    }

    const when = this.now();
    const hidden = act === "hide" ? !(a.hidden === false || a.hidden === "false" || a.hidden === "0") : (row.hidden === true);
    const receipt = {
      ok: true, act, target, version: vname, from, to: to ?? from, moves_state: to !== null,
      hidden, reason: why || null, author: who, at: when, weight: "single",
      affirmed: affirmedParts === null ? null : affirmedParts.split("\t"),
      ...(act === "current" ? { project: projectId } : {}),
    };
    if (preview) {
      /* R49 under R14: accepting a machine's version asks the machine-passage read over its legs; the write asks it in
         R6's check of the promotion, so a preview asks it here, once, and answers the same refusal */
      if (to === "accepted" && from !== "accepted" && typeof row.author === "string" && isMachineIdentity(row.author.trim())) {
        const vlegs = Array.isArray(fm.basis_version_legs) ? fm.basis_version_legs : [];
        const asked = [];
        vlegs.forEach((l, i) => {
          if (l && typeof l === "object" && String(l.version ?? "").trim() === vname) asked.push(passageLeg(vname, i, l));
        });
        const refused = this.#machinePassageRefusal(asked, who);
        if (refused) return { ...refused, act, target, version: vname, preview: true, wrote: false };
      }
      return { ...receipt, preview: true, would: act, wrote: false };
    }

    /* R15 (REC-166): make-current writes only the project; the question is not promoted at all. */
    if (act === "current") {
      const p = this.#setProjectCurrentVersion(projectRow, target, vname, who, when, why);
      if (!p.ok) return { ...p, ok: false, reason: p.reason, act, target, version: vname, project: projectId };
      return receipt;
    }

    text = setVersionField(text, vname, "state", to === null ? from : to);
    if (to !== null && text !== null) {
      /* the attribution moves WITH the state, always; a move clears an earlier reason and affirmation */
      text = setVersionField(text, vname, "state_by", who);
      if (text !== null) text = setVersionField(text, vname, "state_at", when);
      if (text !== null) text = setVersionField(text, vname, "state_reason", why);
      if (text !== null) text = setVersionField(text, vname, "affirmed_parts", affirmedParts ?? "");
    }
    if (act === "hide" && text !== null) text = setVersionField(text, vname, "hidden", hidden);
    if (text === null)
      return refuse("VERSION_ACT_UNWRITABLE",
        localize("basis-versions.index.this_questions_version_block_could_2", "this question's version block could not be rewritten in place, so nothing was changed."), { target, version: vname });
    text = setScalar(text, "last_updated", `"${when}"`);
    text = appendSessionLog(text,
      localize("basis-versions.index.session_when_version_act_who", "### Session {when} | Version {act} | {who}\nTrigger: op=version{act_2} on {target}\nChanges: reading '{vname}' {v1}.\n{v2}", { when: String(when), act: String(act), who: String(who), act_2: String(act), target: String(target), vname: String(vname), v1: String(to === null
          ? `${hidden ? "hidden from" : "returned to"} the display` : `${from} to ${to}`), v2: String(why ? `Reason: ${why}\n` : "") }));
    const promoted = this.#repromote({ bundleId: target, base: b.bundle_sha, text, when, author: who,
      meta: { object_type: fm.object_type ?? b.object_type, title: fm.title, current_state: b.current_state,
              prior_state: fm.prior_state ?? null, created: fm.created, last_updated: when,
              criticality: fm.criticality ?? null } });
    if (!promoted.ok) return { ...promoted, ok: false, reason: promoted.reason, act, target, version: vname };
    return receipt;
  }

  /* D-271 / DEC-32 clause 4, R12, R53: accepting a reading of several separately sufficient parts affirms each by
     name. `declared` is the reading's distinct ground labels in its own order; `raw` is what the caller sent (a list, or
     a comma-separated string). One part or none asks nothing. `incomplete` names what is missing, what is unknown and
     `part`, the first part (in the reading's order) the answer does not name, or null when only unknown ones were sent. */
  static #affirmation(declared, raw) {
    if (declared.length <= 1) return { parts: null, incomplete: null };
    const list = raw == null || raw === "" ? [] : (Array.isArray(raw) ? raw : String(raw).split(","));
    const said = [...new Set(list.map((x) => String(x).trim()).filter(Boolean))];
    const missing = declared.filter((d) => !said.includes(d));
    const unknown = said.filter((x) => !declared.includes(x));
    if (missing.length || unknown.length)
      return { parts: null, incomplete: { declared, said, missing, unknown, part: missing[0] ?? null } };
    return { parts: declared.join("\t"), incomplete: null };
  }

  static #affirmationDetail(vname, { declared, missing, unknown }) {
    return localize("basis-versions.index.vname_rests_on_n_separately", "'{vname}' rests on {n} separately sufficient parts and this answer counts the STRONGEST of them, so accepting it is a claim that each one would carry the finding on its own. {notAffirmed}{notPart} Pass affirmed=<every part, comma-separated>. DEC-32 rule 4: this cannot be carried by omission or by default, because that is exactly how a finding gets strengthened by repackaging.",
      { vname: String(vname.slice(0, 60)), n: String(declared.length),
        notAffirmed: missing.length ? localize("basis-versions.index.not_affirmed_list", "Not affirmed: {list}.", { list: String(missing.slice(0, 8).join(", ")) }) : "",
        notPart: unknown.length ? localize("basis-versions.index.named_but_not_part_of", " Named but not part of this reading: {list}.", { list: String(unknown.slice(0, 8).join(", ")) }) : "" });
  }

  /* R53: the refusal also carries `part`, and its translation is the list's, filled with it (the row's own sentence
     when only unknown parts were named, so no part is missing to name). */
  static #affirmationExtra(target, vname, { declared, said, missing, unknown, part }) {
    return { target, version: vname, declared, affirmed: said, missing, unknown, part,
             ...(part === null ? {} : { translation: word("refusal.VERSION_AFFIRMATION_INCOMPLETE", { part }) }) };
  }

  /* The make-current pointer's ONE writer (R15): the pointer, `last_updated` and a Session Log entry with the reason,
     in one promotion of the PROJECT. */
  #setProjectCurrentVersion(projectRow, inquiryId, vname, who, when, why = "") {
    const pid = projectRow.bundle_id;
    const unwritable = (detail) => {
      const row = VERSION_ACT_CHECKS.VERSION_ACT_UNWRITABLE;
      return { ok: false, reason: "VERSION_ACT_UNWRITABLE", check: row.check, code: "VERSION_ACT_UNWRITABLE",
               translation: row.translation, detail };
    };
    const md = this.#doc(pid);
    if (md === null) return unwritable(localize("basis-versions.index.pid_has_no_readable_file", "{pid} has no readable file, so its stance cannot be recorded", { pid: String(pid) }));
    const pfm = parseFrontmatter(md).data || {};
    let text = setCurrentVersionRow(md, inquiryId, vname, who, when);
    if (text === null) return unwritable(localize("basis-versions.index.pid_s_current_versions_block_could", "{pid}'s current_versions block could not be rewritten in place", { pid: String(pid) }));
    text = setScalar(text, "last_updated", `"${when}"`);
    text = appendSessionLog(text,
      localize("basis-versions.index.session_when_stands_on_who", "### Session {when} | Stands on | {who}\nTrigger: op=versioncurrent on {inquiryId}\nChanges: this project now stands on reading '{vname}' of {inquiryId_2}.\n{v1}", { when: String(when), who: String(who), inquiryId: String(inquiryId), vname: String(vname), inquiryId_2: String(inquiryId), v1: String(why ? `Reason: ${why}\n` : "") }));
    return this.#repromote({ bundleId: pid, base: projectRow.bundle_sha, text, when, author: who,
      meta: { object_type: pfm.object_type ?? "project", title: pfm.title, current_state: pfm.current_state ?? "forming",
              prior_state: pfm.prior_state ?? null, created: pfm.created, last_updated: when,
              criticality: pfm.criticality ?? null } });
  }

  /* ================================================================ the conclusion (R16–R21; §7.1) */

  /** R16–R21, R48, R51 (`op=conclude`, `op=withdrawconclusion`): the conclusion family is `./conclude.mjs`'s (P6); one
   *  instance per host, reached on first use with the helpers it cannot reach itself. */
  get #conc() {
    return this.#concFamily ||= new ConcludeFamily({
      bv: this, visible: (...a) => this.#visible(...a), doc: (...a) => this.#doc(...a), one: (...a) => this.#one(...a),
      repromote: (...a) => this.#repromote(...a), dividedRefusal: (...a) => this.#dividedRefusal(...a),
      affirmation: BasisVersions.#affirmation, affirmationDetail: BasisVersions.#affirmationDetail,
      affirmationExtra: BasisVersions.#affirmationExtra, withVersion: BasisVersions.#withVersion });
  }
  conclude(a = {}) { return this.#conc.conclude(a); }
  withdrawConclusion(a = {}) { return this.#conc.withdrawConclusion(a); }

  /* ================================================================ appendVersion (R28) */

  /* R28, R51: `src` with one version, its grounds and its legs appended. The version row is written in the caller's
     field order with `state` and `hidden` after `relationship` (undefined skipped, null written as `null`): `state`
     is `suggested` unless `moved` says the version was written already moved ({state, by, at, affirmed}, R51), in which
     case `state_by`, `state_at`, an empty `state_reason` and `affirmed_parts` follow `hidden`, as a move writes them.
     Each ground and leg row is written in its own order (undefined, null and empty skipped), numbers bare, lists of
     numbers inline, text quoted. Null when a block cannot be extended in place. */
  static #withVersion(src, v, grounds, legs, moved = null) {
    const name = String(v.name ?? "");
    const vLines = [];
    const state = [`    state: "${moved ? moved.state : "suggested"}"`, `    hidden: false`,
                   ...(moved ? [`    state_by: ${quoted(moved.by)}`, `    state_at: ${quoted(moved.at)}`, `    state_reason: ""`,
                                `    affirmed_parts: ${quoted(moved.affirmed ?? "")}`] : [])];
    for (const [k, val] of Object.entries(v)) {
      if (k === "state" || k === "hidden" || val === undefined) continue;
      vLines.push(`${vLines.length ? "    " : "  - "}${k}: ${val === null ? "null" : typedValue(val)}`);
      if (k === "relationship") vLines.push(...state);
    }
    if (!("relationship" in v)) vLines.push(...state);
    const rowOf = (o) => {
      const lines = [`  - version: ${quoted(name)}`];
      for (const [k, val] of Object.entries(o || {})) {
        if (k === "version" || val === undefined || val === null || val === "") continue;
        lines.push(`    ${k}: ${typedValue(val)}`);
      }
      return lines.join("\n");
    };
    let text = appendFmRows(src, "basis_versions", [vLines.join("\n")]);
    const gRows = (Array.isArray(grounds) ? grounds : []).map(rowOf);
    const lRows = (Array.isArray(legs) ? legs : []).map(rowOf);
    if (text !== null && gRows.length) text = appendFmRows(text, "basis_version_grounds", gRows);
    if (text !== null && lRows.length) text = appendFmRows(text, "basis_version_legs", lRows);
    return text;
  }

  /** R28: appends ONE version, its grounds and its legs to the question's document, in `suggested` state and not
   *  hidden (a caller's `state` or `hidden` is never read), and promotes it, so R6 judges it. The version row is written
   *  in the caller's field order with `state` and `hidden` after `relationship` (undefined skipped, null written as
   *  `null`); each ground and leg row in its own order (undefined, null and empty skipped), numbers bare, lists of
   *  numbers inline, text quoted. Whether the composition differs in substance from every held version is the
   *  caller's check. The documented call is `appendVersion({target, version: {name, description, claim?, relationship,
   *  derived_from?, kind?, run?, level?, observed_at?, author}, grounds, legs, author, at?, log?})`: `version.author` is
   *  the version's author as the record holds it, written on the row like every other field (`run-productions` R4 passes
   *  the machine identity whose run proposed it), and it is the field R49's accept arm reads to tell a machine-authored
   *  version; the outer `author` is only who promotes. Refusals: `NO_SUCH_BUNDLE`, `NOT_AN_INQUIRY`, `NO_DOCUMENT`,
   *  `UNSPLICEABLE_BASIS`; promote's own come back unchanged. */
  appendVersion({ target, version, grounds = [], legs = [], author, run, kind, at, log } = {}) {
    const tgt = String(target ?? "").trim();
    const b = this.#held(tgt);
    if (!b) return { ok: false, reason: "NO_SUCH_BUNDLE", target: tgt || null };
    if (normalizeType(b.object_type) !== "inquiry")
      return { ok: false, reason: "NOT_AN_INQUIRY", target: tgt, object_type: b.object_type };
    /* R52: a divided question's document is closed to a machine's proposal as to a member's act */
    const divided = this.#dividedRefusal(b);
    if (divided) return divided;
    const src = this.#doc(tgt);
    if (src === null) return { ok: false, reason: "NO_DOCUMENT", target: tgt };
    const fm0 = parseFrontmatter(src).data || {};
    const v = version && typeof version === "object" ? { ...version } : {};
    if (kind !== undefined && v.kind === undefined) v.kind = kind;
    if (run !== undefined && v.run === undefined) v.run = run;
    const when = at || this.now();
    const name = String(v.name ?? "");
    let text = BasisVersions.#withVersion(src, v, grounds, legs);
    if (text === null)
      return { ok: false, reason: "UNSPLICEABLE_BASIS", target: tgt,
               detail: localize("basis-versions.index.this_questions_version_block_is", "this question's version block is in a shape the restricted frontmatter grammar cannot extend in place, so nothing was written.") };
    text = setScalar(text, "last_updated", `"${when}"`);
    text = appendSessionLog(text, typeof log === "string" && log
      ? log
      : localize("basis-versions.index.session_when_version_appended_author", "### Session {when} | Version appended | {author}\nTrigger: appendVersion on {tgt}\nChanges: reading '{fmSafe}' added, in state suggested.\n", { when: String(when), author: String(author), tgt: String(tgt), fmSafe: String(fmSafe(name)) }));
    return this.#repromote({ bundleId: tgt, base: b.bundle_sha, text, when, author,
      meta: { object_type: fm0.object_type ?? b.object_type, title: fm0.title, current_state: b.current_state,
              prior_state: fm0.prior_state ?? null, created: fm0.created, last_updated: when,
              criticality: fm0.criticality ?? null } });
  }

  /* ================================================================ narrowing (R24–R27; REC-86) */

  /** R40: one module registers the source of passages an extract run proposed (R25's extract arm). The slot takes one
   *  registration whoever makes it; a malformed or second registration is refused by membership's one site (its R81). */
  onCandidates(module, fn) {
    const refused = listenerRefusal(this.#candidateSource, module, fn);
    if (refused) return refused;
    this.#candidateSource = { module, fn };
    return { ok: true, module };
  }

  /* R24: the citation both reads name: the inquiry, the version, the leg, and the content row it resolves to today. */
  #narrowSource({ target = null, version = null, ord = null, viewer = null } = {}) {
    const refusal = (code, detail, extra) => {
      const row = NARROW_CHECKS[code];
      return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail, ...(extra || {}) };
    };
    const tgt = String(target ?? "").trim();
    const vname = String(version ?? "").trim();
    const ordRaw = String(ord ?? "").trim();
    /* DEC-49 REGION is-narrow-source */
    const b = tgt ? this.#visible(tgt, viewer) : null;
    if (!b || normalizeType(b.object_type) !== "inquiry")
      return refusal("NARROW_NO_INQUIRY",
        tgt ? localize("basis-versions.index.no_question_by_the_id", "no question by the id '{tgt}' is readable here. A question you may not see answers exactly as one that does not exist.", { tgt: String(tgt.slice(0, 60)) })
            : localize("basis-versions.index.pass_target_inq_the_question", "pass target=<INQ-…>: the question whose reading holds the citation."), { target: tgt || null });
    const text = this.#doc(b.bundle_id);
    const fm = text !== null ? (parseFrontmatter(text).data || {}) : {};
    const versions = Array.isArray(fm.basis_versions) ? fm.basis_versions : [];
    const vrow = vname ? versions.find((r) => r && typeof r === "object" && String(r.name ?? "").trim() === vname) : null;
    if (!vrow)
      return refusal("NARROW_NO_SUCH_VERSION",
        vname ? localize("basis-versions.index.bundle_id_holds_no_reading", "{bundle_id} holds no reading named '{vname}'.{v1}", { bundle_id: String(b.bundle_id), vname: String(vname.slice(0, 64)), v1: String(versions.length ? "" : localize("basis-versions.index.it_holds_no_readings_at_all", " It holds no readings at all: the live basis is not a reading, and a citation on it is made more specific by a reading taken from it.")) })
              : localize("basis-versions.index.pass_version_the_name_of", "pass version=<the name of the reading that holds the citation>."),
        { target: b.bundle_id, version: vname || null,
          known: versions.map((r) => String(r?.name ?? "").trim()).filter(Boolean).slice(0, 20) });
    const legRows = (Array.isArray(fm.basis_version_legs) ? fm.basis_version_legs : [])
      .filter((l) => l && typeof l === "object" && String(l.version ?? "").trim() === vname);
    const k = /^\d+$/.test(ordRaw) ? parseInt(ordRaw, 10) : -1;
    if (k < 0 || k >= legRows.length)
      return refusal("NARROW_NO_SUCH_LEG",
        localize("basis-versions.index.the_reading_vname_has_length", "the reading '{vname}' has {length} piece(s) of evidence, counted from 0, and {v1} was named.", { vname: String(vname), length: String(legRows.length), v1: String(ordRaw ? `'${ordRaw.slice(0, 12)}'` : "no position") }),
        { target: b.bundle_id, version: vname, ord: ordRaw || null, legs: legRows.length });
    const leg = legRows[k];
    /* the row the projection resolved for this leg: one answer to "which part", never a second derivation */
    const proj = this.#one(`SELECT target_id, content_id FROM inquiry_basis_version_legs WHERE bundle_id=? AND name=? AND ord=?`,
                           b.bundle_id, vname, k);
    const row = proj && proj.content_id ? this.content.contentRow(proj.content_id) : null;
    if (!proj || proj.target_id !== leg.target || !row)
      return refusal("NARROW_NO_PART",
        isInquiryId(leg.target)
          ? localize("basis-versions.index.piece_k_of_vname_rests", "piece {k} of '{vname}' rests on another question ({target}), which has no part to name.", { k: String(k), vname: String(vname), target: String(leg.target) })
          : localize("basis-versions.index.piece_k_of_vname_rests_2", "piece {k} of '{vname}' rests on {target}, and this record resolves no part of it — it holds no copy of that document to point into.", { k: String(k), vname: String(vname), target: String(leg.target) }),
        { target: b.bundle_id, version: vname, ord: k, leg_target: leg.target ?? null });
    /* END DEC-49 REGION is-narrow-source */
    const extent = row.extent && typeof row.extent === "object" ? row.extent : { kind: row.extent_kind };
    return { ok: true, b, fm, text, vrow, vname, legRows, k, leg, row, extent };
  }

  /* R25: the machine's proposals for one leg, strictly NARROWER than it and in the same capture, per source. */
  #narrowCandidateList(src) {
    const cap = src.row.capture_sha;
    const subject = typeof src.fm.subject_entity === "string" && src.fm.subject_entity.trim()
      ? src.fm.subject_entity.trim() : null;
    const max = NARROW_CANDIDATES_MAX;
    const out = [];
    const seen = new Set();
    let truncated = false;
    const counts = { reading: 0, extract: 0, marked: 0 };
    const push = (c) => {
      c.fields = c.content_id ? { content_id: c.content_id } : extentLegFields(c.extent);
      const key = canonicalExtent(c.extent);
      if (seen.has(key)) return;
      if (extentRelation(src.extent, c.extent) !== "narrower") return;
      seen.add(key);
      if (counts[c.source] >= max) { truncated = true; return; }
      counts[c.source] += 1;
      out.push(c);
    };
    /* (1) where the record's own reading found a reference; whether it names the subject is three-valued (null when
       the question names none). One bounded read, the subject test folded in (extraction R58, entities' resolutions). */
    const refRows = this.#rows(
      `SELECT rr.ref AS ref, rr.label AS label, rr.pos_kind AS pos_kind, rr.pos AS pos, rr.pos_ref AS pos_ref,
              EXISTS (SELECT 1 FROM resolutions r
                       WHERE r.capture_sha = rr.capture_sha AND r.ref = rr.ref AND r.entity_id = ?) AS named
         FROM reading_refs rr
        WHERE rr.capture_sha=? AND rr.pos_kind IS NOT NULL ORDER BY rr.ref, rr.seq LIMIT ?`, subject ?? "", cap, max * 4 + 1);
    if (refRows.length > max * 4) truncated = true;
    for (const r of refRows) {
      const pos = readingSourceFromColumns(r.pos_kind, r.pos, r.pos_ref);
      if (!pos) continue;
      push({ source: "reading", ref: pos.ref, extent: { kind: pos.kind, ...posFields(pos) },
             reference: r.ref, label: r.label ?? null, mentions_subject: subject ? !!r.named : null,
             content_id: null, mint: mintLabel(CONTENT_MINTED_BY_PLANE), machine_work: true,
             says: word("basis-versions.says.record_reading_document", { ref: String(String(r.ref).slice(0, 80)), ref2: String(pos.ref) }) });
    }
    /* (2) what an extract run proposed, through the candidate source run-productions registers (R40; K73 (2), K3257) */
    if (this.#candidateSource) {
      let ext = null;
      try { ext = this.#candidateSource.fn({ captureSha: cap, max }); } catch { ext = null; }
      const extRows = ext && Array.isArray(ext.rows) ? ext.rows : [];
      if (ext && ext.truncated) truncated = true;
      for (const r of extRows) {
        const pos = r.position && typeof r.position === "object" ? r.position
          : readingSourceFromColumns(r.pos_kind, r.pos, r.pos_ref);
        if (!pos) continue;
        push({ source: "extract", ref: pos.ref, extent: { kind: pos.kind, ...posFields(pos) },
               reference: r.ref, label: r.label ?? null, run: r.run, mentions_subject: null,
               content_id: r.content_id ?? null, mint: mintLabel(r.proposed_by), machine_work: true,
               says: word("basis-versions.says.machine_proposed_passage", { run: String(r.run) }) });
      }
    }
    /* (3) rows a machine marked citable (content R45's read contract) */
    const markRows = this.#rows(
      `SELECT content_id, extent_kind, extent, ref, minted_by FROM content
        WHERE capture_sha=? AND extent_kind <> 'document' ORDER BY at, content_id LIMIT ?`, cap, max * 4 + 1);
    for (const r of markRows) {
      if (contentMintState(r.minted_by) !== "machine_marked") continue;
      push({ source: "marked", ref: r.ref, extent: { kind: r.extent_kind, ...(safeJson(r.extent) || {}) },
             reference: null, label: null, mentions_subject: null, content_id: r.content_id,
             mint: mintLabel(r.minted_by), machine_work: true,
             says: word("basis-versions.says.machine_marked_passage") });
    }
    /* subject mentions first — the one ordering the record can defend — then as read */
    out.sort((x, y) => (y.mentions_subject === true) - (x.mentions_subject === true));
    return { candidates: out, counts, truncated, subject,
             read: !!this.#one(`SELECT 1 AS x FROM readings WHERE capture_sha=?`, cap) };
  }

  /** R24, R25 (`op=narrowcandidates`): a READ. Every entry is machine work and a proposal; listing it writes nothing.
   *  With none, the absence is stated by level (never read, or read and nothing inside). */
  narrowCandidates({ target = null, version = null, ord = null, viewer = null } = {}) {
    const src = this.#narrowSource({ target, version, ord, viewer });
    if (!src.ok) return src;
    const list = this.#narrowCandidateList(src);
    const leg = { target: src.leg.target, content_id: src.row.content_id, ref: src.row.ref,
                  extent: src.extent, capture_sha: src.row.capture_sha };
    const absence = list.candidates.length ? null
      : !list.read
        ? { level: "document", says: word("basis-versions.says.copy_document_read") }
        : { level: "content", says: word("basis-versions.says.document_read_machine") };
    return { ok: true, target: src.b.bundle_id, version: src.vname, ord: src.k, leg,
             subject: list.subject, candidates: list.candidates, counts: list.counts,
             limit: NARROW_CANDIDATES_MAX, truncated: list.truncated, absence, proposal_only: true,
             says: localize("basis-versions.index.every_entry_here_is_machine_work", "every entry here is MACHINE WORK and a PROPOSAL. Listing it wrote nothing and cited nothing; which passage is on point to this question is the member's judgment, made by op=narrow in the member's own name.") };
  }

  /** R24, R26, R27 (`op=narrow`): THE ACT. A new version `suggested`, `derived_from` the old, identical but for the
   *  one leg, which names the part (pinned to the old leg's capture) and carries no grade; the old version is untouched
   *  (Bob's 5.8: the act makes a new reading, it does not rewrite the one somebody may stand on). */
  narrow(a = {}) {
    const args = a || {};
    const refusal = (code, detail, extra) => {
      const row = NARROW_CHECKS[code];
      return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail, ...(extra || {}) };
    };
    const src = this.#narrowSource(args);
    if (!src.ok) return src;
    /* R52: a divided question's document is closed to narrowing as to any revision */
    const divided = this.#dividedRefusal(src.b);
    if (divided) return divided;
    const who = String(args.author ?? "").trim();
    const name = String(args.name ?? "").trim();
    const nameWritten = fmSafe(name);
    const description = String(args.description ?? "").trim();
    const bag = args.extent && typeof args.extent === "object" ? args.extent : {};
    const authored = Object.keys(bag).filter((k) => String(bag[k] ?? "").trim() !== "").sort();
    const legFields = {};
    let chosenRow = null;
    /* DEC-49 REGION is-narrow-extent */
    if (!who || isMachineIdentity(who))
      return refusal("NARROW_NOT_A_MEMBER",
        who ? localize("basis-versions.index.who_is_a_machine_credential", "'{who}' is a machine credential. It may propose passages (op=narrowcandidates lists them); choosing which one a citation rests on is a member's act.", { who: String(who.slice(0, 60)) })
            : localize("basis-versions.index.this_act_names_no_member", "this act names no member, and a choice nobody made is not a choice."), { target: src.b.bundle_id });
    const unknown = Object.keys(bag).filter((k) => !(k in EXTENT_FIELDS)).sort();
    if (unknown.length)
      return refusal("NARROW_BAD_EXTENT",
        localize("basis-versions.index.this_call_names_map_which", "this call names {map}, which this act does not take. The fields it takes are: {keys}.", { map: String(unknown.map((k) => `'${k}'`).join(", ")), keys: String(Object.keys(EXTENT_FIELDS).join(", ")) }), { got: unknown });
    if (!authored.length)
      return refusal("NARROW_NO_EXTENT",
        localize("basis-versions.index.pass_extent_the_part_of", "pass extent={…}: the part of the document the citation should now point at, or the content_id of a proposed passage."), { target: src.b.bundle_id });
    for (const k of authored) {
      const raw = String(bag[k]).trim();
      if (raw.length > 200 || /["\\\r\n#]/.test(raw))
        return refusal("NARROW_BAD_EXTENT",
          localize("basis-versions.index.k_cannot_be_written_into", "'{k}' cannot be written into the record as it stands: at most 200 characters, and no quotation mark, backslash, line break or comment mark.", { k: String(k) }), { field: k });
      const t = EXTENT_FIELDS[k];
      if (t === "int" && /^\d+$/.test(raw)) legFields[k] = parseInt(raw, 10);
      else if (t === "nums") {
        const parts = raw.replace(/^\[|\]$/g, "").split(",").map((s) => s.trim());
        const nums = parts.map((s) => (/^-?\d+(\.\d+)?$/.test(s) ? parseFloat(s) : NaN));
        legFields[k] = nums.every((n) => Number.isFinite(n)) ? nums : raw;
      } else legFields[k] = raw;
    }
    if (legFields.content_id !== undefined) {
      if (authored.length > 1)
        return refusal("NARROW_BAD_EXTENT",
          localize("basis-versions.index.this_call_names_a_content", "this call names a content id AND describes a part: one fact written twice, which can disagree. Send one or the other."), { got: authored });
      chosenRow = this.content.contentRow(String(legFields.content_id));
      if (!chosenRow)
        return refusal("NARROW_BAD_EXTENT",
          localize("basis-versions.index.content_id_string_names_no", "content id '{String}…' names no part this record holds.", { String: String(String(legFields.content_id).slice(0, 16)) }),
          { content_id: String(legFields.content_id) });
      if (chosenRow.bundle_id !== src.leg.target || chosenRow.capture_sha !== src.row.capture_sha)
        return refusal("NARROW_OTHER_CAPTURE",
          localize("basis-versions.index.the_citation_rests_on_target", "the citation rests on {target} as captured at {capture_sha}…, and the part named is {v1}.", { target: String(src.leg.target), capture_sha: String(src.row.capture_sha.slice(0, 12)), v1: String(chosenRow.bundle_id === src.leg.target
            ? localize("basis-versions.index.in_a_different_copy_of", "in a DIFFERENT copy of it ({capture}…)", { capture: String(chosenRow.capture_sha).slice(0, 12) })
            : localize("basis-versions.index.in_a_different_document_bundle", "in a different document ({bundle_id})", { bundle_id: String(chosenRow.bundle_id) })) }),
          { from_capture: src.row.capture_sha, to_capture: chosenRow.capture_sha, to_bundle: chosenRow.bundle_id });
    }
    /* END DEC-49 REGION is-narrow-extent */
    /* the grammar is the leg grammar's ONE checker, answered under op=promote's own name (inquiry R5) */
    if (!chosenRow) {
      const ef = [];
      checkLegExtentGrammar(legFields, "the part of the document this narrowing names", "C-25.10", ef);
      const errs = ef.filter((x) => x.severity === "error");
      if (errs.length)
        return { ok: false, reason: "BASIS_REFUSED", target: src.b.bundle_id,
                 findings: errs.map((x) => ({ check: x.check, code: x.code ?? null, detail: x.message,
                                              repairs: x.repairs ?? [] })),
                 detail: localize("basis-versions.index.the_part_named_is_refused", "the part named is refused by the SAME catalog function op=promote runs at the write, so nothing was written.") };
    }
    const newExtent = chosenRow ? chosenRow.extent : legExtent(legFields);
    const relation = extentRelation(src.extent, newExtent);
    const existingNames = new Set((Array.isArray(src.fm.basis_versions) ? src.fm.basis_versions : [])
      .map((r) => String(r?.name ?? "").trim()));
    /* DEC-49 REGION is-narrow-claim */
    if (relation !== "narrower")
      return refusal("NARROW_NOT_NARROWER",
        localize("basis-versions.index.the_citation_points_at_ref", "the citation points at {ref} and the part named ({describeExtent}) is {v1}. Narrowing only ever points a citation at less of its document.", { ref: String(src.row.ref), describeExtent: String(describeExtent(newExtent)), v1: String(relation === "same" ? localize("basis-versions.index.that_same_part", "that same part")
          : relation === "wider" ? localize("basis-versions.index.wider_than_it", "WIDER than it")
          : relation === "disjoint" ? localize("basis-versions.index.a_different_place_not_a", "a different place, not a part of it")
          : localize("basis-versions.index.not_one_this_record_can", "not one this record can compare with it")) }),
        { relation, from: src.extent, to: newExtent });
    if (!name || !VERSION_NAME_RE.test(name) || existingNames.has(nameWritten))
      return refusal("NARROW_NAME",
        !name ? localize("basis-versions.index.pass_name_a_name_for", "pass name=<a name for the new reading>.")
          : existingNames.has(nameWritten)
            ? localize("basis-versions.index.name_already_names_a_reading", "'{name}' already names a reading of {bundle_id}{v1}", { name: String(name.slice(0, 64)), bundle_id: String(src.b.bundle_id), v1: String(nameWritten === src.vname
              ? localize("basis-versions.index.it_is_the_reading_being", " — it is the reading being narrowed, and reusing its name would change it in place.") : `.`) })
            : localize("basis-versions.index.name_is_not_a_name", "'{name}' is not a name a reading can carry: letters, digits, space, dot, dash and underscore, starting with a letter or digit, at most 64 characters.", { name: String(name.slice(0, 64)) }),
        { name: name || null, taken: existingNames.has(nameWritten) });
    if (!description || isBoilerplate(description))
      return refusal("NARROW_NO_DESCRIPTION",
        localize("basis-versions.index.pass_description_what_changed_and", "pass description=<what changed and why>: which citation now points at less of its document, and why that part is the one on point."), { name });
    /* END DEC-49 REGION is-narrow-claim */

    /* THE COMPOSITION — the source version copied, one leg re-pointed. The partition is carried and asserted in the
       narrowing member's name (C-25.6 asks a named member to stand behind each part; the old asserter is not copied). */
    const nowIso = this.now();
    const vr = src.vrow;
    const version = { name: nameWritten, description,
                      ...(vr.claim === undefined || vr.claim === null || vr.claim === "" ? {} : { claim: vr.claim }),
                      relationship: vr.relationship, derived_from: src.vname, author: who, at: nowIso };
    const grounds = (Array.isArray(src.fm.basis_version_grounds) ? src.fm.basis_version_grounds : [])
      .filter((g) => g && typeof g === "object" && String(g.version ?? "").trim() === src.vname)
      .map((g) => ({ ground: String(g.ground ?? ""), asserted_by: who, at: nowIso, statement: g.statement }));
    const LEG_KEYS = LEG_COPY_KEYS;
    const EXTENT_KEYS = new Set([...Object.keys(EXTENT_FIELDS), "extent_capture"]);
    const GRADE_KEYS = new Set(["grade", "grade_axis", "grade_source"]);
    const dropped = {};
    const legs = src.legRows.map((l, i) => {
      const o = {};
      for (const key of LEG_KEYS) {
        if (i === src.k && (EXTENT_KEYS.has(key) || GRADE_KEYS.has(key))) {
          if (GRADE_KEYS.has(key) && l[key] !== undefined && l[key] !== null && l[key] !== "") dropped[key] = l[key];
          continue;
        }
        o[key] = l[key];
      }
      if (i === src.k) {
        if (chosenRow) o.content_id = chosenRow.content_id;
        else {
          for (const [key, v] of Object.entries(legFields)) o[key] = v;
          /* the capture is PINNED, so the narrower row is minted against the same bytes (5.8) */
          o.extent_capture = src.row.capture_sha;
        }
      }
      return o;
    });
    /* was it one of the machine's proposals? derived here, never taken from the caller */
    const toKey = canonicalExtent(newExtent);
    const matched = this.#narrowCandidateList(src).candidates.find((c) => canonicalExtent(c.extent) === toKey) || null;
    const promoted = this.appendVersion({ target: src.b.bundle_id, version, grounds, legs, author: who, at: nowIso,
      log: localize("basis-versions.index.session_nowiso_narrowed_a_citation", "### Session {nowIso} | Narrowed a citation | {who}\nTrigger: op=narrow on {bundle_id}\nChanges: reading '{nameWritten}' derived from '{vname}', in state suggested; piece {k} ({target}) now points at {fmSafe} instead of {fmSafe_2}. '{vname_2}' is unchanged.{v1}{v2}\n", { nowIso: String(nowIso), who: String(who), bundle_id: String(src.b.bundle_id), nameWritten: String(nameWritten), vname: String(src.vname), k: String(src.k), target: String(src.leg.target), fmSafe: String(fmSafe(describeExtent(newExtent))), fmSafe_2: String(fmSafe(src.row.ref)), vname_2: String(src.vname), v1: String(matched ? localize("basis-versions.index.chosen_from_a_machine_proposal", " Chosen from a machine proposal ({source}).", { source: String(matched.source) }) : localize("basis-versions.index.named_by_the_member", " Named by the member.")), v2: String(Object.keys(dropped).length ? localize("basis-versions.index.the_old_grade_was_not", " The old grade was not carried: a part earns only from what is in it.") : ``) }) });
    if (!promoted.ok) return { ...promoted, target: src.b.bundle_id, name: nameWritten };
    const after = this.#one(`SELECT content_id FROM inquiry_basis_version_legs WHERE bundle_id=? AND name=? AND ord=?`,
                            src.b.bundle_id, nameWritten, src.k);
    const toRow = after && after.content_id ? this.content.contentRow(after.content_id) : null;
    const fromRow = this.#one(`SELECT content_id FROM inquiry_basis_version_legs WHERE bundle_id=? AND name=? AND ord=?`,
                              src.b.bundle_id, src.vname, src.k);
    return { ok: true, target: src.b.bundle_id, version: nameWritten, derived_from: src.vname,
             ord: src.k, state: "suggested", author: who,
             narrowed: {
               from: { content_id: src.row.content_id, ref: src.row.ref, extent: src.extent, still_held_by: src.vname,
                       unchanged: !!fromRow && fromRow.content_id === src.row.content_id },
               to: toRow
                 ? { content_id: toRow.content_id, ref: toRow.ref, extent: toRow.extent,
                     capture_sha: toRow.capture_sha, mint: mintLabel(toRow.minted_by) }
                 : { content_id: null, ref: describeExtent(newExtent), extent: newExtent },
             },
             chosen_from: matched ? { source: matched.source, machine_work: true, says: matched.says } : null,
             grade_not_carried: Object.keys(dropped).length
               ? { was: dropped,
                   why: localize("basis-versions.index.a_grade_was_earned_for", "a grade was earned for what the citation pointed at before; a part earns only from what is in it, so the narrowed piece is left ungraded and stated as such. op=earnedbasis answers what this part earns.") }
               : null,
             bundleSha: promoted.bundleSha ?? promoted.bundle_sha ?? null,
             version_content: promoted.version_content ?? [],
             says: word("basis-versions.says.new_reading_written", { name_written: String(nameWritten), vname: String(src.vname), k: String(src.k) }) };
  }
}

const instances = new WeakMap();

/** The one basis-versions instance for `host` (the Durable Object's `ctx`, with its `storage`); `deps` are read on the
 *  first call only. At creation it declares its tables (R34), joins every promotion (R6, R7) and registers its
 *  projection decoration (R42). */
export function basisVersionsOf(host, deps) {
  let bv = instances.get(host);
  if (!bv) {
    const d = deps || {};
    const record = d.record || recordOf(host);
    const membership = d.membership || membershipOf(host, { record });
    const promotion = d.promotion || promotionOf(host, { record, membership });
    const content = d.content || contentOf(host, { record, membership });
    /* inquiry's four services, each the one a test passes or else inquiry's own: the acts ask `cyclePath` unguarded.
       inquiry's instance is created here, as before R41, unless the first three are all passed; R41's `basisFor` then
       reaches it on first use, so a caller passing those three creates none until R41 is asked. */
    const given = d.inquiry || {};
    let own = ["earned", "legCapped", "cyclePath"].every((k) => typeof given[k] === "function") ? null
      : inquiryOf(host, { record, membership, promotion, content });
    const inquiry = {
      earned: typeof given.earned === "function" ? given.earned : (s, t, c) => own.earned(s, t, c),
      legCapped: typeof given.legCapped === "function" ? given.legCapped : legCapped,
      cyclePath: typeof given.cyclePath === "function" ? given.cyclePath : (id, t) => own.cyclePath(id, t),
      basisFor: typeof given.basisFor === "function" ? given.basisFor
        : (id, o) => (own ||= inquiryOf(host, { record, membership, promotion, content })).basisFor(id, o),
    };
    /* R3 (N522): accepted-work's instance (its R3 is an instance method, K1307), unless a test passes its own */
    const acceptedWork = d.acceptedWork && typeof d.acceptedWork.acceptedLegRefusals === "function" ? d.acceptedWork
      : acceptedWorkOf(host, { record, membership, promotion });
    /* R48: bias's instance on the same host (its R49), reached on first use so this module's start creates none */
    const bias = d.bias || (() => biasOf(host, { record, membership, promotion }));
    bv = new BasisVersions({ ...d, inquiry, acceptedWork, bias, storage: d.storage || host.storage, record, membership,
                             promotion, content });
    instances.set(host, bv);
    record.declarePurge("basis-versions", BASIS_VERSIONS_TABLES);
    registerBasisVersionGrammar(record);   /* R43: the version grammar in the C-2.8 slot, after inquiry-grammar's */
    promotion.registerStep("basis-versions", { check: (c) => bv.check(c), project: (c) => bv.project(c) });
    if (d.retrieval) d.retrieval.registerProjectionDecoration("basis-versions", (row, o) => bv.projectionDecoration(row, o));
  }
  return bv;
}

/** Which purge declaration names one of this module's tables (record-core R21: each owner declares its own). */
export function basisVersionsOwns(t) {
  const name = typeof t === "string" ? t : t && t.name;
  return BASIS_VERSIONS_TABLES.includes(name);
}

/* The Durable Object routes this module answers, as entries of the plane's op map (`plane`'s store,
   `src/plane/store.mjs`, spreads them in; K3). `url` carries the control plane's stamps — `viewer`, `author`,
   `identity` — and `body` the parsed body; no stamp is read from the body. */
export function basisVersionsOps(bv, url, body) {
  const q = (key) => url.searchParams.get(key);
  const b = body && typeof body === "object" ? body : null;
  /* ONE argument reader for all six acts: the reason and the hidden flag may arrive in the body; the stamps only in
     the query string (`identity` is REC-134's positional identity). */
  const versionArgs = () => {
    const v = (k) => (b && b[k] !== undefined ? b[k] : q(k));
    return { target: v("target"), version: v("version"), reason: v("reason"), project: v("project"),
             hidden: v("hidden"), preview: v("preview"), affirmed: v("affirmed"),
             author: q("author"), viewer: q("viewer"), identity: q("identity") };
  };
  return {
    basisversions: () => bv.basisVersions({ id: q("id"), limit: q("limit"), offset: q("offset"), viewer: q("viewer"),
                                            project: q("project") }),
    /* R50: the viewer is the URL's stamp, the rest the query's */
    /* R55: a read; the op's declaration is `op-declarations`' */
    versioncompare: () => bv.compareVersions({ target: q("target"), a: q("a"), b: q("b"), project: q("project"),
                                               viewer: q("viewer") }),
    projectquestions: () => bv.projectQuestionsFor({ project: q("project"), after: q("after"), limit: q("limit"),
                                                     viewer: q("viewer") }),
    versionaccept:  () => bv.versionAccept(versionArgs()),
    versionreject:   () => bv.versionReject(versionArgs()),
    versionconsider: () => bv.versionConsider(versionArgs()),
    versionrevert:   () => bv.versionRevert(versionArgs()),
    versioncurrent:  () => bv.versionCurrent(versionArgs()),
    versionhide:     () => bv.versionHide(versionArgs()),
    narrow: () => bv.narrow({
      target: (b && b.target) || q("target"), version: (b && b.version) || q("version"),
      ord: (b && b.ord !== undefined ? b.ord : null) ?? q("ord"),
      name: (b && b.name) || q("name"), description: (b && b.description) || q("description"),
      extent: b && b.extent && typeof b.extent === "object" ? b.extent : null,
      author: q("author"), viewer: q("viewer") }),
    narrowcandidates: () => bv.narrowCandidates({ target: q("target"), version: q("version"), ord: q("ord"),
                                                  viewer: q("viewer") }),
    /* `no_falsifier` is the member's own assertion, so it arrives from the caller; the stamps are identity only */
    conclude: () => bv.conclude({ target: q("target"), conclusion: q("conclusion"), falsifier: q("falsifier"),
                                  noFalsifier: q("no_falsifier"), project: q("project"), commentary: q("commentary"),
                                  version: q("version"), reading: q("reading"), preview: q("preview"),
                                  affirmed: b && b.affirmed !== undefined ? b.affirmed : q("affirmed"),
                                  /* R48: the list from the body, else its JSON from the query */
                                  biasApplied: b && b.bias_applied !== undefined ? b.bias_applied : q("bias_applied"),
                                  viewer: q("viewer"), author: q("author"), identity: q("identity") }),
    withdrawconclusion: () => bv.conclude({ withdraw: true, target: q("target"), project: q("project"), reason: q("reason"),
                                            viewer: q("viewer"), author: q("author"), identity: q("identity") }),
  };
}

/* R57 (T51; K4168; op-declarations R80, op-grades R49): the ops this module serves that the screens send, declared by their owner beside
   the ops map: each row's class, weight and description are the op's existing rows', its fields are what the arm reads. */
export const DECLARED_OPS = Object.freeze({
  versionaccept: { classes: ["admin","member","probe"], mutating: true, weight: "reversible", description: "act.versionaccept.does",
    fields: { accepts: ["target","version","reason","project","hidden","preview","affirmed"], requires: ["target","version"] } },
  versionreject: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", description: "act.versionreject.does",
    fields: { accepts: ["target","version","reason","project","hidden","preview","affirmed"], requires: ["target","version","reason"] } },
  versionconsider: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", description: "act.versionconsider.does",
    fields: { accepts: ["target","version","reason","project","hidden","preview","affirmed"], requires: ["target","version","reason"] } },
  versionrevert: { classes: ["admin","member","probe"], mutating: true, weight: "reversible", description: "act.versionrevert.does",
    fields: { accepts: ["target","version","reason","project","hidden","preview","affirmed"], requires: ["target","version"] } },
  versioncurrent: { classes: ["admin","member","probe"], mutating: true, weight: "reversible", description: "act.versioncurrent.does",
    fields: { accepts: ["target","version","reason","project","hidden","preview","affirmed"], requires: ["target","version","project"] } },
  versionhide: { classes: ["admin","member","probe"], mutating: true, weight: "reversible", description: "act.versionhide.does",
    fields: { accepts: ["target","version","reason","project","hidden","preview","affirmed"], requires: ["target","version"] } },
  narrow: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", description: localize("basis-versions.declared.narrow", "leg-directed: makes ONE leg of ONE reading point at less of its document, keyed by (inquiry, reading, ordinal); writes a new reading and moves nothing existing"),
    fields: { accepts: ["target","version","ord","name","description","extent"], requires: ["target","version","ord","name","description","extent"] } },
  narrowcandidates: { classes: ["admin","member","probe"], mutating: false, weight: "read", description: localize("basis-versions.declared.narrowcandidates", "read: the machine's proposals for making one leg more specific, keyed by (inquiry, reading, ordinal); labeled machine work and writes nothing"),
    fields: { accepts: ["target","version","ord"], requires: ["target","version","ord"] } },
  conclude: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", description: "act.conclude.does",
    fields: { accepts: ["target","conclusion","falsifier","no_falsifier","project","commentary","version","reading","preview","affirmed","bias_applied"], requires: ["target",["falsifier","no_falsifier"],["conclusion","project","reading"]] } },
  withdrawconclusion: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", description: "act.withdrawconclusion.does",
    fields: { accepts: ["target","project","reason"], requires: ["reason","target","project"] } },
});
