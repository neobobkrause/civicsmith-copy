/* connections — the connection owner (R62–R65; T33-29, B1a.6, K1470, K1486): co-mention presented in
 * `connection-grammar`'s one shape as the derived kind `mentioned_together` ("mentioned together"), so `explore` walks
 * it through the one registry. Each item is one of R1's derived connections (R59's rows) between two documents through
 * one entity. The read reads and never derives: a node whose entity was never derived answers what is held.
 *
 * Read with BOB's question J1 (T33): an undated kind has no item `in` or `out` at a date, so every item is marked
 * undetermined; an entity over the co-mention hub threshold is named in `hubs`, apart from `hub`, which keeps
 * `connection-grammar`'s meaning (the node's own set over `BOUNDS.hub`, with no items); one item per (document pair,
 * entity), its id `derivedId` of the pair in sorted order, the derivation time and the pair rule through the entity;
 * a capped derivation is read from `connection_derivations` (R64). */
import { BOUNDS, derivedId } from "../connection-grammar/index.mjs";
import { localize, word } from "../setup-words/index.mjs";

/** R62: the owner, its one kind, the members' word (K1486) and its class. */
export const MENTIONED_OWNER = "connections";
export const MENTIONED_KIND = "mentioned_together";
export const MENTIONED_KINDS = Object.freeze([Object.freeze({ kind: MENTIONED_KIND, word: localize("connections.mentioned.kind_word", "mentioned together"), class: "derived" })]);
/** R62 (N560; K1563 (2); connection-grammar R9): what this owner declares to its conformance battery. Co-mention
 *  states no dates (R63), so R6's `at` rule cannot be shown and is answered inapplicable. It is not group-wide: a
 *  co-mention with a document the viewer may not see is fenced (R33), so R7's sight check runs whole. */
export const MENTIONED_DECLARES = Object.freeze({ undated: true });
/** R65 (X110; legistar-events §6, M-P4): an entity concerned by more than this many documents is a co-mention hub;
 *  it is R2's document bound at the default pair limit (32 documents, 496 pairs). */
export const CO_MENTION_HUB = 32;
/** R65: the warn band's floor (connection-grammar's 250–1,000): a set this large is answered whole, its size stated. */
export const WARN_BAND = 250;

/* A co-mention states no dates (R63): `valid` unstated. The zone names no place (R37); with no bound stated it is
   never read. */
const VALID = Object.freeze({ from: null, to: null, precision: "day", zone: "UTC" });
/** R63: the reason a co-mention is undetermined, a key with its fills (connection-grammar R6; the words rule). The
 *  reason is read by its key; its sentence is written here, at its id, so the list holds it (localize, R14). */
export const MENTIONED_UNDATED = Object.freeze({ key: "connections.mentioned.co_mention_undated", vars: Object.freeze({}) });
export const MENTIONED_UNDATED_SAYS = localize("connections.mentioned.co_mention_undated", "a co-mention states no dates: when the two documents came to concern the same subject is not stated, so whether this connection holds at the date asked is undetermined, never out");

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** The pair rule an item states as its method, through its entity (J1 (3)). */
export function mentionedMethod(pairRule, entityId) {
  return `${pairRule || "strongest-graded/scan-order (derived before the tie-break was recorded)"} through ${entityId}`;
}

/**
 * R63–R65: `neighbours({node, kinds, at, page, viewer, scope})` for `node` a bundle id, over `k`, one connections
 * instance; `positionOf(row, side)` reads an end's recorded position. `at` and `scope` change nothing: the kind is
 * undated and holds no hunch. Synchronous; writes nothing.
 */
export function mentionedNeighbours(k, args, opts = {}) {
  const s = mentionedSet(k, args, opts);
  if (s.refused) return s;
  if (s.hub) return { items: [], hub: s.hub, ...s.extra };
  const page = isObj(args) ? args.page : null;
  const after = isObj(page) && typeof page.after === "string" ? page.after : null;
  const rest = after ? s.items.filter((i) => i.id > after) : s.items;
  const shown = rest.slice(0, BOUNDS.fanout);
  const more = rest.length > shown.length;
  return { items: shown, ...(more ? { next: { after: shown[shown.length - 1].id } } : {}), ...s.extra };
}

/**
 * R63–R65, R74, R75: every `mentioned_together` item of `node`, unpaged and sorted by id: `{items, hub?, extra}`, or a
 * refusal; `extra` the answer's own fields (`hubs`, the co-mention hub judged on this kind alone, R75; `truncated` and
 * `bounds`, R64; the warn band's `set_size` and `says`).
 */
