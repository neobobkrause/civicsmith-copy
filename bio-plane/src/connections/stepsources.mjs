/* connections — A SOURCE ATTACHED TO A DECLARED STEP (R68, R69, R36; T48-20; N1030, K3145, K1487 (3); `entities` R26).
 * A declared relation (`entities`' `REL-`) has no grade of its own, and `explore` walks it as "declared, not
 * evidenced". A member backs it with a passage of a held capture that states it: the attached source is recorded here,
 * apart from the relation, which stays declared and ungraded in `entities`. Each standing source is its own evidenced
 * fact, the kind `step_source` (class `evidentiary`), answered in `connection-grammar`'s shape for an entity node at
 * either end of the relation, graded no higher than the cited capture (`provenance.captureGrade`, through `content`).
 *
 * Read with this job's QUESTION J1 (T48): an extent is judged by `content`'s shape check (`canonicalExtent` never
 * refuses) and keyed by `canonicalExtent`; each evidence entry also names its `source` (the cited capture's bundle),
 * which `connection-grammar` R1 requires; a capture whose grade is not determined answers the lowest grade, stated. */
import { isMachineIdentity } from "../record-grammar/actors.mjs";
import { BASIS_GRADES } from "../record-grammar/index.mjs";
import { checkContentExtent, canonicalExtent, CONTENT_EXTENT_DOCUMENT_ONLY } from "../content/index.mjs";
import { BOUNDS, LOWEST_GRADE } from "../connection-grammar/index.mjs";
import { localize, word } from "../setup-words/index.mjs";

/** R69: the kind, its class and its members' word (provisional until the design stream gives one; K1486, K1469). */
export const STEP_SOURCE_KIND = "step_source";
export const STEP_SOURCE_KINDS = Object.freeze([Object.freeze({ kind: STEP_SOURCE_KIND, word: localize("connections.stepsources.kind_word", "stated in a source"),
                                                                class: "evidentiary" })]);
/** R69: what this kind declares to its conformance battery: undated (a source states the step, not when it held),
 *  and not group-wide (a source whose capture the viewer may not see is fenced, R33). */
export const STEP_SOURCE_DECLARES = Object.freeze({ undated: true });
/** R68: a member's stated basis, stored whole up to this bound and refused over it (as R53's). */
export const STEP_SOURCE_BASIS_MAX = 4000;
/** R68: the id of an attached source, `STEPSOURCE-<n>`. */
export const STEP_SOURCE_ID_PREFIX = "STEPSOURCE-";

const VALID = Object.freeze({ from: null, to: null, precision: "day", zone: "UTC" });
/** R69: the reason an attached source is undetermined at a date, a key with its fills (the words rule, R14); its
 *  sentence is written here, at its id, so the list holds it. */
export const STEP_SOURCE_UNDATED = Object.freeze({ key: "connections.stepsources.undated_source", vars: Object.freeze({}) });
export const STEP_SOURCE_UNDATED_SAYS = localize("connections.stepsources.undated_source", "a source attached to a declared step states the step, not when it held, so whether it holds at the date asked is undetermined, never out");
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const str = (v) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());
const idOf = (n) => `${STEP_SOURCE_ID_PREFIX}${n}`;
const numOf = (id) => { const m = /^(?:STEPSOURCE-)?(\d+)$/.exec(str(id)); return m ? Number(m[1]) : null; };

export class StepSources {
  constructor(k) { this.k = k; this.sql = k.sql; }

  #rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  #one(q, ...a) { for (const r of this.sql.exec(q, ...a)) return r; return null; }

