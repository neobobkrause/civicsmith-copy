/* citation — who recorded something from this passage (R13; T36-21, N715, DEC-164 (4); K1941, K2063, K2126). The read
 * answers in `events` R49's one shape (with K2114's and K2116's wording), `module: "citation"`, over the citations held in
 * the citing objects' CURRENT bytes whose document is pinned to the capture: each leg of an inquiry's `basis[]` and each
 * `cites` edge of a project's `references[]`. It registers with `retrieval` (its R76) once, where `citationOf` first
 * makes this module, so "Find in this" (retrieval R73) can say a found passage is already cited and by whom.
 *
 * NO TABLE OF ITS OWN (R6): a citation exists only in the citing document's bytes, so this read finds them there. The
 * inquiries are found through `inquiry`'s leg projection (`restingOn`, its R12; K2132) and the projects listed through
 * `record-core` (`listByType`, `head`: R36, R41), no projection holding a case edge's pin; each one's citations are
 * parsed once per version of its bytes, held in memory keyed by its `bundleSha`; a version is never re-read. `by` and `at` come
 * from the citing object's own history (`record-core` `readImage`, R15): the first promotion, in write order, whose
 * `bundle.md` carries the leg or edge (K2126; BOB #136's draft: "the first version whose bytes carry the leg or edge").
 *
 * THE PIN (R2): the leg's or edge's `extent_capture`; else, for a leg naming a `content_id`, that content row's capture;
 * else `content.captureFor(target)`, the capture an unpinned citation of the document addresses (content R11), which is
 * the one `inquiry`'s projection resolves an unpinned leg through.
 *
 * Writes nothing; never throws (a failure is answered as a refusal naming it, so `findIn` names this read in
 * `recorded_not_read` rather than reading an empty answer as "nobody recorded this"). */

import { normalizeType } from "../record-grammar/types.mjs";
import { parseFrontmatter } from "../record-grammar/frontmatter.mjs";
import { canonicalExtent, extentRelation, citationExtent, CONTENT_EXTENT_KINDS } from "../content/index.mjs";
import { localize } from "../setup-words/index.mjs";

/** R13 (events R49): `limit` is clamped to 1–500, 100 by default.
 *  @type {number} */
export const RECORDED_LIMIT_DEFAULT = 100;
/** @type {number} */
export const RECORDED_LIMIT_MAX = 500;
/** The page by which citing objects are listed (record-core R36's bound). */
const LIST_PAGE = 200;
const RELATIONS = ["same", "narrower", "wider"];
const HEX64 = /^[0-9a-f]{64}$/;
const BUNDLE_MD_HISTORY = (key) => `_history/bundle_${key}.md`;   // record-core's snapshot path of `bundle.md` (R15)

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const said = (v) => typeof v === "string" && v.trim() !== "";
const known = (e) => isObj(e) && typeof e.kind === "string" && Object.prototype.hasOwnProperty.call(CONTENT_EXTENT_KINDS, e.kind);
/* events R49 (K2116, K231): the shape's own refusals carry their code and no catalogue row in any module reading in it. */
const refused = (code, why) => ({ ok: false, refused: code, code, reason: code, why });
const clamp = (limit) => {
  const n = Number(limit);
  return limit === null || limit === undefined || limit === "" || !Number.isFinite(n) ? RECORDED_LIMIT_DEFAULT
    : Math.max(1, Math.min(Math.trunc(n), RECORDED_LIMIT_MAX));
};
const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);

/** The citations one version of a citing object's bytes holds, each `{ident, target, pin, kind, field, key, extent,
 *  withdrawn}`; `ident` names the leg or edge across versions (a leg by its target, part and stated pin; an edge by its
 *  target), `key` its extent in content's canonical form, `pin` null when the citation states none. `c` reaches
 *  `content` (`contentRow`). */
