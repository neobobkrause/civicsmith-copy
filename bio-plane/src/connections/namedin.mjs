/* connections — A DOCUMENT AS A HOP'S END: the kind `named_in` (R74–R76; T53; N1260, DEC-409; K1469, K1470, K1486,
 * K1489). An entity is `named_in` a document when one of the document's captures resolves to it (`entities`' resolutions).
 * Each hop runs from the entity (`ENT-`) to the document (its bundle id) and is answered for either end: from an entity,
 * one hop to each document the viewer may see, through the strongest resolution of its captures (`entities.concerns`,
 * bounded and sight-redacted, never the unbounded `strongestByCapture`); from a document, one hop to each entity its
 * captures resolve to (`entities.resolutionsFor`). The kind is evidentiary: its evidence is the resolved reference.
 * Every bundle id is asked of the module's own sight check before it is answered or counted (R76). A node with more
 * than `hubBoundOf('named_in')` hops is a hub, answered by its size with no items (R74). Synchronous; writes nothing. */
import { canonicalJson, sha256HexSync } from "../record-grammar/index.mjs";
import { hubBoundOf } from "../connection-grammar/index.mjs";
import { localize } from "../setup-words/index.mjs";
import { capturedGrade } from "./stepsources.mjs";

/** R74: the kind, its class and its members' word (provisional, K1486). */
export const NAMED_IN_KIND = "named_in";
export const NAMED_IN_KINDS = Object.freeze([Object.freeze({ kind: NAMED_IN_KIND, word: localize("connections.namedin.kind_word", "named in"),
                                                              class: "evidentiary" })]);
/** R74: what this kind declares to its conformance battery: undated (a resolution states that a document names the
 *  entity, not when), and fenced by the document's sight (R33). */
export const NAMED_IN_DECLARES = Object.freeze({ undated: true });
/** R74, R76: the hub bound of the kind, and the read bound: one past the hub bound, so a set just over it is counted
 *  whole and named a hub, and a larger set is said to be cut at this bound. */
export const NAMED_IN_HUB = hubBoundOf(NAMED_IN_KIND);
export const NAMED_IN_READ_LIMIT = NAMED_IN_HUB + 1;

const VALID = Object.freeze({ from: null, to: null, precision: "day", zone: "UTC" });
/** R74: the reason a `named_in` hop is undetermined at a date, a key with its fills; its sentence is written here. */
export const NAMED_IN_UNDATED = Object.freeze({ key: "connections.namedin.undated", vars: Object.freeze({}) });
export const NAMED_IN_UNDATED_SAYS = localize("connections.namedin.undated", "a document naming a subject states that it names it, not when the subject held, so whether this holds at the date asked is undetermined, never out");

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** R74: a hop's id, the SHA-256 of the canonical JSON of `{kind, from, to, capture_sha}`. */
export function namedInId({ from, to, capture_sha }) {
  return sha256HexSync(canonicalJson({ kind: NAMED_IN_KIND, from, to, capture_sha }));
}

/**
 * R74–R76: every `named_in` hop of `node` the viewer may see, unpaged and sorted by id, for `k`, one connections
 * instance; `isEntity` says whether the node is an entity. Answers `{items, hub?, extra}`, or a refusal.
 */
export function namedInSet(k, args, isEntity) {
  const a = isObj(args) ? args : {};
  const { node, kinds, viewer } = a;
  if (viewer === undefined || viewer === null || viewer === "")
    return { refused: "VIEWER_MISSING", why: localize("connections.namedin.viewer_missing", "a read names the member reading; an absent viewer is neither an administrator nor the public") };
  if (Array.isArray(kinds) && !kinds.includes(NAMED_IN_KIND)) return { items: [], extra: {} };
  if (typeof node !== "string" || !node) return { items: [], extra: {} };
  const read = isEntity ? fromEntity(k, node, viewer) : fromDocument(k, node, viewer);
  const memo = new Map();
  const items = read.hops.map((h) => item(k, h, memo)).sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  const size = items.length;
  const extra = {
    named_in: { set_size: size,
                why: isEntity
                  ? localize("connections.namedin.entity_set", "{size} documents you may see name this subject", { size: String(size) })
                  : localize("connections.namedin.document_set", "this document names {size} subjects", { size: String(size) }) },
    ...(read.truncated
      ? { truncated: true,
          bounds: [{ kind: NAMED_IN_KIND, node, limit: NAMED_IN_READ_LIMIT,
                     why: localize("connections.namedin.read_cut", "the resolutions behind this node were read up to {limit} rows and more are held, so these hops are not all of them", { limit: String(NAMED_IN_READ_LIMIT) }) }] }
      : {}),
  };
  if (read.truncated) for (const i of items) i.truncated = true;
  if (size > NAMED_IN_HUB)
    return { items: [], extra,
             hub: { set_size: size,
                    why: localize("connections.namedin.hub", "{size} hops of the kind named in meet here, more than the {hub} a walk steps through, so none is listed", { size: String(size), hub: String(NAMED_IN_HUB) }) } };
  return { items, extra };
}

