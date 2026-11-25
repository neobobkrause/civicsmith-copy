/* connections — the connections of the record (requirements: `build/requirements/connections.md`). Two kinds:
 * DERIVED connections, two captured documents that resolve to the same entity, graded the weaker of how each end
 * resolved (Framework §8, §8.1), each carrying the reference that determined it on each side, a member's choice of the
 * on-point mention, and what a cited part of a document may earn from it; and EDGES between bundles, the
 * `references[]` of every document projected so the record can answer who cites what (backlinks, dangling
 * references), `links_to` edges included. Beside them, kept apart and never rewritten by a derivation: a member's
 * own assertion of a connection (R31), a source's link between two held documents (R32), and an agenda item's
 * derived membership in a file (R49). And THEMES (Framework §8.4, K77): a connection through an idea, a lens for
 * finding material and never the basis of a claim (`./themes.mjs`).
 *
 * Extracted from the legacy modules (T5-5; K76, K77, K79, K102): `store.mjs` (FW-8's derivation, FW-17's pair,
 * REC-120's unchosen mention, REC-122's choice with D-454's occurrences, REC-5's dirty set, REC-19's live-cites
 * predicate, D-267's severance, REC-25's backlinks, C-6.2's dangling read, REC-52's link projection, D-162's themes),
 * `schema.mjs` (the tables, now `./schema.mjs`) and `bio-checks.mjs` (the two pair predicates, now `./pair.mjs`; the
 * C-74 rows, now `./checks.mjs` (T18); the C-49 and C-81 rows and `themeLegFindings`, copied to `./checks.mjs` (T19),
 * the catalogue's copy deleted with it at T19's close, K855). The built work on `land/worker/D-575`, `D-625`, `D-706` and `D-722`
 * is taken in (R6, R15, R26, R27). The legacy code's comments moved with it, shortened where they only restated it.
 *
 * REACHED as `connectionsOf(host, deps)` (K61): one instance per host (the Durable Object's `ctx`), created on the
 * first call with `deps`, returned to every later caller. At creation it declares its tables to purge (R36), joins
 * every promotion (R19's projection, R23's fact, R29's notice) and every reading (R49's re-derivation).
 * `deps`:
 *   record, membership, promotion, content, extraction, capture   the modules it uses, through their factories on
 *                the same host unless a test passes its own.
 *   entities     `entitiesOf(host)` unless a test passes its own: `has`, `readEntity` (R1's label) and
 *                `onResolved` (its R13), on which this module marks dirt (R17); the resolutions themselves are read
 *                through their read contract. `noEntity` (its R37), the one `NO_ENTITY` answer (R1), is imported from
 *                the module itself, never from `deps`.
 *   env          the bindings `CONNECTION_DERIVE_DELAY_MS` and `CONNECTION_DERIVE_BATCH` (R18); also handed to the
 *                capture and extraction this module creates when none is passed (K155).
 *   now          the module's clock, an ISO instant (default: the wall clock). */

import { isMachineIdentity, MACHINE_CLASS_PREFIX } from "../record-grammar/actors.mjs";
import { parseFrontmatter } from "../record-grammar/frontmatter.mjs";
import { sha256HexSync } from "../record-grammar/sha256.mjs";
import { CONNECTION_CHOICE_CHECKS, CONNECTION_PAIR_CHECKS, NO_SUCH_DOCUMENT_CHECKS, THEME_CHECKS, THEME_ID_RE, THEME_REF_RE, THEME_LEG_KEYS,
         themeLegFindings } from "./checks.mjs";
import { readingSourceFromColumns, readingSourceJson, readingOccurrenceKey, readingPositionInExtent }
  from "../textchain.mjs";
import { normalizeAddress } from "../subresources.mjs";
import { recordOf } from "../record-core/index.mjs";
import { membershipOf, viewerPredicate, listenerRefusal, MODULE_ORDER } from "../membership/index.mjs";
import { promotionOf } from "../promotion/index.mjs";
import { contentOf } from "../content/index.mjs";
import { extractionOf, OCCURRENCES_PER_REF } from "../extraction/index.mjs";
import { MEMBERSHIP_LABEL, checkMembershipLabel } from "../extraction/filemembership.mjs";
import { captureOf } from "../capture/index.mjs";
import { entitiesOf, gradeRank, isEstablished, noEntity } from "../entities/index.mjs";
import { CONNECTIONS_TABLES, CONNECTIONS_TABLE_NAMES, migrateConnections } from "./schema.mjs";
import { checkConnectionPairCovers, checkConnectionMentionUnchosen } from "./pair.mjs";
import { Themes } from "./themes.mjs";
import { registerOwner } from "../connection-grammar/index.mjs";
import { MENTIONED_KINDS, MENTIONED_OWNER, mentionedNeighbours } from "./mentioned.mjs";
import { StepSources, STEP_SOURCE_KINDS } from "./stepsources.mjs";
import { localize, word } from "../setup-words/index.mjs";

export { CONNECTIONS_SCHEMA, CONNECTIONS_TABLES, CONNECTIONS_TABLE_NAMES } from "./schema.mjs";
export { checkConnectionPairCovers, checkConnectionMentionUnchosen } from "./pair.mjs";
export { THEME_READ_LIMIT_DEFAULT, THEME_READ_LIMIT_MAX, THEME_WITHDRAW_CHECKS } from "./themes.mjs";
export { MENTIONED_KIND, MENTIONED_KINDS, MENTIONED_OWNER, MENTIONED_DECLARES, CO_MENTION_HUB, WARN_BAND, mentionedMethod }
  from "./mentioned.mjs";
export { STEP_SOURCE_KIND, STEP_SOURCE_KINDS, STEP_SOURCE_DECLARES, STEP_SOURCE_BASIS_MAX, STEP_SOURCE_ID_PREFIX }
  from "./stepsources.mjs";
/* R35, R46: C-49, C-74 and C-81 and the leg check are this module's own (`./checks.mjs`; C-74 T18, the rest copied
   T19), its public face for `inquiry-grammar` and `action-grammar` (`themeLegFindings`). */
export { CONNECTION_PAIR_CHECKS, CONNECTION_CHOICE_CHECKS, NO_SUCH_DOCUMENT_CHECKS, THEME_CHECKS, THEME_ID_RE, THEME_REF_RE, THEME_LEG_KEYS,
         themeLegFindings };

/** R72: the refusal for a document or record the viewer cannot see or the record does not hold, its code at this one
 *  literal site, with its row (DEC-49) so no other module's code decorates it. */
function noSuchDocument(target, detail) {
  /* DEC-49 REGION is-no-such-document */
  const r = NO_SUCH_DOCUMENT_CHECKS.NO_SUCH_DOCUMENT;
  const out = { ok: false, reason: "NO_SUCH_DOCUMENT", code: "NO_SUCH_DOCUMENT", check: r.check, translation: r.translation, target };
  if (detail) out.detail = detail;
  return out;
  /* END DEC-49 REGION is-no-such-document */
}

/** R2, R4: the meaning layer's bound (REC-60 / D-225): the default and the ceiling of every connection read. */
export const CONNECTIONS_LIMIT_DEFAULT = 500;
export const CONNECTIONS_LIMIT_MAX = 5000;
/** R13: how many content rows one `portionGrades` read answers (content R20's bound). */
export const PORTION_GRADES_MAX = 200;
/** R18: the sweep's cadence and batch (REC-5), each overridable by a binding. */
export const CONNECTION_DERIVE_DELAY_MS = 60000;
export const CONNECTION_DERIVE_BATCH = 100;
/** R1 (REC-120 / D-161 act 2): the rule that selects the pair, written onto every derived row and read back. */
export const PAIR_RULE = "strongest-graded/first-reference-by-sort";
/** R60: this module's figures for `op=stats` and purge's proof (record-core R63; `themes` and `themePlacements` are
 *  purge's only, record-core R65 removing them from the wire). */
export const CONNECTIONS_COUNT_KEYS = Object.freeze(["connections", "connectionPairChoices", "connectionDirty", "themes",
                                                     "themePlacements"]);
/** R61 (K882, N454): the key list of the `refs` figure source (`refsCounts`), shaped as record-core R63's
 *  `counts(hid)` and never registered with it: plane's own stats sight reads it (R60's registration keeps its keys). */
export const REFS_COUNT_KEYS = Object.freeze(["refs"]);
/** R31, R49: the reads of rows asserted apart, bounded like every read here. */
export const ASSERTED_LIMIT_DEFAULT = 200;
export const ASSERTED_LIMIT_MAX = 2000;
/** R31: a member's stated basis, stored whole up to this bound and refused over it. */
export const ASSERT_BASIS_MAX = 4000;
/** R28 (C-6.1): the contemporaneity verdicts a links_to entry may carry; any other is written as undetermined. */
const LINK_VERDICTS = ["contemporaneous", "superseded", "undetermined"];
/** R29: the machine viewer the system's own re-projection reads through. */
const SYSTEM_VIEWER = `${MACHINE_CLASS_PREFIX}daemon`;
/** R5, R8: where each end's reference was read, as the basis says it: both ends, one end, or neither. */
const readAt = (a, b) => (a && b
  ? localize("connections.index.read_at_both_ends", " (read at {ref} and {ref_2})", { ref: String(a.ref), ref_2: String(b.ref) })
  : a || b
    ? localize("connections.index.read_at_one_end", " (read at {ref} on one end only; the other reading does not say where)", { ref: String((a || b).ref) })
    : localize("connections.index.read_at_neither", " (neither reading says where in its document the reference was read)"));

/* §8.1's rank (entities R33, K149): A strongest; a grade outside the vocabulary ranks below every one. */
const rank = (g) => gradeRank[g] || 0;

/** R34 (FW-8): the weaker of two §8.1 grades — a connection is no stronger than its weaker end. Both ends measure the
 *  same thing on the same scale and neither is null on a connection row; a caller composing anything else short-
 *  circuits a null first (REC-12). Exported for `progressions`' instance grade (map §5.7). */
export function weakerGrade(g1, g2) {
  return rank(g1) <= rank(g2) ? g1 : g2;
}

const safeJson = (s) => { try { return s == null ? null : JSON.parse(s); } catch { return null; } };
const str = (v) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());
const clamp = (limit, dflt, max) => Math.max(1, Math.min(Number(limit) || dflt, max));
const cut = (s, n) => String(s ?? "").slice(0, n);

/* The entity's kind and label for R1's basis, through entities' R5 read. */
function entityOf(entities, id) {
  if (!id || !entities || typeof entities.readEntity !== "function") return null;
  const r = entities.readEntity({ entityId: id });
  return r && r.found && r.entity ? { entity_id: r.entity.entity_id, kind: r.entity.kind, label: r.entity.label } : null;
}

/* ------------------------------------------------------------------ the module */

export class Connections {
  #listeners = [];         // R3: {module, fn, seq}, in the modules' total order
  #derivationProvider = null;   // R5: {module, fn}

  constructor({ storage, record, membership, promotion, content, extraction, capture, entities, env = null, now } = {}) {
    this.storage = storage;
    this.sql = storage.sql;
    this.record = record;
    this.membership = membership;
    this.promotion = promotion;
    this.content = content;
    this.extraction = extraction;
    this.capture = capture;
    this.entities = entities;
    this.env = env || {};
    this.now = typeof now === "function" ? now : () => new Date().toISOString();
    this.themes = new Themes(this);
    this.stepSources = new StepSources(this);
  }

  #rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  #one(q, ...a) { for (const r of this.sql.exec(q, ...a)) return r; return null; }
  #transact(fn) { return this.record.transact(fn); }

  migrate() { migrateConnections(this.sql); }