export function citationsIn(c, data, type) {
  const out = [];
  if (!isObj(data)) return out;
  /* The pin the bytes (or the content row they name) state; null for an unpinned citation, whose capture is the one its
     document's citation addresses NOW (`content.captureFor`), resolved at each read, since it can move without these
     bytes moving (the document's first capture held after the citation was written). */
  const pinOf = (authored, contentRow) => {
    if (said(authored)) return authored.trim().toLowerCase();
    if (contentRow && said(contentRow.capture_sha)) return contentRow.capture_sha.toLowerCase();
    return null;
  };
  if (type === "inquiry") {
    for (const l of Array.isArray(data.basis) ? data.basis : []) {
      if (!isObj(l) || !said(l.target)) continue;
      const cid = typeof l.content_id === "string" && HEX64.test(l.content_id.trim()) ? l.content_id.trim() : null;
      const row = cid && typeof c.content.contentRow === "function" ? c.content.contentRow(cid) : null;
      const ext = row && said(row.extent_kind) ? { kind: row.extent_kind, ...(isObj(row.extent) ? row.extent : {}) } : citationExtent(l);
      const key = canonicalExtent(known(ext) ? ext : { kind: "document" });
      const pin = pinOf(l.extent_capture, row);
      out.push({ ident: `leg\u0000${l.target}\u0000${key}\u0000${pin}`, target: l.target, pin, kind: "leg", field: "basis",
                 key, extent: JSON.parse(key), withdrawn: false });
    }
  } else if (type === "project") {
    const key = canonicalExtent({ kind: "document" });
    for (const r of Array.isArray(data.references) ? data.references : []) {
      if (!isObj(r) || r.rel !== "cites" || !said(r.target)) continue;
      out.push({ ident: `cites\u0000${r.target}`, target: r.target, pin: pinOf(r.extent_capture, null),
                 kind: "cites", field: "references", key, extent: JSON.parse(key), withdrawn: r.status === "severed" });
    }
  }
  return out;
}

/** `by` and `at` for each citation `ident` of `bundleId`'s current bytes: the first promotion, in write order (R16's
 *  `seq`), whose `bundle.md` carries it. The `bundle.md` in force after an entry is the one the NEXT entry that
 *  replaced it archived (R15's snapshot), or the live file. An ident history cannot place (a version held only as a
 *  blob) is given the latest entry's. */
export function firstWriters(c, bundleId, type, idents) {
  const img = c.record.readImage(bundleId) || {};
  let entries = [];
  try { entries = JSON.parse(img["_history/manifest.json"] || "{}").entries || []; } catch { entries = []; }
  entries = entries.slice().sort((a, b) => a.seq - b.seq);
  const out = new Map();
  const parsed = new Map();
  const identsIn = (text) => {
    if (typeof text !== "string") return new Set();
    if (!parsed.has(text)) {
      const p = parseFrontmatter(text);
      parsed.set(text, new Set(citationsIn(c, p.data, type).map((x) => x.ident)));
    }
    return parsed.get(text);
  };
  for (let i = 0; i < entries.length && out.size < idents.size; i++) {
    const next = entries.slice(i + 1).find((e) => Array.isArray(e.snapshotted) && e.snapshotted.includes("bundle.md"));
    const held = identsIn(next ? img[BUNDLE_MD_HISTORY(next.key)] : img["bundle.md"]);
    for (const id of idents)
      if (!out.has(id) && held.has(id)) out.set(id, { by: entries[i].author ?? null, at: entries[i].created ?? null });
  }
  const last = entries.at(-1);
  for (const id of idents) if (!out.has(id)) out.set(id, { by: last ? last.author ?? null : null, at: last ? last.created ?? null : null });
  return out;
}

/* Every project's id, type and current `bundleSha`: one statement over record-core's `bundles` read contract (its R37:
   `bundle_id`, `object_type`, `bundle_sha`) where the store is reachable, else `listByType` and `head` (R36, R41), which
   cost one statement per project; MEASURED 2.5 s of a 200-capture call over 500 projects (K2132). */
function projectHeads(c) {
  if (c.sql) return [...c.sql.exec(`SELECT bundle_id, object_type, bundle_sha FROM bundles WHERE object_type = 'project' ORDER BY bundle_id`)]
    .map((r) => ({ id: r.bundle_id, type: r.object_type, bundleSha: r.bundle_sha }));
  const out = [];
  for (let after = ""; ;) {
    const page = c.record.listByType({ type: "project", after, limit: LIST_PAGE });
    for (const id of page.ids) { const h = c.record.head(id); if (h) out.push({ ...h, id }); }
    if (page.ids.length < LIST_PAGE || !page.cursor) break;
    after = page.cursor;
  }
  return out;
}

/** R13. `c` is the Citation (its `record`, `membership`, `content`, `provenance`, `inquiry` and, when given, `sql`);
 *  `memo` its per-version cache. */