export function mentionedSet(k, args, { positionOf = () => null } = {}) {
  const a = isObj(args) ? args : {};
  const { node, kinds, viewer } = a;
  /* connection-grammar R7: a read names its viewer; an absent one is neither an administrator nor the public. */
  if (viewer === undefined || viewer === null || viewer === "")
    return { refused: "VIEWER_MISSING", why: word("duties.why.read_names_member") };
  if (Array.isArray(kinds) && !kinds.includes(MENTIONED_KIND)) return { items: [], extra: {} };
  /* R33: a node the viewer may not see answers as one the record does not hold. */
  if (typeof node !== "string" || !node || !k.sees(node, viewer)) return { items: [], extra: {} };
  const keep = k.redactor(viewer);
  const rows = [...k.sql.exec(
    `SELECT * FROM connections WHERE (a_bundle_id = ? OR b_bundle_id = ?) AND a_bundle_id <> b_bundle_id
      ORDER BY entity_id, a_capture_sha, b_capture_sha`, node, node)]
    .filter((r) => keep(r.a_bundle_id === node ? r.b_bundle_id : r.a_bundle_id));

  /* R65: each entity's set, counted over the documents the viewer may see, so a hidden one neither shows nor moves
     the answer (R33; connection-grammar R7). */
  const entityIds = [...new Set(rows.map((r) => r.entity_id))];
  const hubs = [], through = new Map();
  for (const e of entityIds) {
    const size = k.visibleCaptureCount(e, viewer);
    if (size > CO_MENTION_HUB) {
      hubs.push({ entity: e, set_size: size,
                  why: word("connections.why.documents_see_concern", { size: String(size), entry: String(e), co_mention_hub: String(CO_MENTION_HUB) }) });
      continue;
    }
    const d = k.lastDerivation(e);
    through.set(e, d);
  }

  /* One item per (document pair, entity): the strongest row, ties by the capture digests (J1 (3)). */
  const best = new Map();
  for (const r of rows) {
    if (!through.has(r.entity_id)) continue;
    const other = r.a_bundle_id === node ? r.b_bundle_id : r.a_bundle_id;
    const key = `${other}\u0000${r.entity_id}`;
    const held = best.get(key);
    if (!held || k.rankOf(r.grade) > k.rankOf(held.grade)) best.set(key, r);
  }
  const items = [...best.values()].map((r) => item(r, through.get(r.entity_id), positionOf)).sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));

  const bounds = [];
  for (const [e, d] of [...through.entries()].sort(([x], [y]) => (x < y ? -1 : 1)))
    if (d && d.truncated && items.some((i) => i.derived.inputs[0].entity === e))
      bounds.push({ entity: e, documents: d.documents, document_limit: d.document_limit,
                    resolution_rows: d.resolution_rows, pair_limit: d.pair_limit, why: cappedWhy(e, d) });
  const extra = { ...(hubs.length ? { hubs: hubs.sort((x, y) => (x.entity < y.entity ? -1 : 1)) } : {}),
                  ...(bounds.length ? { truncated: true, bounds } : {}) };

  /* connection-grammar R6: a node whose set exceeds the hub bound is answered by its size, with no items. */
  if (items.length > BOUNDS.hub)
    return { items: [], hub: { set_size: items.length,
             why: word("connections.why.document_mentioned_together", { items: String(items.length), hub: String(BOUNDS.hub) }) }, extra };

  return { items, extra: { ...extra,
           ...(items.length >= WARN_BAND
             ? { set_size: items.length,
                 says: word("connections.says.document_mentioned_together", { items: String(items.length) }) }
             : {}) } };
}

function cappedWhy(e, d) {
  return word("connections.last_derivation_stopped", { entry: String(e), documents: String(d.documents), document_limit: String(d.document_limit), pair_limit: String(d.pair_limit), resolution_rows: String(d.resolution_rows) });
}

/* One row as the shape (R63): the two documents in sorted order, so either end gives the same id. */
function item(r, d, positionOf) {
  const aFirst = r.a_bundle_id < r.b_bundle_id;
  const end = (side) => ({ bundle: r[`${side}_bundle_id`], capture: r[`${side}_capture_sha`], ref: r[`${side}_ref`] ?? null,
                           grade: r[`${side}_grade`], position: positionOf(r, side) });
  const [f, t] = aFirst ? [end("a"), end("b")] : [end("b"), end("a")];
  const method = mentionedMethod(r.pair_rule, r.entity_id);
  const asOf = typeof r.at === "string" && r.at ? r.at : "unrecorded";
  const id = derivedId({ kind: MENTIONED_KIND, from: f.bundle, to: t.bundle, as_of: asOf, method });
  return {
    id, from: f.bundle, to: t.bundle, kind: MENTIONED_KIND, owner: MENTIONED_OWNER, valid: { ...VALID },
    evidence: [f, t].map((x) => ({ source: x.bundle, capture: x.capture, ref: x.ref, position: x.position })),
    grade: { assertion: r.grade, ends: [f.grade, t.grade] },
    derived: { method, as_of: asOf,
               inputs: [{ entity: r.entity_id }, ...[f, t].map((x) => ({ end: x.bundle, capture: x.capture, ref: x.ref }))] },
    established: !!r.established, asserted_by: r.asserted_by, basis: r.basis,
    undetermined: { why: { ...MENTIONED_UNDATED } },
    ...(d && d.truncated ? { truncated: true } : {}),
  };
}