  /* The one count behind R60 and R61: `table`'s rows, less (with `hid`) the rows any of whose `keys` names a bundle in
     `hid`. `COALESCE(k, '')`: a NULL key names no bundle, and `NULL NOT IN (…)` is NULL, which would drop the row. */
  #count(hid, table, ...keys) {
    const hidden = !!hid && typeof hid === "object" && typeof hid.sql === "string";
    const args = hidden && Array.isArray(hid.args) ? hid.args : [];
    const conds = hidden ? keys.map((k) => `COALESCE(${k}, '') NOT IN ${hid.sql}`) : [];
    return this.#one(`SELECT count(*) AS c FROM ${table}${conds.length ? ` WHERE ${conds.join(" AND ")}` : ""}`,
                     ...(hidden ? keys.flatMap(() => args) : [])).c;
  }

  /** R60 (record-core R63): this module's figures, each counted as the legacy store's `#counts` took it. `hid` is the
   *  bundles the caller may not see (`{sql, args}`), or null for a whole count: a figure keyed on a bundle column
   *  leaves out the rows whose column names one in `hid` (a null column names none, and is counted); a figure with
   *  no such column counts every row. Synchronous; writes nothing. */
  counts(hid = null) {
    const n = (table, ...keys) => this.#count(hid, table, ...keys);
    return { connections: n("connections", "a_bundle_id", "b_bundle_id"),
             connectionPairChoices: n("connection_pair_choices", "a_bundle_id", "b_bundle_id"),
             connectionDirty: n("connection_dirty"), themes: n("themes"), themePlacements: n("theme_placements") };
  }

  /** R61 (K882, N454): the `refs` figure, `{refs}` for `REFS_COUNT_KEYS`, for plane's own stats sight: the rows of
   *  `refs` less those whose `bundle_id` or `target_id` names a bundle in `hid` (a NULL key names none, and is
   *  counted); a null `hid` counts whole. Registered nowhere; synchronous; writes nothing. */
  refsCounts(hid = null) {
    return { refs: this.#count(hid, "refs", "bundle_id", "target_id") };
  }

  /* ---- sight (R12, R33) ---- */

  /** One bundle id through the viewer: the id, or null for one the viewer may not see; a row naming no bundle is left
   *  alone. A machine sees everything; an absent or unrecognised viewer nothing (fail closed). Memoised per call. */
  redactor(viewer) {
    const gate = viewerPredicate(viewer);
    if (gate.scope === "member") return (id) => id ?? null;
    if (gate.scope === "DENY") return (id) => (id ? null : id ?? null);
    const memo = new Map();
    return (id) => {
      if (!id) return id ?? null;
      if (!memo.has(id))
        memo.set(id, !!this.#one(`SELECT 1 AS x FROM bundles b WHERE b.bundle_id=? AND (${gate.sql})`, id, ...gate.args));
      return memo.get(id) ? id : null;
    };
  }

  sees(bundleId, viewer) { return this.membership.inSight(bundleId, viewer); }

  /** The same question as SQL over a QUALIFIED column (an unqualified one binds to the gate's own `bundles`). */
  #bundleGate(col, viewer) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$/.test(col))
      throw new Error(`REFUSED: the bundle gate needs a qualified column (got ${col})`);
    const gate = viewerPredicate(viewer);
    if (gate.scope === "member") return { sql: "1=1", args: [] };
    if (gate.scope === "DENY") return { sql: gate.sql, args: [] };
    return { sql: `(${col} IS NULL OR EXISTS (SELECT 1 FROM bundles b WHERE b.bundle_id = ${col} AND (${gate.sql})))`,
             args: gate.args };
  }

  /* ================================================================ derivation (R1–R3) */

  /** R3 (N202): a later module registers once (`observation-log` records each derivation). A malformed or second
   *  registration is refused by membership's one site for it (its R81); the listeners run in the modules' total order
   *  (its R83's `MODULE_ORDER`; an unknown module last, in the order it registered). */
  onDerived(module, fn) {
    const refused = listenerRefusal(this.#listeners, module, fn);
    if (refused) return refused;
    this.#listeners.push({ module, fn, seq: this.#listeners.length });
    const at = (m) => { const i = MODULE_ORDER.indexOf(m); return i === -1 ? Infinity : i; };
    this.#listeners.sort((x, y) => (at(x.module) - at(y.module)) || (x.seq - y.seq));
    return { ok: true, module };
  }

  /** R5: the provider of an entity's derivation statement (`observation-log`, which reads its own log), once; it is
   *  called as `fn(entityId, {hasArtifact, enteredAt})`. */
  registerDerivationProvider(module, fn) {
    if (typeof module !== "string" || !module || typeof fn !== "function")
      return { ok: false, reason: "PROVIDER_MALFORMED", detail: localize("connections.index.provider_names_module", "a provider names the module that registers it and its function") };
    if (this.#derivationProvider)
      return { ok: false, reason: "PROVIDER_DECLARED", module, detail: localize("connections.index.provider_already_provides", "{module} already provides the derivation statement", { module: String(this.#derivationProvider.module) }) };
    this.#derivationProvider = { module, fn };
    return { ok: true, module };
  }

  /** R2 (REC-66): how many ENDS may be derived over before the pairs exceed `pairCap` — k(k−1)/2 ≤ pairCap solved for
   *  k and walked to the exact integer. A bound on the answer becomes a bound on the scan only through it. */
  static maxEndsForPairs(pairCap) {
    let e = Math.max(2, Math.floor((1 + Math.sqrt(1 + 8 * Math.max(1, pairCap))) / 2));
    while (e > 2 && (e * (e - 1)) / 2 > pairCap) e--;
    while (((e + 1) * e) / 2 <= pairCap) e++;
    return e;
  }

  /** R1, R2, R3, R34, R38 (`op=connect`): DERIVE and persist the connections among every captured document that
   *  concerns one entity. The scan is bounded twice: by documents (the quantity the derivation is quadratic in) and by
   *  resolution rows (at most 5,000; a trailing partly-read capture is dropped rather than graded weaker). Per capture
   *  the strongest grade wins, ties to the first reference by sort, and that row's reference is the end's determining
   *  reference, with the position of its first read. One row per unordered pair, graded the weaker end, upserted in
   *  place. `asserted_by` is the control plane's stamp (`system` from it and from the sweep); a derivation is never a
   *  member's or the source's (R38), and never runs through a declared relation or a theme (R34, R47). */
  derive({ entityId, assertedBy = "system", limit = null } = {}) {
    /* N285 (K275): a request naming no entity is entities' one answer (its R37), with this act's sentence. */
    if (typeof entityId !== "string" || !entityId)
      return noEntity(localize("connections.index.derive_names_entity", "a connection is derived among the documents that concern one entity, by its id (op=connect&id=ENT-...)"));
    const author = typeof assertedBy === "string" && assertedBy.trim() ? assertedBy.trim() : "system";
    if (author === "member" || author === "source")
      return { ok: false, reason: "CONNECTION_AUTHOR_NOT_DERIVED", asserted_by: author,
               detail: localize("connections.index.derivation_not_asserted", "a derivation is the system's inference from two resolutions, never a {author}'s assertion; a member asserts a connection with op=connectionassert, and a source's link is projected with op=linkproject", { author: String(author) }) };
    const ent = entityOf(this.entities, entityId);
    const cap = clamp(limit, CONNECTIONS_LIMIT_DEFAULT, CONNECTIONS_LIMIT_MAX);
    const endsCap = Connections.maxEndsForPairs(cap);
    const rowCap = CONNECTIONS_LIMIT_MAX;
    const scan = this.#rows(
      `SELECT capture_sha, bundle_id, grade, ref FROM resolutions
        WHERE entity_id=? AND capture_sha IN (
          SELECT capture_sha FROM resolutions WHERE entity_id=? GROUP BY capture_sha
           ORDER BY capture_sha LIMIT ?)
        ORDER BY capture_sha, ref LIMIT ?`, entityId, entityId, endsCap + 1, rowCap + 1);
    const rowsCut = scan.length > rowCap;
    const rows = rowsCut ? scan.slice(0, rowCap) : scan;
    if (rowsCut && rows.length) {
      const partial = rows[rows.length - 1].capture_sha;
      while (rows.length && rows[rows.length - 1].capture_sha === partial) rows.pop();
    }
    /* The strongest grade each capture resolved at, and the reference that won it, taken at the same comparison so the
       pair and the grade cannot disagree. */
    const byCapture = new Map();
    for (const r of rows) {
      const cur = byCapture.get(r.capture_sha);
      if (!cur || rank(r.grade) > rank(cur.grade))
        byCapture.set(r.capture_sha, { capture_sha: r.capture_sha, bundle_id: r.bundle_id, grade: r.grade,
                                       ref: typeof r.ref === "string" ? r.ref : null });
    }
    const distinct = [...byCapture.values()];
    const truncated = rowsCut || distinct.length > endsCap;
    const ends = distinct.length > endsCap ? distinct.slice(0, endsCap) : distinct;
    /* The position half of the pair, once per END (never per pair): the reference's FIRST read (seq 0), D-454's rule;
       a lookup that finds nothing is the normal case and answers null. */
    for (const e of ends) {
      e.pos = null;
      if (!e.ref) continue;
      const rr = this.#one(
        `SELECT pos_kind, pos, pos_ref FROM reading_refs WHERE capture_sha=? AND ref=? ORDER BY seq LIMIT 1`,
        e.capture_sha, e.ref);
      if (rr) e.pos = readingSourceFromColumns(rr.pos_kind, rr.pos, rr.pos_ref);
    }
    const at = this.now();
    const label = ent ? ent.label : entityId;
    const written = [];
    this.#transact(() => {
      for (let i = 0; i < ends.length; i++) {
        for (let j = i + 1; j < ends.length; j++) {
          let A = ends[i], B = ends[j];
          if (A.capture_sha > B.capture_sha) { const t = A; A = B; B = t; }
          const grade = weakerGrade(A.grade, B.grade);
          const pairNote = (A.ref && B.ref)
            ? localize("connections.connection_through_reference", "; the connection is through the reference {ref} in A and {ref_2} in B{ref_3}; each is its document's strongest-graded mention (ties: first reference by sort), not one chosen as on point", { ref: String(A.ref), ref_2: String(B.ref), ref_3: readAt(A.pos, B.pos) })
            : localize("connections.reference_established_recorded", "; which reference established it is not recorded on this row");
          const basis = localize("connections.why.documents_concern_grade", "both documents concern {label} ({entity_id}); grade is the weaker of the two ends ({grade}, {grade_2}) -> {grade_3}{pair_note}", { label: String(label), entity_id: String(entityId), grade: String(A.grade), grade_2: String(B.grade), grade_3: String(grade), pair_note: String(pairNote) });
          const row = {
            a_capture_sha: A.capture_sha, b_capture_sha: B.capture_sha, entity_id: entityId,
            a_bundle_id: A.bundle_id, b_bundle_id: B.bundle_id, a_grade: A.grade, b_grade: B.grade,
            grade, established: isEstablished(grade) ? 1 : 0, asserted_by: author, basis: basis.slice(0, 400), at,
            a_ref: A.ref, a_pos_kind: A.pos ? A.pos.kind : null, a_pos: A.pos ? readingSourceJson(A.pos) : null,
            a_pos_ref: A.pos ? A.pos.ref : null,
            b_ref: B.ref, b_pos_kind: B.pos ? B.pos.kind : null, b_pos: B.pos ? readingSourceJson(B.pos) : null,
            b_pos_ref: B.pos ? B.pos.ref : null, pair_rule: PAIR_RULE };
          this.sql.exec(
            `INSERT INTO connections
               (a_capture_sha,b_capture_sha,entity_id,a_bundle_id,b_bundle_id,a_grade,b_grade,grade,established,asserted_by,basis,at,
                a_ref,a_pos_kind,a_pos,a_pos_ref,b_ref,b_pos_kind,b_pos,b_pos_ref,pair_rule)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
             ON CONFLICT(a_capture_sha,b_capture_sha,entity_id) DO UPDATE SET
               a_bundle_id=excluded.a_bundle_id, b_bundle_id=excluded.b_bundle_id,
               a_grade=excluded.a_grade, b_grade=excluded.b_grade, grade=excluded.grade,
               established=excluded.established, asserted_by=excluded.asserted_by,
               basis=excluded.basis, at=excluded.at,
               a_ref=excluded.a_ref, a_pos_kind=excluded.a_pos_kind, a_pos=excluded.a_pos, a_pos_ref=excluded.a_pos_ref,
               b_ref=excluded.b_ref, b_pos_kind=excluded.b_pos_kind, b_pos=excluded.b_pos, b_pos_ref=excluded.b_pos_ref,
               pair_rule=excluded.pair_rule`,
            row.a_capture_sha, row.b_capture_sha, row.entity_id, row.a_bundle_id, row.b_bundle_id,
            row.a_grade, row.b_grade, row.grade, row.established, row.asserted_by, row.basis, row.at,
            row.a_ref, row.a_pos_kind, row.a_pos, row.a_pos_ref, row.b_ref, row.b_pos_kind, row.b_pos, row.b_pos_ref,
            row.pair_rule);
          written.push(row);
        }
      }
      /* R64: what this derivation's bounds did, so a read of the connections through the entity can say so. */
      this.sql.exec(
        `INSERT INTO connection_derivations (entity_id, documents, document_limit, resolution_rows, pair_limit, truncated, at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(entity_id) DO UPDATE SET documents=excluded.documents, document_limit=excluded.document_limit,
           resolution_rows=excluded.resolution_rows, pair_limit=excluded.pair_limit, truncated=excluded.truncated,
           at=excluded.at`, entityId, ends.length, endsCap, scan.length, cap, truncated ? 1 : 0, at);
      return { ok: true };
    });
    const connections = written.map((row) => this.#view(row));
    /* R3: after the pairs are written, so a listener records what the derivation actually wrote — the empty
       derivation included, which is the one that matters (REC-95). */
    for (const l of this.#listeners)
      l.fn({ entityId, count: connections.length, documents: ends.length, truncated, entityKnown: !!ent,
             assertedBy: author });
    return { ok: true, entity_id: entityId, found: !!ent,
             entity: ent ? { entity_id: ent.entity_id, kind: ent.kind, label: ent.label } : null,
             documents: ends.length, document_limit: endsCap, resolution_rows: scan.length,
             count: connections.length, connections, limit: cap, truncated };
  }

  /* ================================================================ the pair and the choice (R6, R9, R14–R16) */

  /* R6 (REC-120, D-575): what the pair IS, stated on the pair. With no member's choice on either end the sentence says
     nobody has chosen; where one stands, each end is stated: chosen (the member, the mention, where it was read),
     LAPSED with its why, or unchosen. `chosen` stays false: it is about the MACHINE's pair, which a choice sits beside. */
  static #pairSelection(rule, states = null) {
    const lead = rule
      ? localize("connections.index.pair_selection_by_rule", "each end is the strongest-graded mention of the subject in its document; between equal grades the tie goes to the first reference by sort order, which says nothing about relevance. It is a machine selection and not the mention on point")
      : localize("connections.index.pair_selection_unrecorded", "each end is the strongest-graded mention of the subject in its document; this row was derived before the tie-break was recorded, when equal grades went to the scan's row order, which is not a basis. Re-deriving the subject's connections records it. It is a machine selection and not the mention on point");
    const st = states || {};
    const endSays = (side) => {
      const e = st[side];
      if (!e) return localize("connections.end_nobody_chosen", "on end {side} nobody has chosen", { side: String(side) });
      if (e.lapsed) return localize("connections.end_member_chose", "on end {side} a member ({chosen_by}) chose {ref} as the mention on point, and that choice has LAPSED: {why}", { side: String(side), chosen_by: String(e.lapsed.chosen_by), ref: String(e.lapsed.ref), why: String(e.lapsed.why) });
      return localize("connections.end_member_chose_mention", "on end {side} a member ({chosen_by}) chose {ref}{ref_2} as the mention on point", { side: String(side), chosen_by: String(e.choice.chosen_by), ref: String(e.m.ref), ref_2: String(e.position && e.position.ref ? ` (read at ${e.position.ref})` : " (where it was read is not recorded)") });
    };
    return {
      method: "strongest-graded",
      tie_break: typeof rule === "string" && rule ? (rule.split("/")[1] || null) : null,
      chosen: false,
      says: (st.a || st.b) ? `${lead}; ${endSays("a")}; ${endSays("b")}` : localize("connections.says.nobody_chosen", "{lead}, which nobody has chosen", { lead: String(lead) }) };
  }

  /** R16: the current choice on each end — at most one per end, newest first so a broken invariant answers the latest. */
  #currentPairChoices(aSha, bSha, entityId) {
    const rows = this.#rows(
      `SELECT side, ref, occurrence, chosen_by, at FROM connection_pair_choices
        WHERE a_capture_sha=? AND b_capture_sha=? AND entity_id=? AND side IN ('a','b')
          AND superseded_at IS NULL ORDER BY choice_id DESC LIMIT 2`, aSha, bSha, entityId);
    const out = { a: null, b: null };
    for (const r of rows)
      if (!out[r.side]) out[r.side] = { ref: r.ref, occurrence: r.occurrence ?? null, chosen_by: r.chosen_by, at: r.at };
    return out;
  }

  /* R9 (D-454): a choice is of an OCCURRENCE, its place read from the reading now, never from the choice row; a
     re-read that no longer reads the reference at that place LAPSES it. A choice made before occurrences were recorded
     answers while its reference has one read, and is AMBIGUOUS (lapsed, with the places) once it has several. */
  #resolvePairChoice(captureSha, entityId, mine) {
    const reads = this.#rows(
      `SELECT r.ref AS ref, r.grade AS grade, rp.pos_kind AS pos_kind, rp.pos AS pos, rp.pos_ref AS pos_ref,
              rp.occurrence AS occurrence
         FROM resolutions r LEFT JOIN reading_refs rp ON rp.capture_sha=r.capture_sha AND rp.ref=r.ref
        WHERE r.capture_sha=? AND r.entity_id=? AND r.ref=? ORDER BY rp.seq LIMIT ?`,
      captureSha, entityId, mine.ref, OCCURRENCES_PER_REF + 1);
    const ambiguous = mine.occurrence == null && reads.length > 1;
    const m = mine.occurrence == null
      ? (reads.length === 1 ? reads[0] : null)
      : (reads.find((x) => (x.occurrence ?? "") === mine.occurrence) || null);
    const occ = mine.occurrence != null ? { occurrence: mine.occurrence } : {};
    if (ambiguous)
      return { lapsed: { ref: mine.ref, chosen_by: mine.chosen_by, at: mine.at, lapsed: true, ambiguous: true,
                         occurrences: reads.map((x) => ({ occurrence: x.occurrence ?? null,
                           position: readingSourceFromColumns(x.pos_kind, x.pos, x.pos_ref) })),
                         why: localize("connections.why.member_chose_point", "a member chose {ref} as on point before the record kept which read of a reference a choice meant, and this document reads it at {reads} places, so the choice cannot say which and the machine's selection is read as unchosen. Choosing again, naming the occurrence, settles it", { ref: String(mine.ref), reads: String(reads.length) }) } };
    if (!m)
      return { lapsed: { ref: mine.ref, ...occ, chosen_by: mine.chosen_by, at: mine.at, lapsed: true,
                         why: localize("connections.why.member_chose_mention", "a member chose this mention as on point, and this document no longer carries it {value}for this subject, so the choice cannot answer and the machine's selection is read as unchosen", { value: String(mine.occurrence != null ? "at that place " : "") }) } };
    return { m, occ, position: readingSourceFromColumns(m.pos_kind, m.pos, m.pos_ref) };
  }

  /** D-575: each end's choice resolved against the document as it reads now, one resolution for every reader. */
  #pairChoiceStates(r) {
    const choices = this.#currentPairChoices(r.a_capture_sha, r.b_capture_sha, r.entity_id);
    const out = { a: null, b: null };
    for (const side of ["a", "b"])
      if (choices[side])
        out[side] = { choice: choices[side],
                      ...this.#resolvePairChoice(side === "a" ? r.a_capture_sha : r.b_capture_sha, r.entity_id, choices[side]) };
    return out;
  }

  static #onPointView(e) { return e ? (e.lapsed || { ...e.choice, lapsed: false }) : null; }

  /** The read-side view of a connection (R1, R4, R34): established and needs_confirmation from the WEAKER grade,
   *  `asserted_by` apart from the grade, and the determining pair as ONE object (null on a row derived before pairs
   *  were kept, a third state), with its selection stated (R6). */
  #view(r, states = this.#pairChoiceStates(r)) {
    const aPos = readingSourceFromColumns(r.a_pos_kind, r.a_pos, r.a_pos_ref);
    const bPos = readingSourceFromColumns(r.b_pos_kind, r.b_pos, r.b_pos_ref);
    return { a_capture_sha: r.a_capture_sha, b_capture_sha: r.b_capture_sha, entity_id: r.entity_id,
             a_bundle_id: r.a_bundle_id, b_bundle_id: r.b_bundle_id,
             grade: r.grade, a_grade: r.a_grade, b_grade: r.b_grade,
             established: !!r.established, needs_confirmation: !isEstablished(r.grade),
             asserted_by: r.asserted_by, basis: r.basis, at: r.at,
             determining_pair: (r.a_ref || r.b_ref)
               ? { a_ref: r.a_ref || null, a_position: aPos, b_ref: r.b_ref || null, b_position: bPos,
                   positioned: !!(aPos && bPos),
                   why: aPos && bPos
                     ? localize("connections.why.ends_record_document", "both ends record where in their document the determining reference was read")
                     : localize("connections.index.reference_recorded_not_read", "the determining reference is recorded on both ends; where it was read is not, so a citation of a PART of either document cannot yet earn from this connection"),
                   selection: Connections.#pairSelection(r.pair_rule, states) }
               : null };
  }

  /* ================================================================ reads (R4–R6) */

  /** R4, R5, R6, R12, R33, R70 (`op=connections&id=`, `&sha256=`; `&content=` is R7's). Ordered by grade, bounded, with
   *  `truncated` measured by reading one more. Each end's bundle id, and a member's choice on it, is withheld from a
   *  viewer who may not see that end; the connection itself (the evidence) stays visible (K102). On the capture arm
   *  each row also lists the subject's mentions in that document (R70), for the choice of the one on point. */
  read({ entityId = null, captureSha = null, contentId = null, limit = null, viewer = null } = {}) {
    if (typeof contentId === "string" && contentId.trim()) return this.portionGrade({ contentId, limit, viewer });
    const cap = clamp(limit, CONNECTIONS_LIMIT_DEFAULT, CONNECTIONS_LIMIT_MAX);
    let scan;
    if (entityId) {
      scan = this.#rows(`SELECT * FROM connections WHERE entity_id=? ORDER BY grade, a_capture_sha, b_capture_sha LIMIT ?`,
                        entityId, cap + 1);
    } else if (captureSha) {
      scan = this.#rows(`SELECT * FROM connections WHERE a_capture_sha=? OR b_capture_sha=? ORDER BY grade, entity_id LIMIT ?`,
                        captureSha, captureSha, cap + 1);
    } else {
      return { ok: false, reason: "NO_KEY", detail: localize("connections.index.read_needs_key", "read connections by entity (id=ENT-...) or by capture (sha256=...)") };
    }
    const truncated = scan.length > cap;
    const rows = truncated ? scan.slice(0, cap) : scan;
    const keep = this.redactor(viewer);
    const derivation = entityId ? this.derivationStatement(entityId) : undefined;
    const mentionMemo = new Map();
    return { ok: true, entity_id: entityId, capture_sha: captureSha, count: rows.length,
             connections: rows.map((r) => {
               const st = this.#pairChoiceStates(r);
               const a = keep(r.a_bundle_id), b = keep(r.b_bundle_id);
               /* R33: a choice is an act written into its end's document; a hidden end's is withheld with it. */
               const seen = { a: a ? st.a : null, b: b ? st.b : null };
               const view = this.#view(r, seen);
               /* R70: on the capture arm, the mentions of the subject in the document asked about, withheld with a hidden end. */
               const own = captureSha && !entityId ? (r.a_capture_sha === captureSha ? a : b) : null;
               if (own && !mentionMemo.has(r.entity_id))
                 mentionMemo.set(r.entity_id, this.#mentionsRead(captureSha, r.entity_id, OCCURRENCES_PER_REF));
               const listed = own ? mentionMemo.get(r.entity_id) : null;
               return { ...view, a_bundle_id: a, b_bundle_id: b,
                        ...((seen.a || seen.b) ? { on_point: { a: Connections.#onPointView(seen.a),
                                                               b: Connections.#onPointView(seen.b) } } : {}),
                        ...(listed ? { mentions: listed.mentions, mentions_truncated: listed.cut } : {}) };
             }),
             limit: cap, truncated, ...(derivation ? { derivation } : {}) };
  }

  /** R5: an entity's derivation statement, from the registered provider, or the stated absence of one. */
  derivationStatement(entityId) {
    if (!this.#derivationProvider)
      return { recorded: false, cause: "NO_PROVIDER",
               says: localize("connections.index.no_derivation_provider", "no module that records derivations is registered with this one, so whether this subject's connections were ever derived, and whether a derivation was cut at its bound, is undetermined") };
    /* The provider is handed what only this module and entities hold: whether a connection through the entity is
       held (the pre-log evidence) and when the entity was registered. */
    const e = this.entities && typeof this.entities.readEntity === "function" ? this.entities.readEntity({ entityId }) : null;
    const hasArtifact = !!this.#one(`SELECT 1 AS x FROM connections WHERE entity_id=? LIMIT 1`, entityId);
    try { return this.#derivationProvider.fn(entityId, { hasArtifact, enteredAt: (e && e.entity && e.entity.at) || null }); }
    catch (e) {
      return { recorded: false, cause: "PROVIDER_FAILED", says: localize("connections.says.derivation_statement_read", "the derivation statement could not be read: {entry}", { entry: String(cut(e && e.message, 200)) }) };
    }
  }

  /* ================================================================ a portion's grade (R7–R13) */

  /** R7–R12 (`op=connections&content=`): which of the capture's connections reach INTO this part of the document
   *  (Bob's 5.1: a citation of a portion stands on what is IN it). Membership, not value: the grade is §8.1's, off the
   *  connection row; the collapse over those that reach is the strongest. Undetermined is stated per connection
   *  (C-49.2, C-49.4, no pair) and never read as none. */
  portionGrade({ contentId = null, limit = null, viewer = null } = {}) {
    if (typeof contentId !== "string" || !contentId.trim())
      return { ok: false, reason: "NO_CONTENT",
               detail: localize("connections.index.portion_needs_content", "a portion's connection grade is asked about one content row, by its id (content=...)") };
    const row = this.#contentRow(contentId.trim());
    /* DEC-49 REGION pair-content-row-present */
    if (!row) {
      const r = CONNECTION_PAIR_CHECKS.CONNECTION_PAIR_NO_CONTENT;
      return { ok: false, reason: "CONNECTION_PAIR_NO_CONTENT", code: "CONNECTION_PAIR_NO_CONTENT",
               check: r.check, translation: r.translation, content_id: contentId.trim(),
               detail: localize("connections.index.no_content_row", "this record holds no content row with that id, so there is no portion to grade") };
    }
    /* END DEC-49 REGION pair-content-row-present */
    const cap = clamp(limit, CONNECTIONS_LIMIT_DEFAULT, CONNECTIONS_LIMIT_MAX);
    const scan = this.#rows(
      `SELECT * FROM connections WHERE a_capture_sha=? OR b_capture_sha=? ORDER BY grade, entity_id LIMIT ?`,
      row.capture_sha, row.capture_sha, cap + 1);
    const truncated = scan.length > cap;
    const conns = truncated ? scan.slice(0, cap) : scan;
    const g = this.#grade(row, conns, this.redactor(viewer));
    return {
      ok: true, content_id: row.content_id, capture_sha: row.capture_sha,
      bundle_id: this.redactor(viewer)(row.bundle_id), extent_kind: row.extent_kind, ref: row.ref, stale: !!row.stale,
      connection_grade: g.grade,
      established: g.grade == null ? false : isEstablished(g.grade),
      needs_confirmation: g.grade == null ? false : !isEstablished(g.grade),
      reaching: g.reaching, undetermined: g.undetermined, outside: g.outside,
      counts: { connections: conns.length, reaching: g.reaching.length, undetermined: g.undetermined.length,
                outside: g.outside.length },
      limit: cap, truncated, why: g.why,
    };
  }

  /** R13: R10's grade for at most 200 content rows in one set-based read of the rows and of their captures'
   *  connections (content's standings and the earned-basis registry compose it). `entityId`, when given, narrows to the
   *  connections through that subject (the registry asks about a leg's subject, never another's). Answers
   *  `{content_id: {grade, established, needs_confirmation, counts, why}}`; an id this record does not hold is absent. */
  portionGrades(contentIds, viewer = null, { entityId = null } = {}) {
    const ids = [...new Set((Array.isArray(contentIds) ? contentIds : [])
      .filter((c) => typeof c === "string" && c))].slice(0, PORTION_GRADES_MAX);
    const out = {};
    if (!ids.length) return out;
    const rows = this.#rows(
      `SELECT content_id, capture_sha, bundle_id, extent_kind, extent, ref, stale FROM content
        WHERE content_id IN (SELECT value FROM json_each(?))`, JSON.stringify(ids));
    if (!rows.length) return out;
    const shas = [...new Set(rows.map((r) => r.capture_sha))];
    const all = this.#rows(
      `SELECT * FROM connections
        WHERE (a_capture_sha IN (SELECT value FROM json_each(?)) OR b_capture_sha IN (SELECT value FROM json_each(?)))
          ${entityId ? "AND entity_id = ?" : ""}
        ORDER BY grade, entity_id`, JSON.stringify(shas), JSON.stringify(shas), ...(entityId ? [entityId] : []));
    const keep = this.redactor(viewer);
    for (const r of rows) {
      const conns = all.filter((c) => c.a_capture_sha === r.capture_sha || c.b_capture_sha === r.capture_sha);
      const g = this.#grade(r, conns, keep);
      out[r.content_id] = { grade: g.grade, established: g.grade == null ? false : isEstablished(g.grade),
                            needs_confirmation: g.grade == null ? false : !isEstablished(g.grade),
                            counts: { connections: conns.length, reaching: g.reaching.length,
                                      undetermined: g.undetermined.length, outside: g.outside.length },
                            why: g.why };
    }
    return out;
  }

  /** R13 composed for an internal caller with no viewer (the earned-basis registry: the write path, the gate), which
   *  names no bundle id: each held row's portion connection axis in the registry's shape, through one subject (R52); a
   *  `document` row is answered too, reached by every connection of its capture (R7, R10). */
  portionAxes(contentIds, { entityId = null } = {}) {
    const out = {};
    const g = this.portionGrades(contentIds, `${MACHINE_CLASS_PREFIX}daemon`, { entityId });
    for (const [id, s] of Object.entries(g)) out[id] = portionConnectionAxis(s);
    return out;
  }

  /* The content row (content R45's read contract). */
  #contentRow(id) {
    return this.#one(
      `SELECT content_id, capture_sha, bundle_id, extent_kind, extent, ref, stale FROM content WHERE content_id=?`, id);
  }

  /* The mentions of `entityId` in one capture (R8, R70): each resolved reference with each place the reading kept it,
     ordered by reference and then in the reading's order; at most `bound`, `cut` saying one more was there. */
  #mentionsRead(captureSha, entityId, bound) {
    const ms = this.#rows(
      `SELECT r.ref AS ref, r.grade AS grade, rp.pos_kind AS pos_kind, rp.pos AS pos, rp.pos_ref AS pos_ref,
              rp.occurrence AS occurrence
         FROM resolutions r LEFT JOIN reading_refs rp ON rp.capture_sha=r.capture_sha AND rp.ref=r.ref
        WHERE r.capture_sha=? AND r.entity_id=? ORDER BY r.ref, rp.seq LIMIT ?`,
      captureSha, entityId, bound + 1);
    const cut = ms.length > bound;
    return { cut, mentions: (cut ? ms.slice(0, bound) : ms).map((m) => ({
      ref: m.ref, occurrence: m.occurrence ?? null, grade: m.grade,
      position: readingSourceFromColumns(m.pos_kind, m.pos, m.pos_ref) })) };
  }

  /* R8–R11: sort one row's connections into reaching, undetermined and outside, and take the strongest reaching grade.
     A `document` extent is reached by every connection (5.3). A member's standing choice on the cited end answers
     instead of the machine's pair (R9); a lapsed one is stated and the pair read as unchosen. */
  #grade(row, conns, keep) {
    const extent = safeJson(row.extent);
    const whole = row.extent_kind === "document";
    const reaching = [], undetermined = [], outside = [];
    const mentionCache = new Map();
    const mentionsOf = (entityId) => {
      if (!mentionCache.has(entityId)) mentionCache.set(entityId, this.#mentionsRead(row.capture_sha, entityId, CONNECTIONS_LIMIT_MAX));
      return mentionCache.get(entityId);
    };
    for (const c of conns) {
      const side = c.a_capture_sha === row.capture_sha ? "a" : "b";
      const other = side === "a" ? "b" : "a";
      const states = this.#pairChoiceStates(c);
      /* R33: a choice on a hidden end is withheld with the end. */
      if (!keep(c[`${other}_bundle_id`])) states[other] = null;
      const view = this.#view(c, states);
      const entry = { entity_id: c.entity_id, grade: c.grade, side,
                      other_capture_sha: side === "a" ? c.b_capture_sha : c.a_capture_sha,
                      other_bundle_id: keep(side === "a" ? c.b_bundle_id : c.a_bundle_id),
                      determining_pair: view.determining_pair };
      if (whole) { reaching.push({ ...entry, why: localize("connections.index.whole_document_citation", "this citation is of the whole document, so every connection the document has is inside it") }); continue; }
      const mine = states[side] && states[side].choice;
      let lapsed = null;
      if (mine) {
        if (states[side].lapsed) {
          lapsed = states[side].lapsed;
        } else {
          const { m, occ, position } = states[side];
          const theirs = states[other];
          const theirGrade = (theirs && !theirs.lapsed && theirs.m.grade) || (side === "a" ? c.b_grade : c.a_grade);
          const grade = weakerGrade(m.grade, theirGrade);
          const onPoint = { ref: m.ref, ...occ, position, grade: m.grade, chosen_by: mine.chosen_by, at: mine.at };
          const chosenEntry = { ...entry, grade, on_point: onPoint };
          const said = localize("connections.member_chose_point", "a member ({chosen_by}) chose {ref} as the on-point mention on this end", { chosen_by: String(mine.chosen_by), ref: String(m.ref) });
          const verdict = checkConnectionPairCovers(
            side === "a" ? { a_ref: m.ref, a_position: position } : { b_ref: m.ref, b_position: position },
            side, row.extent_kind, extent, readingPositionInExtent);
          if (!verdict) reaching.push({ ...chosenEntry, why: localize("connections.why.read_inside", "{said}; it was read at {ref}, inside {ref_2}", { said: String(said), ref: String(position.ref), ref_2: String(row.ref) }) });
          else (verdict.code === "CONNECTION_PAIR_OUTSIDE_EXTENT" ? outside : undetermined)
            .push({ ...chosenEntry, code: verdict.code, check: verdict.check, translation: verdict.translation,
                    why: `${said}; ${verdict.detail.replace(/^the determining reference/, "that mention")}` });
          continue;
        }
      }
      if (lapsed) entry.on_point = lapsed;
      if (!view.determining_pair) {
        undetermined.push({ ...entry, code: "CONNECTION_PAIR_NO_PAIR",
          why: localize("connections.index.derived_before_pair_kept", "this connection was derived before the record kept which reference established it, so whether that reference falls inside this part cannot be asked. Re-deriving the subject's connections records the pair") });
        continue;
      }
      const bad = checkConnectionPairCovers(view.determining_pair, side, row.extent_kind, extent, readingPositionInExtent);
      if (!bad || bad.code === "CONNECTION_PAIR_OUTSIDE_EXTENT") {
        const unchosen = checkConnectionMentionUnchosen({
          pairRef: side === "a" ? view.determining_pair.a_ref : view.determining_pair.b_ref,
          pairOccurrence: readingOccurrenceKey(side === "a" ? view.determining_pair.a_position
                                                            : view.determining_pair.b_position),
          pairGrade: side === "a" ? c.a_grade : c.b_grade, pairReached: !bad,
          ...mentionsOf(c.entity_id), extentKind: row.extent_kind, extent,
          covers: readingPositionInExtent, rank });
        if (unchosen) {
          undetermined.push({ ...entry, code: unchosen.code, check: unchosen.check, translation: unchosen.translation,
                              why: unchosen.detail, mentions: unchosen.mentions });
          continue;
        }
      }
      if (!bad) { reaching.push({ ...entry, why: localize("connections.index.read_inside_reference", "the determining reference was read at {ref}, inside {ref_2}", { ref: String((side === "a" ? view.determining_pair.a_position : view.determining_pair.b_position).ref), ref_2: String(row.ref) }) });
                  continue; }
      (bad.code === "CONNECTION_PAIR_OUTSIDE_EXTENT" ? outside : undetermined)
        .push({ ...entry, code: bad.code, check: bad.check, translation: bad.translation, why: bad.detail });
    }
    /* R10, R11: the strongest reaching grade, null when none reaches; null is UNDETERMINED, never ranked. */
    let grade = null;
    for (const r2 of reaching) if (grade == null || rank(r2.grade) > rank(grade)) grade = r2.grade;
    const unchosenN = undetermined.filter((u) => u.code === "CONNECTION_PAIR_MENTION_UNCHOSEN").length;
    const why = grade != null
      ? localize("connections.connection_established_reference", "{reaching} connection(s) were established by a reference read inside {ref}; the grade is the strongest of them ({grade}), which states how that connection was established and nothing about how credible either document is", { reaching: String(reaching.length), ref: String(row.ref), grade: String(grade) })
      : conns.length === 0
        ? localize("connections.document_end_connection", "this document is an end of no connection, so there is nothing for {ref} to earn from", { ref: String(row.ref) })
        : unchosenN
          ? localize("connections.connection_established_reach", "no connection is established to reach {ref}: {unchosen_n} rest on a pair that is this document's strongest-graded mention of the subject while another mention bears on {ref_2}, and nobody has chosen which mention is on point{undetermined}; {outside} were established elsewhere in this document. UNDETERMINED is the answer and it is not the same as none", { ref: String(row.ref), unchosen_n: String(unchosenN), ref_2: String(row.ref), undetermined: String(undetermined.length > unchosenN ? localize("connections.index.cannot_be_placed", "; {count} cannot be placed", { count: String(undetermined.length - unchosenN) }) : ``), outside: String(outside.length) })
        : undetermined.length
          ? localize("connections.connection_established_reach_cannot", "no connection is established to reach {ref}: {undetermined} cannot be placed (the record does not hold where the determining reference was read) and {outside} were established elsewhere in this document. UNDETERMINED is the answer and it is not the same as none — reading this document with positions is what would settle it", { ref: String(row.ref), undetermined: String(undetermined.length), outside: String(outside.length) })
          : localize("connections.document_connections_established", "all {outside} of this document's connections were established by references read outside {ref}, so none of them reaches this citation", { outside: String(outside.length), ref: String(row.ref) });
    return { grade, reaching, undetermined, outside, why };
  }

  /* ================================================================ the choice (R14–R16, R38) */

  /** R14–R16 (`op=connectionchoose`): a member chooses the on-point mention on ONE end of ONE connection. `capture` is
   *  the end, `other` the other end, `entity` the subject, `ref` the mention, `occurrence` which read of it. `author`
   *  and `viewer` are the control plane's stamps. Append-only; never rewrites the connection's own pair. */
  choose(a = {}) {
    const args = a || {};
    const refusal = (code, detail, extra) => {
      const row = CONNECTION_CHOICE_CHECKS[code];
      return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail, ...(extra || {}) };
    };
    const who = str(args.author);
    const capture = str(args.capture).toLowerCase();
    const other = str(args.other).toLowerCase();
    const entityId = str(args.entity);
    const ref = str(args.ref);
    /* R15 (D-625): ABSENT and EMPTY are two answers. Every unplaced read is the one '' occurrence and the record lists
       it by that key, so an `occurrence` PRESENT and empty names it; only an absent one is none named. */
    const named = args.occurrence == null ? null : String(args.occurrence).trim();
    const aSha = capture < other ? capture : other, bSha = capture < other ? other : capture;
    const conn = (capture && other && entityId && capture !== other)
      ? this.#one(`SELECT a_capture_sha, b_capture_sha, entity_id, a_bundle_id, b_bundle_id, a_ref, b_ref
                     FROM connections WHERE a_capture_sha=? AND b_capture_sha=? AND entity_id=?`, aSha, bSha, entityId)
      : null;
    const side = capture === aSha ? "a" : "b";
    const keep = this.redactor(args.viewer ?? null);
    const mention = conn && ref
      ? this.#one(`SELECT ref, grade FROM resolutions WHERE capture_sha=? AND entity_id=? AND ref=?`, capture, entityId, ref)
      : null;
    const reads = mention
      ? this.#rows(`SELECT occurrence, seq, pos_kind, pos, pos_ref FROM reading_refs
                     WHERE capture_sha=? AND ref=? ORDER BY seq LIMIT ?`, capture, mention.ref, OCCURRENCES_PER_REF + 1)
      : [];
    const byForm = named ? reads.filter((x) => x.pos_ref === named) : [];
    const pick = named != null
      ? (reads.find((x) => x.occurrence === named) || (byForm.length === 1 ? byForm[0] : null))
      : (reads.length <= 1 ? (reads[0] || null) : null);
    const occCut = reads.length > OCCURRENCES_PER_REF;
    const listed = () => (occCut ? reads.slice(0, OCCURRENCES_PER_REF) : reads).map((x) => ({
      occurrence: x.occurrence, position: readingSourceFromColumns(x.pos_kind, x.pos, x.pos_ref) }));
    const placeName = (x) => x.pos_ref || localize("connections.place_reading_record", "a place the reading did not record");
    /* DEC-49 REGION is-connection-choice */
    if (!who || isMachineIdentity(who))
      return refusal("CONNECTION_CHOICE_NOT_A_MEMBER",
        who ? localize("connections.index.choice_machine_credential", "'{who}' is a machine credential. It may list a document's mentions (op=connections&content= names them where they bear on a citation); choosing which one a connection rests on is a member's act.", { who: String(who.slice(0, 60)) })
            : localize("connections.index.choice_names_nobody", "this act names no member, and a choice nobody made is not a choice."));
    if (!conn || !keep(side === "a" ? conn.a_bundle_id : conn.b_bundle_id))
      return refusal("CONNECTION_CHOICE_NO_CONNECTION",
        localize("connections.index.choice_no_connection", "this record holds no connection between capture={capture} and other={other} through entity={entity} that you can see. Name the end the choice is about (capture), the other end (other) and the subject (entity).", { capture: `${capture.slice(0, 12) || "(none)"}…`, other: `${other.slice(0, 12) || "(none)"}…`, entity: String(entityId || "(none)") }),
        { capture: capture || null, other: other || null, entity_id: entityId || null });
    if (!mention)
      return refusal("CONNECTION_CHOICE_NOT_A_MENTION",
        ref ? localize("connections.index.choice_not_a_mention", "this document does not carry '{ref}' as a mention of {entity}. Its mentions are the references the record resolved to that subject in it.", { ref: String(ref.slice(0, 80)), entity: String(entityId) })
            : localize("connections.index.choice_pass_ref", "pass ref=: the mention, as the reading recorded it, that is on point for this connection."),
        { capture, entity_id: entityId, ref: ref || null });
    if (named != null && !pick)
      return refusal("CONNECTION_CHOICE_NOT_A_MENTION",
        localize("connections.index.this_document_does_not_read", "this document does not read '{ref}' {v1}{v2}. It reads it at: {v3}.", { ref: String(mention.ref.slice(0, 80)), v1: String(named ? `at '${named.slice(0, 120)}'` : `at a place it did not record (an empty occurrence= names that read)`), v2: String(byForm.length > 1 ? ` alone — that place is ${byForm.length} occurrences, so name one by its key` : ``), v3: String(reads.map(placeName).join(", ") || localize("connections.index.no_place_recorded", "no place the reading recorded")) }),
        { capture, entity_id: entityId, ref: mention.ref, occurrence: named, occurrences: listed(),
          limit: OCCURRENCES_PER_REF, truncated: occCut });
    if (named == null && reads.length > 1)
      return refusal("CONNECTION_CHOICE_OCCURRENCE_UNNAMED",
        localize("connections.index.choice_occurrence_unnamed", "this document reads '{ref}' at {places_count} places ({places}), and each is its own mention. Pass occurrence= naming the one on point.", { ref: String(mention.ref.slice(0, 80)), places_count: String(reads.length), places: String(reads.map(placeName).join(", ")) }),
        { capture, entity_id: entityId, ref: mention.ref, occurrences: listed(),
          limit: OCCURRENCES_PER_REF, truncated: occCut });
    /* END DEC-49 REGION is-connection-choice */
    const cur = this.#currentPairChoices(aSha, bSha, entityId)[side];
    const occurrence = pick ? pick.occurrence : null;
    const position = pick ? readingSourceFromColumns(pick.pos_kind, pick.pos, pick.pos_ref) : null;
    const at = this.now();
    const answer = (wrote, prior) => ({
      ok: true, wrote, a_capture_sha: aSha, b_capture_sha: bSha, entity_id: entityId, side,
      occurrences: listed(), limit: OCCURRENCES_PER_REF, truncated: occCut,
      chosen: { ref: mention.ref, occurrence, grade: mention.grade, position,
                chosen_by: wrote ? who : cur.chosen_by, at: wrote ? at : cur.at },
      superseded: prior,
      machine_pair_ref: side === "a" ? conn.a_ref : conn.b_ref,
      says: localize("connections.index.v1_on_end_side_of", "{v1}on end {side} of this connection the on-point mention of {entityId} is {ref}{v2}, as chosen by {v3}. A citation of a part of this document now answers from this mention; the machine's strongest-graded pair is kept beside it, unchanged", { v1: String(wrote ? `recorded: ` : `already the choice, so nothing was written: `), side: String(side.toUpperCase()), entityId: String(entityId), ref: String(mention.ref), v2: String(position ? ` (read at ${position.ref})` : ` (the reading did not record where)`), v3: String(wrote ? who : cur.chosen_by) }) });
    if (cur && cur.ref === mention.ref && (cur.occurrence ?? null) === occurrence) return answer(false, null);
    this.#transact(() => {
      if (cur)
        this.sql.exec(`UPDATE connection_pair_choices SET superseded_at=?
                        WHERE a_capture_sha=? AND b_capture_sha=? AND entity_id=? AND side=? AND superseded_at IS NULL`,
                      at, aSha, bSha, entityId, side);
      this.sql.exec(`INSERT INTO connection_pair_choices
                       (a_capture_sha,b_capture_sha,entity_id,side,ref,occurrence,a_bundle_id,b_bundle_id,chosen_by,at)
                     VALUES (?,?,?,?,?,?,?,?,?,?)`,
                    aSha, bSha, entityId, side, mention.ref, occurrence, conn.a_bundle_id, conn.b_bundle_id, who, at);
      return { ok: true };
    });
    return answer(true, cur ? { ref: cur.ref, ...(cur.occurrence != null ? { occurrence: cur.occurrence } : {}),
                                chosen_by: cur.chosen_by, at: cur.at } : null);
  }

  /* ================================================================ the dirty set (R17, R18) */

  /** R17: stamp an entity dirty, inside the resolving transaction; many marks are one row. */
  markDirty(entityId) {
    if (typeof entityId !== "string" || !entityId) return;
    this.sql.exec(`INSERT INTO connection_dirty (entity_id, stamped_at) VALUES (?, ?)
                   ON CONFLICT(entity_id) DO UPDATE SET stamped_at=excluded.stamped_at`, entityId, this.now());
  }

  #deriveDelayMs() {
    const v = Number(this.env && this.env.CONNECTION_DERIVE_DELAY_MS);
    return Number.isFinite(v) && v >= 0 ? v : CONNECTION_DERIVE_DELAY_MS;
  }
  #deriveBatch() {
    const v = Number(this.env && this.env.CONNECTION_DERIVE_BATCH);
    return Number.isFinite(v) && v >= 1 ? Math.floor(v) : CONNECTION_DERIVE_BATCH;
  }

  /** R18: null when nothing is marked, else `now` plus the delay. The scheduler arms; this module never does. */
  wake(now) {
    return this.#one(`SELECT count(*) AS c FROM connection_dirty`).c > 0 ? now + this.#deriveDelayMs() : null;
  }

  /** R18: derive a batch of the oldest marked entities at R2's default bound, `asserted_by: system`, clearing each only
   *  after its derivation (a crash leaves it marked: re-derive, never skip). */
  sweep() {
    const batch = this.#rows(`SELECT entity_id FROM connection_dirty ORDER BY stamped_at, entity_id LIMIT ?`,
                             this.#deriveBatch());
    const swept = [];
    for (const { entity_id } of batch) {
      const r = this.derive({ entityId: entity_id, assertedBy: "system" });
      this.sql.exec(`DELETE FROM connection_dirty WHERE entity_id=?`, entity_id);
      swept.push({ entity_id, connections: r && r.ok ? r.count : 0 });
    }
    const remaining = this.#one(`SELECT count(*) AS c FROM connection_dirty`).c;
    return { entities: swept.length, remaining, swept };
  }

  /* ================================================================ edges between bundles (R19–R23) */

  /** R19: the promotion's projection — the bundle's edges replaced by its document's `references[]`, one per (target,
   *  relation), in the promotion's transaction. The edges it replaced are left on the context as `refsReplaced`
   *  (`[{target_id, kind}]`) for a later step that must un-tell what a revision dropped (`inquiry`'s supersedes). */
  projectRefs(c) {
    const bundleId = c.bundleId;
    c.refsReplaced = this.#rows(`SELECT target_id, kind FROM refs WHERE bundle_id=?`, bundleId);
    this.sql.exec(`DELETE FROM refs WHERE bundle_id=?`, bundleId);
    const md = (c.files || []).find((f) => f.path === "bundle.md");
    const fmRefs = md && typeof md.text === "string" ? (parseFrontmatter(md.text).data?.references ?? []) : [];
    for (const t of Array.isArray(fmRefs) ? fmRefs : []) {
      if (!t || typeof t !== "object" || typeof t.target !== "string") continue;
      this.sql.exec(`INSERT OR REPLACE INTO refs (bundle_id,target_id,kind) VALUES (?,?,?)`,
                    bundleId, t.target, typeof t.rel === "string" ? t.rel : "");
    }
    return null;
  }

  /** R22 (D-267): is the edge from `citingId` to `targetId` recorded WITHDRAWN in the citing document? Severance only
   *  narrows on evidence: an unreadable document, or no entry for the target, is LIVE. `rel` narrows or is null. */
  edgeSevered(citingId, targetId, rel = null) {
    const md = this.record.readFile(citingId, "bundle.md");
    if (!md || typeof md.text !== "string") return false;
    const refs = parseFrontmatter(md.text).data?.references;
    const entry = (Array.isArray(refs) ? refs : [])
      .find((x) => x && x.target === targetId && (rel === null || x.rel === rel));
    return !!entry && entry.status === "severed";
  }

  /** R22 (REC-19): THE ONE live-cites predicate — who cites INTO a bundle, partitioned by the edge's status, sorted. */
  citesInto(id) {
    const confirmed = [], severed = [];
    for (const r of this.#rows(`SELECT bundle_id FROM refs WHERE target_id=? AND kind='cites'`, id))
      (this.edgeSevered(r.bundle_id, id, "cites") ? severed : confirmed).push(r.bundle_id);
    return { confirmed: confirmed.sort(), severed: severed.sort() };
  }

  /** R23: the fact `citedBy` promotion's R16 (`CITED`) reads: the confirmed citers. */
  citedBy(id) { return this.citesInto(id).confirmed; }

  /** R20 (REC-25, `op=backlinks`): every edge INTO a target, the citing bundles filtered by the viewer (Membership v2
   *  §7.9), each with the edge's status read from the citing document. A target the viewer cannot see answers as an
   *  absent one. A citer the viewer may not see is withheld whole, and the answer says only that one was:
   *  `out_of_view: true` (DEC-36, K903 (4)), asked by one ungated `EXISTS` beside the gated read, so nothing of the
   *  withheld citer (its id, title, type, state, relation, or how many) reaches the answer. */
  backlinks({ target = null, viewer = null } = {}) {
    if (!target) return { ok: false, reason: "NO_TARGET", detail: localize("connections.index.backlinks_need_target", "backlinks are asked of an object: pass target=<record id>") };
    if (!this.sees(target, viewer)) return noSuchDocument(target);
    const gate = viewerPredicate(viewer);
    const rows = this.#rows(
      `SELECT r.bundle_id AS from_id, r.kind AS rel, b.object_type AS from_type,
              b.title AS from_title, b.current_state AS from_state
         FROM refs r JOIN bundles b ON b.bundle_id = r.bundle_id
        WHERE r.target_id = ? AND (${gate.sql})
        ORDER BY r.bundle_id, r.kind`, target, ...gate.args);
    const out = [];
    for (const r of rows) {
      let status = null, note = null;
      const md = this.record.readFile(r.from_id, "bundle.md");
      if (md && typeof md.text === "string") {
        const refs = parseFrontmatter(md.text).data?.references;
        const entry = (Array.isArray(refs) ? refs : []).find((x) => x && x.rel === r.rel && x.target === target);
        if (entry) { status = entry.status ?? "confirmed"; note = entry.note ?? null; }
      }
      out.push({ from: r.from_id, from_type: r.from_type, from_title: r.from_title, from_state: r.from_state,
                 rel: r.rel, status: status ?? "confirmed", note });
    }
    /* Whether any edge into the target comes from a citer the gate did not pass: the same join, with exactly the rows
       the gated read leaves out (`IS NOT 1`: a gate that answers NULL withholds as surely as one that answers 0). */
    const withheld = gate.scope === "member" ? null : this.#one(
      `SELECT 1 AS x FROM refs r JOIN bundles b ON b.bundle_id = r.bundle_id
        WHERE r.target_id = ? AND ((${gate.sql}) IS NOT 1) LIMIT 1`, target, ...gate.args);
    return { ok: true, target, backlinks: out, ...(withheld ? { out_of_view: true } : {}) };
  }

  /** R21 (C-6.2, `op=dangling`): every edge whose target no bundle holds; a hidden citing bundle's edge withheld whole.
   *  The target is not gated: it names nothing. */
  dangling(viewer = null) {
    const seen = this.#bundleGate("r.bundle_id", viewer);
    return this.#rows(
      `SELECT r.bundle_id, r.target_id FROM refs r
         LEFT JOIN bundles tgt ON tgt.bundle_id=r.target_id
        WHERE tgt.bundle_id IS NULL AND (${seen.sql})`, ...seen.args);
  }

  /* ================================================================ link projection (R24–R29, R32) */

  /** R24–R29, R32 (`op=linkproject`): the capture's links, resolved by `capture` through the VIEWER (R26: one
   *  resolution decides what is said and what is written, D-722), become `links_to` edges of the source's document:
   *  each resolved link whose target a bundle has registered is written into the source's `references[]` by one
   *  promotion (R28), so the edge survives the source's later promotions, and each is kept as the source's own `A`
   *  connection, apart from derived ones (R32). A self-edge is dropped; a target no bundle claims is counted
   *  `skipped_unregistered`. `bundle` naming a bundle the viewer cannot see, or none, is refused as not held (R27);
   *  a PROJECT source needs the actor to have joined it (REC-134, D-722 (2)). */
  projectLinks({ sourceCapture, sourceBundle = null, at = null, viewer = null, identity = null } = {}) {
    const seen = this.capture.resolveLinks({ sourceCapture, at, viewer: viewer ?? null });
    if (!seen.links || !seen.links.length) return { projected: 0, edges: [] };
    let bundle = sourceBundle;
    if (bundle) {
      const named = this.record.bundleInfo(bundle);
      { const existence = named ? this.membership.existenceAct(bundle, viewer) : null; if (existence) return existence; }
      if (!named || !this.sees(bundle, viewer)) return noSuchDocument(bundle);
    } else {
      const reg = this.#one(`SELECT bundle_id FROM register WHERE capture_sha = ?`, sourceCapture);
      bundle = reg ? reg.bundle_id : null;
    }
    if (!bundle) return { projected: 0, edges: [],
      note: localize("connections.note.capture_registered_record", "this capture is not registered to a record, so there is no canonical source to hang an edge on") };
    const src = this.record.bundleInfo(bundle);
    if (src && src.type === "project") {
      const denied = this.membership.projectAuthority(bundle, identity, "joined", "linkproject");
      if (denied) return denied;
    }
    const edges = [];
    let unregistered = 0, self = 0;
    for (const l of seen.links) {
      if (l.resolution !== "linked") continue;
      if (!l.target_bundle) { unregistered++; continue; }
      if (l.target_bundle === bundle) { self++; continue; }
      if (edges.some((e) => e.to === l.target_bundle)) continue;
      edges.push({ from: bundle, to: l.target_bundle, rel: "links_to", asserted_by: "source", address: l.address,
                   fragment: l.fragment, verdict: l.verdict, basis: l.basis,
                   target_capture: l.target_capture, target_retrieved: l.target_retrieved });
    }
    const written = edges.length ? this.#writeLinkReferences(bundle, edges, identity) : { ok: true, promoted: false };
    if (!written.ok) return { ...written, projected: 0, source_bundle: bundle };
    const stamp = this.now();
    this.#transact(() => {
      for (const e of edges) this.#upsertSourceConnection(bundle, e, sourceCapture, stamp);
      return { ok: true };
    });
    return { projected: edges.length, source_bundle: bundle, edges,
      skipped_self: self, skipped_unregistered: unregistered, unresolved: seen.tally ? seen.tally.offsite : 0,
      references_written: written.added ?? 0, promoted: !!written.promoted,
      ...(written.bundleSha ? { bundleSha: written.bundleSha } : {}),
      note: localize("connections.index.only_resolved_links_project_and", "only resolved links project, and only to a target some record has registered. skipped_unregistered counts targets whose BYTES the record holds while no record claims them: those become edges when the target is promoted. Each edge is written into the source document's references as links_to and never cites, because the source asserted it and not the team; a member promoting it to cites is a member's act.") };
  }

  /* R28: the links not already in the source document's references[], appended there by ONE promotion of the source
     (every other file carried byte for byte), so the edges are the document's own and R19 keeps them. */
  #writeLinkReferences(bundle, edges, identity) {
    const md = this.record.readFile(bundle, "bundle.md");
    const head = this.record.head(bundle);
    if (!md || typeof md.text !== "string" || !head)
      return { ok: false, reason: "NO_DOCUMENT", detail: localize("connections.index.source_document_not_held", "the source record's document is not held as text, so its links cannot be written into it") };
    const parsed = parseFrontmatter(md.text);
    const held = new Set((Array.isArray(parsed.data?.references) ? parsed.data.references : [])
      .filter((x) => x && x.rel === "links_to").map((x) => x.target));
    const add = edges.filter((e) => !held.has(e.to));
    if (!add.length) return { ok: true, promoted: false, added: 0 };
    const when = this.now();
    /* C-6.1's links_to arm: the entry is the SOURCE's on its face (`asserted_by: source`), carries the address the
       source wrote and a contemporaneity verdict, `undetermined` its resting state and stated rather than omitted. */
    const quoted = (v) => cut(String(v || "").replace(/["\\\n\r]/g, ""), 400);
    let text = spliceReferences(md.text, add.map((e) => ({
      rel: "links_to", target: e.to, status: "confirmed", asserted_by: "source", address: quoted(e.address),
      verdict: LINK_VERDICTS.includes(e.verdict) ? e.verdict : "undetermined", note: quoted(e.address) })));
    if (!text) return { ok: false, reason: "UNSPLICEABLE_REFERENCES",
                        detail: localize("connections.index.references_block_shape", "the source document's references block is not in a shape this act can extend in place") };
    text = setScalar(text, "last_updated", `"${when}"`);
    const by = typeof identity === "string" && identity.trim() ? identity.trim() : "system";
    const entry = localize("connections.index.session_when_projected_length_link", "### Session {when} | Projected {length} link{v1} | {by}\nTrigger: op=linkproject\nChanges: links_to edges added to {map}, each the source's own link, resolved to a held document; asserted by the source, never by the team.\n", { when: String(when), length: String(add.length), v1: String(add.length === 1 ? "" : "s"), by: String(by), map: String(add.map((e) => e.to).join(", ")) });
    const logAt = text.indexOf("## Session Log");
    if (logAt < 0) text += "\n## Session Log\n\n" + entry;
    else {
      const nxt = text.indexOf("\n## ", logAt + 1);
      const end = nxt === -1 ? text.length : nxt + 1;
      text = text.slice(0, end) + entry + "\n" + text.slice(end);
    }
    const carried = [];
    for (const path of this.record.livePaths(bundle) || []) {
      if (path === "bundle.md") continue;
      const f = this.record.readFile(bundle, path);
      if (!f) continue;
      carried.push(typeof f.text === "string"
        ? { path, text: f.text, bytes: new TextEncoder().encode(f.text).length, sha256: f.sha256 }
        : { path, blobSha: f.blobSha, sha256: f.sha256, bytes: f.bytes });
    }
    const bytes = new TextEncoder().encode(text);
    const fm = parseFrontmatter(text).data || {};
    const r = this.promotion.promote({
      bundleId: bundle, base: head.bundleSha,
      snapKey: `${when.replace(/[-:.]/g, "")}_links_${randHex(4)}`, author: by,
      files: [{ path: "bundle.md", text, bytes: bytes.length, sha256: sha256HexSync(text) }, ...carried],
      meta: { object_type: fm.object_type ?? head.type, title: fm.title ?? head.title,
              current_state: fm.current_state ?? head.currentState, prior_state: fm.prior_state ?? null,
              created: fm.created, last_updated: when, criticality: fm.criticality ?? null },
    });
    if (!r || !r.ok) return r || { ok: false, reason: "PROMOTION_FAILED" };
    return { ok: true, promoted: true, added: add.length, bundleSha: r.bundleSha };
  }

  /* R32: the source's own link between two held documents, grade A, asserted by the source, kept apart from derived
     rows; `timing` says whether the link's contemporaneity was established (a verdict other than contemporaneous is
     undetermined, labelled so). */
  #upsertSourceConnection(bundle, e, sourceCapture, at) {
    const timing = e.verdict === "contemporaneous" ? "contemporaneous" : "undetermined";
    const basis = localize("connections.why.source_document_linked", "the source document linked to {to} by the address {address}, resolved to a capture the record holds; {value}", { to: String(e.to), address: String(cut(e.address, 300)), value: String(timing === "contemporaneous"
        ? word("connections.target_bytes_seen")
        : word("connections.version_target_source")) });
    this.sql.exec(
      `INSERT INTO asserted_connections (kind, a_bundle_id, b_bundle_id, origin, grade, established, asserted_by, author,
                                         basis, timing, a_address, b_address, at)
       VALUES ('link', ?, ?, ?, 'A', 1, 'source', NULL, ?, ?, NULL, ?, ?)
       ON CONFLICT(kind, a_bundle_id, b_bundle_id, origin) DO UPDATE SET
         basis=excluded.basis, timing=excluded.timing, b_address=excluded.b_address, at=excluded.at`,
      bundle, e.to, String(sourceCapture || ""), basis, timing, e.address ?? null, at);
  }

  /** R29: after a promotion commits, every held capture whose resolved link points at a capture the promoted bundle
   *  registers is re-projected, by the system, so the link becomes an edge once its target is held (LINK-FIDELITY step
   *  8). A source already carrying the edge writes nothing. */
  relinkTargetsOf(bundleId) {
    const sources = this.#rows(
      `SELECT DISTINCT l.source_capture AS source FROM links l
         JOIN captured_locators cl ON cl.address_norm = l.address_norm
         JOIN register rg ON rg.capture_sha = cl.capture_sha
        WHERE rg.bundle_id = ? AND l.partition = 'deferred'
          AND NOT EXISTS (SELECT 1 FROM register rs WHERE rs.capture_sha = l.source_capture AND rs.bundle_id = ?)`,
      bundleId, bundleId).map((r) => r.source);
    const out = [];
    for (const s of sources) {
      const r = this.projectLinks({ sourceCapture: s, viewer: SYSTEM_VIEWER, identity: null });
      out.push({ source_capture: s, projected: r.projected ?? 0, ok: r.ok !== false });
    }
    return out;
  }

  /* ================================================================ asserted by others (R31, R49) */

  /** R31 (`op=connectionassert`): a member asserts a connection between two held documents directly, with a stated
   *  basis: `asserted_by: member`, grade D, never established, kept apart from derived rows and never rewritten by a
   *  derivation. The same member asserting the same pair again writes nothing (`wrote: false`). */
  assert({ a = null, b = null, basis = null, member = null, viewer = null } = {}) {
    const who = str(member);
    if (!who || isMachineIdentity(who))
      return { ok: false, reason: "CONNECTION_ASSERT_NOT_A_MEMBER",
               detail: who ? localize("connections.index.assert_machine_credential", "'{who}' is a machine credential; asserting a connection is a member's act, in their name", { who: String(cut(who, 60)) })
                           : localize("connections.index.act_names_no_member", "this act names no member; the plane stamps the member from the credential that asked") };
    const words = typeof basis === "string" ? basis.trim() : "";
    if (!words) return { ok: false, reason: "CONNECTION_ASSERT_NO_BASIS",
                         detail: localize("connections.index.assert_carries_basis", "a member's connection carries its basis: why these two documents are connected") };
    if (words.length > ASSERT_BASIS_MAX)
      return { ok: false, reason: "CONNECTION_ASSERT_BASIS_TOO_LONG", limit: ASSERT_BASIS_MAX,
               detail: localize("connections.index.basis_over_limit", "{count} characters of basis, over {limit}; refused rather than cut", { count: String(words.length), limit: String(ASSERT_BASIS_MAX) }) };
    const x = str(a), y = str(b);
    for (const id of [x, y])
      if (!id || !this.record.bundleInfo(id) || !this.sees(id, viewer))
        return noSuchDocument(id || null,
                 localize("connections.index.assert_joins_two_held", "a member's connection joins two documents this record holds and you can see"));
    if (x === y) return { ok: false, reason: "CONNECTION_ASSERT_SELF", target: x,
                          detail: localize("connections.index.assert_names_one_twice", "a connection joins two documents; this names one twice") };
    const [lo, hi] = x < y ? [x, y] : [y, x];
    const held = this.#one(`SELECT * FROM asserted_connections WHERE kind='member' AND a_bundle_id=? AND b_bundle_id=? AND origin=?`,
                           lo, hi, who);
    if (held) return { ok: true, wrote: false, connection: this.#assertedView(held, this.redactor(viewer)),
                       says: localize("connections.says.already_asserted_connection", "you have already asserted this connection; nothing was written") };
    const at = this.now();
    this.sql.exec(
      `INSERT INTO asserted_connections (kind, a_bundle_id, b_bundle_id, origin, grade, established, asserted_by, author, basis, at)
       VALUES ('member', ?, ?, ?, 'D', 0, 'member', ?, ?, ?)`, lo, hi, who, who, words, at);
    const row = this.#one(`SELECT * FROM asserted_connections WHERE kind='member' AND a_bundle_id=? AND b_bundle_id=? AND origin=?`,
                          lo, hi, who);
    return { ok: true, wrote: true, connection: this.#assertedView(row, this.redactor(viewer)),
             says: localize("connections.says.recorded_asserts_connected", "recorded: {who} asserts that {lo} and {hi} are connected, on their stated basis. It is a member's assertion, grade D, kept apart from the connections the record derives", { who: String(who), lo: String(lo), hi: String(hi) }) };
  }

  #assertedView(r, keep) {
    const judged = r.kind === "containment"
      ? this.#rows(`SELECT verdict, judged_by, at, reason FROM asserted_connection_judgements
                     WHERE connection_id=? ORDER BY judgement_id`, r.connection_id) : [];
    const standing = judged.length ? judged[judged.length - 1] : null;
    return {
      connection_id: r.connection_id, kind: r.kind, a_bundle_id: keep(r.a_bundle_id), b_bundle_id: keep(r.b_bundle_id),
      grade: r.grade, established: !!r.established, needs_confirmation: !r.established,
      asserted_by: r.asserted_by, ...(r.author ? { author: r.author } : {}), basis: r.basis, at: r.at,
      ...(r.kind === "link" ? { timing: r.timing, address: r.b_address, source_capture: r.origin,
          timing_says: r.timing === "contemporaneous" ? localize("connections.link_target_seen", "the link's target was seen unchanged across the source's retrieval")
            : localize("connections.version_target_source_pointed", "which version of its target the source pointed at is undetermined") } : {}),
      ...(r.kind === "containment" ? { ...MEMBERSHIP_LABEL, item_address: r.a_address, file_address: r.b_address,
          agenda_capture: r.origin, judgements: judged, standing: standing ? standing.verdict : "inferred" } : {}),
    };
  }

  /** R31, R32, R49, R54 (`op=connectionsasserted`): a document's connections asserted apart from derivation — a
   *  member's, a source's, the system's containment — each row whose other end the viewer cannot see omitted (R33).
   *  Sight is asked in the SQL, so the read is bounded at `cap + 1` and `truncated` counts only visible rows. */
  asserted({ bundleId = null, viewer = null, limit = null } = {}) {
    const id = str(bundleId);
    if (!id || !this.record.bundleInfo(id) || !this.sees(id, viewer))
      return noSuchDocument(id || null);
    const cap = clamp(limit, ASSERTED_LIMIT_DEFAULT, ASSERTED_LIMIT_MAX);
    const keep = this.redactor(viewer);
    const seen = this.#bundleGate("x.other_end", viewer);
    const rows = this.#rows(
      `SELECT x.* FROM (SELECT ac.*, CASE WHEN ac.a_bundle_id = ? THEN ac.b_bundle_id ELSE ac.a_bundle_id END AS other_end
                          FROM asserted_connections ac WHERE ac.a_bundle_id = ? OR ac.b_bundle_id = ?) x
        WHERE (${seen.sql}) ORDER BY x.kind, x.connection_id LIMIT ?`, id, id, id, ...seen.args, cap + 1);
    const shown = rows.slice(0, cap).map((r) => this.#assertedView(r, keep));
    return { ok: true, bundle_id: id, limit: cap, truncated: rows.length > cap,
             member: shown.filter((r) => r.kind === "member"), source: shown.filter((r) => r.kind === "link"),
             containment: shown.filter((r) => r.kind === "containment"),
             says: localize("connections.index.asserted_says", "connections asserted by a member, by a source's own link and by the system's positional inference, each labelled with who asserts it and kept apart from the connections derived from resolutions") };
  }

  /* R49: which held document an address names: its capture's home. */
  #heldAt(address) {
    const norm = normalizeAddress(address);
    if (!norm) return { norm: null, bundle: null };
    const r = this.#one(`SELECT rg.bundle_id AS bundle_id FROM captured_locators cl
                           JOIN register rg ON rg.capture_sha = cl.capture_sha
                           JOIN bundles b ON b.bundle_id = rg.bundle_id
                          WHERE cl.address_norm = ? ORDER BY cl.first_retrieved LIMIT 1`, norm);
    return { norm, bundle: r ? r.bundle_id : null };
  }

  /* R49: store one pair when both documents are held, else keep it pending. Answers 'stored' | 'pending'. */
  #storePair(agendaCapture, agendaBundle, pair, at) {
    const item = this.#heldAt(pair.item_address), file = this.#heldAt(pair.file_address);
    if (!item.norm || !file.norm) return "unaddressable";
    if (item.bundle && file.bundle && item.bundle !== file.bundle) {
      const basis = localize("connections.why.file_printed_agenda", "the file {file_address} is printed under the agenda item {item_address} in the agenda {agenda_capture}: {derived}, an inference from position, never the publisher's own link", { file_address: String(cut(pair.file_address, 300)), item_address: String(cut(pair.item_address, 300)), agenda_capture: String(agendaCapture.slice(0, 12)), derived: String(MEMBERSHIP_LABEL.derived) });
      this.sql.exec(
        `INSERT INTO asserted_connections (kind, a_bundle_id, b_bundle_id, origin, grade, established, asserted_by, author,
                                           basis, a_address, b_address, at)
         VALUES ('containment', ?, ?, ?, ?, 0, 'system', NULL, ?, ?, ?, ?)
         ON CONFLICT(kind, a_bundle_id, b_bundle_id, origin) DO UPDATE SET basis=excluded.basis, at=excluded.at`,
        item.bundle, file.bundle, agendaCapture, MEMBERSHIP_LABEL.grade, basis, pair.item_address, pair.file_address, at);
      this.sql.exec(`DELETE FROM file_membership_pending WHERE agenda_capture=? AND item_norm=? AND file_norm=?`,
                    agendaCapture, item.norm, file.norm);
      return "stored";
    }
    this.sql.exec(
      `INSERT INTO file_membership_pending (agenda_capture, agenda_bundle, item_address, file_address, item_norm, file_norm, pair, at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(agenda_capture, item_norm, file_norm) DO UPDATE SET pair=excluded.pair, at=excluded.at`,
      agendaCapture, agendaBundle, pair.item_address, pair.file_address, item.norm, file.norm, JSON.stringify(pair), at);
    return "pending";
  }

  /** R30, R49 (`op=filemembershipstore`): derive the agenda capture's item-to-file membership (extraction R52, read
   *  through `extraction.pdfStructure`) and store each pair whose two documents are held as a system-asserted
   *  connection graded C, never established; a pair whose documents are not both held is kept pending, served only at
   *  the read. Pairs above the first item or without a place are never assigned (`unplaced`, carried, not stored). */
  async storeFileMembership({ captureSha = null, viewer = null, env = null } = {}) {
    const sha = str(captureSha).toLowerCase();
    const home = sha ? this.#one(`SELECT bundle_id FROM register WHERE capture_sha=?`, sha) : null;
    if (!home || !this.sees(home.bundle_id, viewer))
      return { ok: false, reason: "NO_SUCH_CAPTURE", capture_sha: sha || null,
               detail: localize("connections.index.no_capture_by_digest", "this record holds no capture by that digest that you can see") };
    const r = await this.extraction.pdfStructure({ sha, viewer, env: env || this.env });
    const body = r && r.body ? r.body : {};
    const m = body.membership ?? null;
    if (!m) return { ok: true, capture_sha: sha, stored: 0, pending: 0, membership: null,
                     why: body.membershipWhy || body.reason || localize("connections.why.membership_derived_document", "no membership was derived for this document") };
    const bad = checkMembershipLabel(m);
    if (bad) return { ok: true, capture_sha: sha, stored: 0, pending: 0, membership: null, why: `label_check_failed: ${bad}` };
    const at = this.now();
    let stored = 0, pending = 0;
    this.#transact(() => {
      for (const g of m.items || [])
        for (const f of g.files || []) {
          const out = this.#storePair(sha, home.bundle_id, { item_address: g.item.url, file_address: f.url,
            item_anchor: g.item.anchor ?? null, file_anchor: f.anchor ?? null, system: m.system ?? null }, at);
          if (out === "stored") stored++; else if (out === "pending") pending++;
        }
      return { ok: true };
    });
    return { ok: true, capture_sha: sha, stored, pending, unplaced: m.unplaced || [], ...MEMBERSHIP_LABEL,
             says: localize("connections.index.membership_stored_says", "each file is assigned to the agenda item printed above it; a pair is stored as a connection the system asserts, graded C and never established, once both documents are held, and a member may confirm or reject it. A pair whose documents are not both held is served only at the read") };
  }

  /** R49: a re-read of either end's capture re-derives the pairs that name its addresses (extraction R24). */
  rederiveMembership(captureSha) {
    const norms = this.#rows(`SELECT address_norm FROM captured_locators WHERE capture_sha=?`, captureSha)
      .map((r) => r.address_norm);
    if (!norms.length) return 0;
    const pend = this.#rows(`SELECT * FROM file_membership_pending
                              WHERE item_norm IN (SELECT value FROM json_each(?)) OR file_norm IN (SELECT value FROM json_each(?))`,
                            JSON.stringify(norms), JSON.stringify(norms));
    const at = this.now();
    let n = 0;
    for (const p of pend) {
      const pair = safeJson(p.pair) || { item_address: p.item_address, file_address: p.file_address };
      if (this.#storePair(p.agenda_capture, p.agenda_bundle, pair, at) === "stored") n++;
    }
    const home = this.#one(`SELECT bundle_id FROM register WHERE capture_sha=?`, captureSha);
    if (home) this.sql.exec(`UPDATE asserted_connections SET at=? WHERE kind='containment' AND (a_bundle_id=? OR b_bundle_id=?)`,
                            at, home.bundle_id, home.bundle_id);
    return n;
  }

  /** R30, R49, R56 (`op=filemembership`): an agenda capture's stored pairs (with their judgements) and its pending ones,
   *  each labelled machine work, inferred, never the publisher's link. Each list is read at most `limit` (as R54's),
   *  bounded in the SQL at `cap + 1` with sight asked there too, and says whether it was cut. */
  fileMembership({ captureSha = null, viewer = null, limit = null } = {}) {
    const sha = str(captureSha).toLowerCase();
    const home = sha ? this.#one(`SELECT bundle_id FROM register WHERE capture_sha=?`, sha) : null;
    if (!home || !this.sees(home.bundle_id, viewer))
      return { ok: false, reason: "NO_SUCH_CAPTURE", capture_sha: sha || null };
    const cap = clamp(limit, ASSERTED_LIMIT_DEFAULT, ASSERTED_LIMIT_MAX);
    const keep = this.redactor(viewer);
    const ga = this.#bundleGate("ac.a_bundle_id", viewer), gb = this.#bundleGate("ac.b_bundle_id", viewer);
    const storedRows = this.#rows(
      `SELECT ac.* FROM asserted_connections ac WHERE ac.kind = 'containment' AND ac.origin = ?
          AND (${ga.sql}) AND (${gb.sql}) ORDER BY ac.connection_id LIMIT ?`, sha, ...ga.args, ...gb.args, cap + 1);
    const pendingRows = this.#rows(
      `SELECT * FROM file_membership_pending WHERE agenda_capture = ? ORDER BY item_norm, file_norm LIMIT ?`, sha, cap + 1);
    const stored = storedRows.slice(0, cap).map((r) => ({ ...this.#assertedView(r, keep), stored: true }));
    const pending = pendingRows.slice(0, cap)
      .map((p) => ({ ...MEMBERSHIP_LABEL, stored: false, item_address: p.item_address, file_address: p.file_address,
                     why: localize("connections.why.documents_held_pair", "not both documents are held yet, so this pair is served at the read and not stored") }));
    return { ok: true, capture_sha: sha, ...MEMBERSHIP_LABEL, stored, pending, limit: cap,
             truncated: storedRows.length > cap || pendingRows.length > cap,
             stored_truncated: storedRows.length > cap, pending_truncated: pendingRows.length > cap,
             says: localize("connections.index.membership_read_says", "an agenda item's membership in a file, derived from where the file is printed; the publisher linked neither end to the other, so this is an inference from position, to be confirmed, never the publisher's own link") };
  }

  /** R49 (`op=filemembershipjudge`): a member confirms or rejects a stored containment, with a reason; both acts kept
   *  with who, when and why, the latest standing. The connection's own grade does not move. */
  judgeFileMembership({ id = null, verdict = null, reason = null, member = null, viewer = null } = {}) {
    const who = str(member);
    if (!who || isMachineIdentity(who))
      return { ok: false, reason: "FILE_MEMBERSHIP_NOT_A_MEMBER",
               detail: localize("connections.index.judge_is_member_act", "confirming or rejecting an inferred membership is a member's judgement, in their name") };
    const v = str(verdict).toLowerCase();
    const word = v === "confirm" || v === "confirmed" ? "confirmed" : v === "reject" || v === "rejected" ? "rejected" : null;
    if (!word) return { ok: false, reason: "FILE_MEMBERSHIP_BAD_VERDICT", detail: localize("connections.index.verdict_confirm_or_reject", "verdict is confirm or reject") };
    const why = typeof reason === "string" ? reason.trim() : "";
    if (!why) return { ok: false, reason: "FILE_MEMBERSHIP_NO_REASON", detail: localize("connections.index.judgement_carries_reason", "a judgement carries its reason") };
    const row = this.#one(`SELECT * FROM asserted_connections WHERE connection_id=? AND kind='containment'`, Number(id) || -1);
    if (!row || !this.sees(row.a_bundle_id, viewer) || !this.sees(row.b_bundle_id, viewer))
      return { ok: false, reason: "FILE_MEMBERSHIP_NO_SUCH_CONNECTION", id: id ?? null,
               detail: localize("connections.index.no_stored_membership_by_id", "this record holds no stored item-to-file membership by that id that you can see") };
    const at = this.now();
    this.sql.exec(`INSERT INTO asserted_connection_judgements (connection_id, verdict, judged_by, at, reason, a_bundle_id, b_bundle_id)
                   VALUES (?, ?, ?, ?, ?, ?, ?)`, row.connection_id, word, who, at, cut(why, ASSERT_BASIS_MAX),
                  row.a_bundle_id, row.b_bundle_id);
    return { ok: true, connection: this.#assertedView(row, this.redactor(viewer)),
             says: localize("connections.index.who_word_that_the_file", "{who} {word} that the file belongs to the agenda item; the inference and every judgement are kept", { who: String(who), word: String(word) }) };
  }

  /* ================================================================ the connection owner (R62–R65): ./mentioned.mjs */

  /** R63–R65: the documents connected to `node` by R1's derived connections, in `connection-grammar`'s shape, as the
   *  kind `mentioned_together`. Reads; never derives. R69: for an entity node, the sources attached to the declared
   *  steps it is an end of, as the kind `step_source` (`./stepsources.mjs`). A node is an entity or a document, never
   *  both, so the read is the one its node names. */
  neighbours(args) {
    const node = args && typeof args === "object" ? args.node : null;
    if (typeof node === "string" && node && this.entities && typeof this.entities.has === "function" && this.entities.has(node))
      return this.stepSources.neighbours(args);
    return mentionedNeighbours(this, args, { positionOf: (r, side) =>
      readingSourceFromColumns(r[`${side}_pos_kind`], r[`${side}_pos`], r[`${side}_pos_ref`]) });
  }

  /** R65: how many captures resolving to `entityId` sit in a bundle the viewer may see. */
  visibleCaptureCount(entityId, viewer) {
    const seen = this.#bundleGate("r.bundle_id", viewer);
    return this.#one(`SELECT count(DISTINCT r.capture_sha) AS n FROM resolutions r WHERE r.entity_id = ? AND (${seen.sql})`,
                     entityId, ...seen.args).n;
  }

  /** R64: what `entityId`'s last derivation's bounds did, or null when none is recorded. */
  lastDerivation(entityId) {
    const d = this.#one(`SELECT * FROM connection_derivations WHERE entity_id = ?`, entityId);
    return d ? { ...d, truncated: !!d.truncated } : null;
  }

  rankOf(grade) { return rank(grade); }

  /* ================================================================ themes (R39–R48): ./themes.mjs */

  declareTheme(a) { return this.themes.declare(a); }
  placeInTheme(a) { return this.themes.place(a); }
  proposeForTheme(a) { return this.themes.propose(a); }
  withdrawFromTheme(a) { return this.themes.withdraw(a); }
  readThemes(a) { return this.themes.read(a); }

  /* ================================================================ sources of declared steps (R68, R69): ./stepsources.mjs */

  attachStepSource(a) { return this.stepSources.attach(a); }
  withdrawStepSource(a) { return this.stepSources.withdraw(a); }
}

/** R13 as the earned-basis registry states an axis: a reaching grade is the value a portion leg may state
 *  (`mode: value`); otherwise the axis is undetermined and says which kind of undetermined, never none. */
export function portionConnectionAxis(s) {
  if (s.grade != null)
    return { determined: true, grain: "portion", mode: "value", grade: s.grade, established: s.established, why: s.why };
  const c = s.counts || {};
  const because = !c.connections ? "NO_CONNECTION"
    : c.undetermined ? "CONNECTION_PORTION_UNDETERMINED" : "CONNECTION_OUTSIDE_PORTION";
  return { determined: false, grain: "portion", grade: null, undetermined_because: because,
           empty_level: because === "CONNECTION_PORTION_UNDETERMINED"
             ? localize("connections.index.empty_level_where_read", "where in the document the determining reference was read, or which mention is on point")
             : because === "NO_CONNECTION" ? localize("connections.index.empty_level_no_connection", "connection — this document is an end of no connection through this subject")
             : localize("connections.index.empty_level_outside", "connection — every connection of this document was established outside this portion"),
           why: s.why };
}

/** R19: the edges of `kind` a promotion's projection replaced (`refsReplaced` on its context), for a later step. */
export function refsReplacedOf(c, kind) {
  return (c && Array.isArray(c.refsReplaced) ? c.refsReplaced : []).filter((r) => r.kind === kind).map((r) => r.target_id);
}

/* R28: append whole reference entries to the frontmatter's `references` block, touching nothing else (the store's
   `#spliceReferences` discipline: no key, an inline `[]`, or a block; any other inline value is not ours). */
function spliceReferences(text, additions) {
  const lines = text.split("\n");
  if (lines[0] !== "---") return null;
  const end = lines.indexOf("---", 1);
  if (end === -1) return null;
  const block = additions.map((a) =>
    localize("connections.index.rel_rel_target_target_status", "  - rel: {rel}\n    target: {target}\n    status: {status}{v1}{v2}{v3}\n    note: \"{v4}\"", { rel: String(a.rel), target: String(a.target), status: String(a.status), v1: String(a.asserted_by ? `\n    asserted_by: ${a.asserted_by}` : ""), v2: String(a.address != null ? `\n    address: "${a.address}"` : ""), v3: String(a.verdict ? `\n    verdict: ${a.verdict}` : ""), v4: String(a.note ?? "") }));
  let ref = -1;
  for (let i = 1; i < end; i++) if (/^references:/.test(lines[i])) { ref = i; break; }
  if (ref === -1) return [...lines.slice(0, end), "references:", ...block, ...lines.slice(end)].join("\n");
  const rest = lines[ref].slice("references:".length).trim();
  if (rest === "[]") return [...lines.slice(0, ref), "references:", ...block, ...lines.slice(ref + 1)].join("\n");
  if (rest !== "") return null;
  let last = ref;
  for (let i = ref + 1; i < end; i++) {
    if (lines[i].trim() === "") continue;
    if (/^\s/.test(lines[i])) { last = i; continue; }
    break;
  }
  return [...lines.slice(0, last + 1), ...block, ...lines.slice(last + 1)].join("\n");
}

/* A top-level scalar in the frontmatter, set or added before the closing fence. */
function setScalar(text, key, value) {
  const lines = text.split("\n");
  const end = lines.indexOf("---", 1);
  if (lines[0] !== "---" || end === -1) return text;
  for (let i = 1; i < end; i++)
    if (lines[i].startsWith(`${key}:`)) { lines[i] = `${key}: ${value}`; return lines.join("\n"); }
  lines.splice(end, 0, `${key}: ${value}`);
  return lines.join("\n");
}

function randHex(n) {
  return [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const instances = new WeakMap();
/* R62: the instances created in this isolate, for the registered read when the caller names no `host`. */
let created = 0, latest = null;

/** R62: the owner's read as registered: the instance of the caller's `host` (an argument `connection-grammar`'s
 *  registry passes through unchanged, R19), else the one instance this isolate created; with several and no `host`
 *  the read cannot say whose record it reads, and refuses. */
export function registeredNeighbours(args) {
  const a = args && typeof args === "object" ? args : {};
  const k = a.host ? instances.get(a.host) : created === 1 ? latest : null;
  if (!k) return { refused: a.host || created === 0 ? "OWNER_NOT_READY" : "OWNER_HOST_AMBIGUOUS",
                   why: a.host || created === 0 ? localize("connections.why.connections_instance_held", "no connections instance is held for this host yet")
                     : localize("connections.why.several_records_open", "several records are open in this isolate and the read names no host, so whose connections to read is not known") };
  const { host: _h, ...rest } = a;
  return k.neighbours(rest);
}

/** R62, R69: registered once, at load, into the plane's default registry (`connection-grammar` R5): the owner's two
 *  kinds, `mentioned_together` and `step_source`, with the one read that answers each by its node. */
export const CONNECTIONS_KINDS = Object.freeze([...MENTIONED_KINDS, ...STEP_SOURCE_KINDS]);
export const MENTIONED_REGISTRATION = registerOwner({ owner: MENTIONED_OWNER, kinds: CONNECTIONS_KINDS.map((x) => ({ ...x })),
                                                      neighbours: registeredNeighbours });

/** The one connections instance for `host` (the Durable Object's `ctx`, with its `storage`); `deps` are read on the
 *  first call only. At creation it declares its tables (R36), registers its figures (R60) and registers its projection and fact with promotion
 *  (R19, R23), its link notice (R29) and its re-derivation with extraction (R49), and marks dirt on entities'
 *  `onResolved` (R17). */
export function connectionsOf(host, deps) {
  let k = instances.get(host);
  if (!k) {
    const d = deps || {};
    const record = d.record || recordOf(host);
    const membership = d.membership || membershipOf(host, { record });
    const promotion = d.promotion || promotionOf(host, { record, membership });
    /* K155: a module this one creates is created with this module's `env`. capture, extraction and host-governor
       keep the FIRST instance per storage, so one created here without it would leave the plane's capture with no
       bindings (no renderer, no governor appetite) whoever asks for it later. */
    const env = d.env ?? null;
    const extraction = d.extraction || extractionOf(host, { record, membership, promotion, env });
    const content = d.content || contentOf(host, { record, membership, extraction });
    const capture = d.capture || captureOf(host, { record, env });
    const entities = d.entities || entitiesOf(host, { record, membership });
    k = new Connections({ ...d, storage: d.storage || host.storage, record, membership, promotion, content, extraction,
                          capture, entities });
    instances.set(host, k);
    created++; latest = k;
    /* R36, R67: every table declared with its classes; a refusal is a build fault, never a silent gap. */
    const declared = record.declareTable("connections", CONNECTIONS_TABLES.map((t) => ({ ...t })));
    if (declared && declared.ok === false)
      throw new Error(`connections: record-core refused its tables: ${declared.reason}${declared.table ? ` (${declared.table})` : ""}`);
    /* R60: the figures, once at start (record-core R63); a refusal is a build fault, never a silent gap. */
    if (typeof record.registerCounts === "function") {
      const counted = record.registerCounts("connections", [...CONNECTIONS_COUNT_KEYS], (hid) => k.counts(hid));
      if (counted && counted.ok === false)
        throw new Error(`connections: record-core refused its figures: ${counted.reason}`
                        + `${counted.heldBy ? ` (held by ${counted.heldBy})` : ""}`);
    }
    promotion.registerStep("connections", { project: (c) => k.projectRefs(c) });
    promotion.registerFact("citedBy", "connections", (id) => k.citedBy(id));
    promotion.onCommitted("connections", ({ bundleId, replay }) => (replay ? null : k.relinkTargetsOf(bundleId)));
    if (typeof extraction.onReading === "function")
      extraction.onReading("connections", (e) => ({ membership_rederived: k.rederiveMembership(e.captureSha) }));
    /* R17: an inserted or raised resolution marks its entity, inside the resolving transaction (entities R13). */
    if (k.entities && typeof k.entities.onResolved === "function")
      k.entities.onResolved("connections", (e) => k.markDirty(e.entityId));
  }
  return k;
}

/** Which purge declaration names one of this module's tables (record-core R21: each owner declares its own). */
export function connectionsOwns(t) {
  const name = typeof t === "string" ? t : t && t.name;
  return CONNECTIONS_TABLE_NAMES.includes(name);
}

/* The Durable Object routes this module answers, as entries of the plane store's op map (`src/plane/store.mjs`, whose
   dispatcher spreads them in; the legacy store's map until T19; K3). `url` carries the control plane's stamps — `viewer`, `author`, `identity`, `declarer`, `placer`,
   `proposer`, `actor`, `member`, `administer` — and `body` the parsed body; no stamp is read from the body. */
export function connectionsOps(k, url, body, env) {
  const q = (key) => url.searchParams.get(key);
  const b = body && typeof body === "object" ? body : null;
  return {
    connect: () => k.derive({ entityId: (b && b.entityId) || q("id"), assertedBy: (b && b.assertedBy) || undefined,
                              limit: (b && b.limit) || q("limit") }),
    connections: () => k.read({ entityId: q("id"), captureSha: q("sha256"), contentId: q("content"), limit: q("limit"),
                                viewer: q("viewer") }),
    connectionchoose: () => k.choose({
      capture: (b && b.capture) || q("capture"), other: (b && b.other) || q("other"), entity: (b && b.entity) || q("entity"),
      ref: (b && b.ref) || q("ref"),
      /* R15 (D-625): PRESENT is not TRUTHY; only an absent body value falls through to the query string. */
      occurrence: (b && b.occurrence != null) ? b.occurrence : q("occurrence"),
      author: q("author"), viewer: q("viewer") }),
    backlinks: () => k.backlinks({ target: q("target"), viewer: q("viewer") }),
    dangling: () => ({ dangling: k.dangling(q("viewer")) }),
    projectlinks: () => k.projectLinks({ sourceCapture: q("capture"), sourceBundle: q("bundle") || null,
                                         viewer: q("viewer"), identity: q("identity") }),
    connectionassert: () => k.assert({ a: (b && b.a) || q("a"), b: (b && b.b) || q("b"), basis: b ? b.basis : null,
                                       member: q("author"), viewer: q("viewer") }),
    connectionsasserted: () => k.asserted({ bundleId: q("bundle"), viewer: q("viewer"), limit: q("limit") }),
    filemembershipstore: () => k.storeFileMembership({ captureSha: q("sha256"), viewer: q("viewer"), env }),
    filemembership: () => k.fileMembership({ captureSha: q("sha256"), viewer: q("viewer"), limit: q("limit") }),
    filemembershipjudge: () => k.judgeFileMembership({ id: (b && b.id) || q("id"), verdict: (b && b.verdict) || q("verdict"),
                                                       reason: b ? b.reason : null, member: q("author"), viewer: q("viewer") }),
    themedeclare: () => k.declareTheme({ name: b ? b.name : null, test: b ? b.test : null, declarer: q("declarer"),
                                         administer: q("administer") }),
    themeplace: () => k.placeInTheme({ theme: (b && b.theme) || q("theme"), target: (b && b.target) || q("target"),
                                       note: b ? b.note : null, placer: q("placer"), viewer: q("viewer"),
                                       administer: q("administer") }),
    themepropose: () => k.proposeForTheme({ theme: (b && b.theme) || q("theme"), target: (b && b.target) || q("target"),
                                            note: b ? b.note : null, proposer: q("proposer"), viewer: q("viewer"),
                                            administer: q("administer") }),
    themewithdraw: () => k.withdrawFromTheme({ theme: (b && b.theme) || q("theme"), target: (b && b.target) || q("target"),
                                               reason: b ? b.reason : null, actor: q("actor"), viewer: q("viewer"),
                                               administer: q("administer") }),
    /* R68 (control-plane R92, op-declarations R67): `member` and `viewer` are the session's stamps, never the body's. */
    stepsource: () => k.attachStepSource({ relation: b ? b.relation : null, captureSha: b ? b.captureSha : null,
                                           extent: b ? b.extent : null, basis: b ? b.basis : null,
                                           member: q("member"), viewer: q("viewer") }),
    stepsourcewithdraw: () => k.withdrawStepSource({ id: b ? b.id : null, reason: b ? b.reason : null,
                                                     member: q("member"), viewer: q("viewer") }),
    themeread: () => k.readThemes({ id: q("id"), q: q("q"), limit: q("limit"), viewer: q("viewer"),
                                    administer: q("administer") }),
  };
}

/* R71 (T51; K4168, K4202; op-declarations R80, op-grades R49): the ops this module serves that the screens send, declared by
   their owner beside the ops map: each row's classes, weight and description are the op's existing rows', its fields are what
   the arm reads from the address and the body. `assertedBy` is not listed on `connect`: the door sets it to `system` (R38). */
export const DECLARED_OPS = Object.freeze({
  connect: { classes: ["admin","member","probe"], mutating: true, weight: "substrate", description: localize("connections.declared.connect", "connection derivation, keyed by entity"),
    fields: { accepts: ["id","entityId","limit"], requires: [["entityId","id"]] } },
  connectionassert: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", description: localize("connections.declared.connectionassert", "connection-directed: a member asserts a connection between two held documents with a stated basis, keyed by the document pair; writes an asserted-connection row, grade D, apart from derived ones"),
    fields: { accepts: ["a","b","basis"], requires: ["a","b","basis"] } },
  connectionchoose: { classes: ["admin","member","probe"], mutating: true, weight: "reversible", description: localize("connections.declared.connectionchoose", "connection-directed: records which mention is on point on ONE end of ONE connection, keyed by (capture, other capture, entity); writes a choice row beside the machine's pair and moves nothing existing"),
    fields: { accepts: ["capture","other","entity","ref","occurrence"], requires: ["capture","other","entity","ref"] } },
  stepsource: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "reasoned", description: localize("connections.declared.stepsource", "relation-directed: keyed by a declared relation and a held capture's passage; a member's cited backing of a declared step, withdrawn only by a reasoned act and never erased; moves no bundle"),
    fields: { accepts: ["relation","captureSha","extent","basis"], requires: ["relation","captureSha","extent","basis"] } },
  stepsourcewithdraw: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "reasoned", description: localize("connections.declared.stepsourcewithdraw", "relation-directed: keyed by a declared relation and a held capture's passage; a member's cited backing of a declared step, withdrawn only by a reasoned act and never erased; moves no bundle"),
    fields: { accepts: ["id","reason"], requires: ["id","reason"] } },
  themedeclare: { classes: ["admin","member"], mutating: true, weight: "reversible", description: localize("connections.declared.themedeclare", "member-directed: a member declares a theme (an idea and its test) keyed by nothing the record holds; writes a `themes` row, no edge and no entity, and is never evidence"),
    fields: { accepts: ["name","test"], requires: ["name","test"] } },
  themeplace: { classes: ["admin","member"], mutating: true, weight: "reversible", description: localize("connections.declared.themeplace", "theme-directed: a member places a document or a passage in a theme, keyed by (theme id, target); writes a `theme_placements` row as membership and no edge"),
    fields: { accepts: ["theme","target","note"], requires: ["theme","target"] } },
  themepropose: { classes: ["admin","member","probe"], mutating: true, weight: "reversible", description: localize("connections.declared.themepropose", "theme-directed: a member or a machine proposes a placement, keyed by (theme id, target); writes a `theme_placements` row as a hunch that is never membership"),
    fields: { accepts: ["theme","target","note"], requires: ["theme","target"] } },
  themeread: { classes: ["admin","member","probe"], mutating: false, weight: "read", description: localize("connections.declared.themeread", "read: one theme by id — its idea, its test, its declarer, its members and its hunches apart, each placement gated by the viewer's sight of the document — or the themes, searchable by a phrase"),
    fields: { accepts: ["id","q","limit"], requires: [] } },
  themewithdraw: { classes: ["admin","member"], mutating: true, weight: "reasoned", description: localize("connections.declared.themewithdraw", "theme-directed: a member withdraws a placement or rejects a hunch in a theme with a reason, keyed by (theme id, target); the placement is kept, shown as withdrawn"),
    fields: { accepts: ["theme","target","reason"], requires: ["theme","target","reason"] } },
});