export function recordedBy(c, memo, args) {
  try {
    const a = isObj(args) ? args : {};
    if (a.viewer === undefined || a.viewer === null || (typeof a.viewer === "string" && a.viewer.trim() === ""))
      return refused("VIEWER_MISSING", localize("citation.recorded.a_read_names_the_member", "a read names the member reading; with none, nothing is answered"));
    if (!said(a.captureSha)) return refused("NO_SHA", localize("citation.recorded.who_cited_a_passage", "who cited a passage is read for one captured document, named by its capture sha256"));
    let asked = null;
    if (a.extent !== undefined && a.extent !== null) {
      if (!known(a.extent))
        return refused("EXTENT_MALFORMED", localize("citation.recorded.an_extent_is_an_object", "an extent is an object of one of the kinds {kinds}", { kinds: Object.keys(CONTENT_EXTENT_KINDS).join(", ") }));
      asked = JSON.parse(canonicalExtent(a.extent));
    }
    const sha = a.captureSha.trim().toLowerCase();
    const cap = clamp(a.limit);
    const answer = (items, truncated) => ({ ok: true, module: "citation", capture_sha: sha, items, truncated });
    /* A capture not held, or held in a document the viewer may not see, answers as an absent one (events R49). */
    if (!HEX64.test(sha)) return answer([], false);
    const home = c.provenance && typeof c.provenance.homeOf === "function" ? c.provenance.homeOf(sha) : null;
    const doc = home && said(home.bundleId) ? home.bundleId : null;
    if (!doc || !c.membership.inSight(doc, a.viewer)) return answer([], false);
    if (!c.inquiry || typeof c.inquiry.restingOn !== "function")
      return { ok: false, reason: "INQUIRY_UNAVAILABLE", detail: localize("citation.recorded.the_legs_that_cite_a", "the legs that cite a passage are found through the inquiry module's leg projection, and your team's Civicsmith was created without it, so this read could not be made.") };

    /* The citing objects: a capture's legs through `inquiry`'s leg projection (its R12, which projects every leg this
       module writes; K2132), the inquiries holding a leg on the document; a project's `cites` edges, whose pin no
       projection holds, by listing the projects. Each one's citations are then read from its current bytes. */
    const inquiries = [...new Set(((c.inquiry.restingOn(doc) || {}).dependents || []).map((d) => d.bundle_id))].sort();
    const projects = projectHeads(c);
    const addressed = c.content.captureFor(doc);
    const unpinned = said(addressed) ? addressed.toLowerCase() : null;
    const kept = [], once = new Set();
    const heads = [...inquiries.map((id) => { const h = c.record.head(id); return h ? { ...h, id } : null; }).filter(Boolean), ...projects];
    for (const h of heads) {
      const id = h.id;
      const type = normalizeType(h.type);
      let v = memo.get(id);
      if (!v || v.bundleSha !== h.bundleSha) {
        const f = c.record.readFile(id, "bundle.md");
        const data = f && typeof f.text === "string" ? parseFrontmatter(f.text).data : null;
        v = { bundleSha: h.bundleSha, cites: citationsIn(c, data, type), writers: null };
        memo.set(id, v);
      }
      const hits = v.cites.filter((x) => x.target === doc && (x.pin ?? unpinned) === sha);
      /* Sight is the citing object's (R9; the inquiry's for a question): one the viewer may not see is neither
         answered nor counted. */
      if (!hits.length || !c.membership.inSight(id, a.viewer)) continue;
      if (!v.writers) v.writers = firstWriters(c, id, type, new Set(v.cites.map((x) => x.ident)));
      for (const x of hits) {
        const relation = asked ? extentRelation(asked, x.extent) : null;
        if (asked && !RELATIONS.includes(relation)) continue;
        const w = v.writers.get(x.ident) || { by: null, at: null };
        const item = { module: "citation", record: id, kind: x.kind, field: x.field, extent: x.extent, relation,
                       by: w.by, at: w.at, withdrawn: x.withdrawn };
        const dup = JSON.stringify(item);
        if (once.has(dup)) continue;
        once.add(dup);
        kept.push({ key: x.key, item });
      }
    }
    kept.sort((p, q) => cmp(p.key, q.key) || cmp(p.item.record, q.item.record) || cmp(p.item.field, q.item.field));
    return answer(kept.slice(0, cap).map((x) => x.item), kept.length > cap);
  } catch (e) {
    return { ok: false, reason: "RECORDED_BY_UNREADABLE", detail: String((e && e.message) || e).slice(0, 200) };
  }
}