/* R74, R76: from an entity, one hop per document the viewer may see, the strongest resolution over its captures (ties:
   the first capture by digest). `concerns` redacts a hidden bundle; each id it answers is asked again here. */
function fromEntity(k, entityId, viewer) {
  const ents = k.entities;
  const c = ents && typeof ents.concerns === "function" ? ents.concerns({ entityId, limit: NAMED_IN_READ_LIMIT, viewer }) : null;
  if (!c || !c.ok) return { hops: [], truncated: false };
  const best = new Map();
  for (const d of c.documents) {
    if (typeof d.bundle_id !== "string" || !d.bundle_id || !k.sees(d.bundle_id, viewer)) continue;
    const held = best.get(d.bundle_id);
    if (!held || k.rankOf(d.grade) > k.rankOf(held.grade)
        || (k.rankOf(d.grade) === k.rankOf(held.grade) && d.capture_sha < held.capture_sha)) best.set(d.bundle_id, d);
  }
  return { truncated: !!c.truncated,
           hops: [...best.values()].map((d) => ({ entity: entityId, bundle: d.bundle_id, capture_sha: d.capture_sha, ref: d.ref, grade: d.grade })) };
}

/* R74: from a document the viewer may see, one hop per entity its captures resolve to, the strongest resolution (ties:
   the first capture by digest, then the first reference). */
function fromDocument(k, bundleId, viewer) {
  const ents = k.entities;
  if (!k.sees(bundleId, viewer) || !ents || typeof ents.resolutionsFor !== "function") return { hops: [], truncated: false };
  const caps = [...k.sql.exec(`SELECT capture_sha FROM register WHERE bundle_id = ? ORDER BY capture_sha`, bundleId)].map((r) => r.capture_sha);
  const best = new Map();
  let truncated = false, read = 0;
  for (const sha of caps) {
    if (read >= NAMED_IN_READ_LIMIT) { truncated = true; break; }
    const r = ents.resolutionsFor({ captureSha: sha, limit: NAMED_IN_READ_LIMIT - read, viewer });
    if (!r || !r.ok) continue;
    read += r.resolutions.length;
    if (r.truncated) truncated = true;
    for (const x of r.resolutions) {
      if (typeof x.entity_id !== "string" || !x.entity_id || x.bundle_id !== bundleId) continue;
      const held = best.get(x.entity_id);
      if (!held || k.rankOf(x.grade) > k.rankOf(held.grade)) best.set(x.entity_id, x);
    }
  }
  return { truncated,
           hops: [...best.values()].map((x) => ({ entity: x.entity_id, bundle: bundleId, capture_sha: x.capture_sha, ref: x.ref, grade: x.grade })) };
}

/* One hop in `connection-grammar`'s shape (R74): from the entity, to the document. */
function item(k, h, memo) {
  const g = capturedGrade(k, h.capture_sha, memo);
  return {
    id: namedInId({ from: h.entity, to: h.bundle, capture_sha: h.capture_sha }),
    from: h.entity, to: h.bundle, kind: NAMED_IN_KIND, owner: "connections", valid: { ...VALID },
    evidence: [{ source: h.bundle, capture_sha: h.capture_sha, ref: h.ref }],
    grade: { assertion: h.grade, ends: [h.grade, g.grade] }, grade_says: g.says,
    derived: null,
    undetermined: { why: { ...NAMED_IN_UNDATED } },
  };
}