  /* R68: the relation by its id, through `entities.readRelation`; null when not held or withdrawn. */
  #relation(id) {
    const e = this.k.entities;
    if (!id || !e || typeof e.readRelation !== "function") return null;
    const r = e.readRelation({ relationId: id });
    return r && r.ok && r.found && r.relation && !r.relation.withdrawn ? r.relation : null;
  }

  /** R68: one attached source as recorded, standing or withdrawn with who, when and why. */
  view(r) {
    return { id: idOf(r.source_id), relation: r.relation_id, from: r.from_entity, to: r.to_entity,
             capture_sha: r.capture_sha, extent: JSON.parse(r.extent), basis: r.basis, member: r.member, at: r.at,
             standing: r.withdrawn_at == null,
             withdrawn: r.withdrawn_at == null ? null : { by: r.withdrawn_by, at: r.withdrawn_at, reason: r.withdrawn_reason } };
  }

  /** R68 (`op=stepsource`): a member attaches a passage of a held capture to a declared step. Refusals in order, each
   *  writing nothing; the same (relation, capture, extent) standing again writes nothing. */
  attach({ relation = null, captureSha = null, extent = null, basis = null, member = null, viewer = null } = {}) {
    const who = str(member);
    if (!who || isMachineIdentity(who))
      return { ok: false, reason: "STEP_SOURCE_NOT_A_MEMBER",
               detail: who ? localize("connections.stepsources.backing_machine_credential", "'{who}' is a machine credential; backing a declared step with a source is a member's act, in their name", { who: String(who.slice(0, 60)) })
                           : localize("connections.stepsources.act_names_no_member", "this act names no member; the plane stamps the member from the credential that asked") };
    const relId = str(relation);
    const rel = this.#relation(relId);
    if (!rel)
      return { ok: false, reason: "NO_SUCH_RELATION", relation: relId || null,
               detail: localize("connections.stepsources.no_declared_relation", "no declared relation is held by that id (or it was withdrawn); a source is attached to a step someone declared") };
    const sha = str(captureSha).toLowerCase();
    const home = /^[0-9a-f]{64}$/.test(sha) ? this.#one(`SELECT bundle_id FROM register WHERE capture_sha=?`, sha) : null;
    if (!home || !this.k.sees(home.bundle_id, viewer))
      return { ok: false, reason: "CAPTURE_NOT_HELD", capture_sha: sha || null,
               detail: localize("connections.stepsources.no_capture_by_digest", "this record holds no capture by that digest that you can see") };
    let ext = extent;
    if (typeof ext === "string") { try { ext = JSON.parse(ext); } catch { ext = null; } }
    const bad = checkContentExtent(ext, CONTENT_EXTENT_DOCUMENT_ONLY);
    if (bad)
      return { ok: false, reason: "EXTENT_MALFORMED", extent_refusal: bad.code ?? null,
               detail: localize("connections.stepsources.extent_not_readable", "the passage is not named by an extent the record can read: {why}", { why: String(bad.detail || bad.code) }) };
    const words = typeof basis === "string" ? basis.trim() : "";
    if (!words)
      return { ok: false, reason: "STEP_SOURCE_NO_BASIS",
               detail: localize("connections.stepsources.carries_basis", "an attached source carries its basis: what the passage states about this step, in your words") };
    if (words.length > STEP_SOURCE_BASIS_MAX)
      return { ok: false, reason: "STEP_SOURCE_BASIS_TOO_LONG", limit: STEP_SOURCE_BASIS_MAX,
               detail: localize("connections.stepsources.basis_over_limit", "{count} characters of basis, over {limit}; refused rather than cut", { count: String(words.length), limit: String(STEP_SOURCE_BASIS_MAX) }) };
    const key = canonicalExtent(ext);
    const held = this.#one(`SELECT * FROM step_sources WHERE relation_id=? AND capture_sha=? AND extent=? AND withdrawn_at IS NULL
                             ORDER BY source_id LIMIT 1`, rel.relation_id, sha, key);
    if (held) return { ok: true, wrote: false, step_source: this.view(held),
                       says: word("connections.says.passage_already_backs") };
    const at = this.k.now();
    this.sql.exec(`INSERT INTO step_sources (relation_id, from_entity, to_entity, capture_sha, bundle_id, extent, basis, member, at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  rel.relation_id, rel.from_entity, rel.to_entity, sha, home.bundle_id, key, words, who, at);
    const row = this.#one(`SELECT * FROM step_sources WHERE relation_id=? AND capture_sha=? AND extent=? AND withdrawn_at IS NULL
                            ORDER BY source_id DESC LIMIT 1`, rel.relation_id, sha, key);
    return { ok: true, wrote: true, step_source: this.view(row),
             says: word("connections.says.recorded_backs_declared", { who: String(who), relation_id: String(rel.relation_id), relation: String(rel.relation) }) };
  }

  /** R68 (`op=stepsourcewithdraw`): the member who attached a source withdraws it, saying why; it stays recorded. */
  withdraw({ id = null, reason = null, member = null, viewer = null } = {}) {
    const who = str(member);
    if (!who || isMachineIdentity(who))
      return { ok: false, reason: "STEP_SOURCE_NOT_A_MEMBER",
               detail: who ? localize("connections.stepsources.withdrawing_machine_credential", "'{who}' is a machine credential; withdrawing an attached source is a member's act", { who: String(who.slice(0, 60)) })
                           : localize("connections.stepsources.act_names_no_member", "this act names no member; the plane stamps the member from the credential that asked") };
    const why = typeof reason === "string" ? reason.trim() : "";
    if (!why) return { ok: false, reason: "NO_REASON", detail: localize("connections.stepsources.keeps_reason", "a withdrawn source keeps its reason beside it; none was given") };
    const n = numOf(id);
    const row = n == null ? null : this.#one(`SELECT * FROM step_sources WHERE source_id=?`, n);
    if (!row || row.withdrawn_at != null || !this.k.sees(row.bundle_id, viewer))
      return { ok: false, reason: "NO_SUCH_STEP_SOURCE", id: id ?? null,
               detail: localize("connections.stepsources.no_standing_source", "no standing attached source by that id that you can see") };
    if (row.member !== who)
      return { ok: false, reason: "STEP_SOURCE_NOT_THE_ATTACHER", id: idOf(row.source_id),
               detail: localize("connections.stepsources.withdrawn_by_attacher", "an attached source is withdrawn by the member who attached it") };
    const at = this.k.now();
    this.sql.exec(`UPDATE step_sources SET withdrawn_by=?, withdrawn_at=?, withdrawn_reason=? WHERE source_id=? AND withdrawn_at IS NULL`,
                  who, at, why.slice(0, STEP_SOURCE_BASIS_MAX), row.source_id);
    return { ok: true, step_source: this.view(this.#one(`SELECT * FROM step_sources WHERE source_id=?`, row.source_id)),
             says: word("connections.says.withdrew_source_saying", { who: String(who) }) };
  }

  /** R69: `neighbours` for an entity node: each standing source of a standing relation the node is an end of, whose
   *  capture the viewer may see, as one `step_source` connection. Synchronous; writes nothing. */
  neighbours(args) {
    const s = this.set(args);
    if (s.refused) return s;
    if (s.hub) return { items: [], hub: s.hub };
    return pageOf(s.items, isObj(args) ? args.page : null);
  }

  /** R69, R74: every `step_source` hop of the node, unpaged and sorted by id: `{items, hub?, extra}`, or a refusal. */
  set(args) {
    const a = isObj(args) ? args : {};
    const { node, kinds, viewer } = a;
    if (viewer === undefined || viewer === null || viewer === "")
      return { refused: "VIEWER_MISSING", why: word("duties.why.read_names_member") };
    if (Array.isArray(kinds) && !kinds.includes(STEP_SOURCE_KIND)) return { items: [], extra: {} };
    if (typeof node !== "string" || !node) return { items: [], extra: {} };
    const keep = this.k.redactor(viewer);
    const relations = new Map(), grades = new Map();
    const relationOf = (id) => { if (!relations.has(id)) relations.set(id, this.#relation(id)); return relations.get(id); };
    const items = this.#rows(
      `SELECT * FROM step_sources WHERE withdrawn_at IS NULL AND (from_entity = ? OR to_entity = ?) ORDER BY source_id`, node, node)
      .filter((r) => keep(r.bundle_id) && relationOf(r.relation_id))
      .map((r) => this.#item(r, grades))
      .sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
    if (items.length > BOUNDS.hub)
      return { items: [], extra: {}, hub: { set_size: items.length,
               why: word("connections.why.sources_back_declared", { items: String(items.length), hub: String(BOUNDS.hub) }) } };
    return { items, extra: {} };
  }

  #item(r, memo) {
    const g = capturedGrade(this.k, r.capture_sha, memo);
    return {
      id: idOf(r.source_id), from: r.from_entity, to: r.to_entity, kind: STEP_SOURCE_KIND, owner: "connections",
      valid: { ...VALID },
      evidence: [{ source: r.bundle_id, capture_sha: r.capture_sha, extent: JSON.parse(r.extent), basis: r.basis,
                   relation: r.relation_id }],
      grade: { assertion: g.grade, ends: [LOWEST_GRADE, LOWEST_GRADE] }, grade_says: g.says,
      derived: null, attached_by: r.member, at: r.at,
      undetermined: { why: { ...STEP_SOURCE_UNDATED } },
    };
  }
}

/** R69, R74: the cited capture's grade, never above it: `provenance.captureGrade` through `content`; a capture whose
 *  grade is not determined answers the lowest grade, and says so (J1 (3)). `memo` keeps one read per capture. */
export function capturedGrade(k, sha, memo) {
  if (memo.has(sha)) return memo.get(sha);
  const p = k.content && k.content.provenance;
  let g = null;
  try { g = p && typeof p.captureGrade === "function" ? p.captureGrade(sha) : null; } catch { g = null; }
  const letter = g && BASIS_GRADES.includes(g.grade) ? g.grade : null;
  const out = letter
    ? { grade: letter, says: word("connections.says.cited_capture_grade", { letter: String(letter) }) }
    : { grade: LOWEST_GRADE, says: word("connections.says.cited_capture_grade_determined", { why: String(g && g.why ? ` (${String(g.why).slice(0, 200)})` : ``), lowest_grade: String(LOWEST_GRADE) }) };
  memo.set(sha, out);
  return out;
}

/** R69, R74: one page of a set sorted by id, at most `BOUNDS.fanout` items after `page.after`, with `next` when more. */
export function pageOf(items, page) {
  const after = isObj(page) && typeof page.after === "string" ? page.after : null;
  const rest = after ? items.filter((i) => i.id > after) : items;
  const shown = rest.slice(0, BOUNDS.fanout);
  return { items: shown, ...(rest.length > shown.length ? { next: { after: shown[shown.length - 1].id } } : {}) };
}
