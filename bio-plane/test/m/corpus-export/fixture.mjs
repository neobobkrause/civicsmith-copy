/* corpus-export over an earlier module's world: connections' fixture (record-core, membership, promotion, provenance and
   connections, each the real one, on node:sqlite shaped as workerd's storage), never publication's, which is later in
   the order (seam map `build/extraction/corpus-export.md` §7.6). This module is created on that host as `publication`
   will create it, with the world's clock. Every test drives `corpus-export` at its interface. */
import { world as connectionsWorld } from "../connections/fixture.mjs";
import { corpusExportOf } from "../../../src/corpus-export/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

export const NOW = "2026-09-28T01:00:00Z";
export { sha } from "../connections/fixture.mjs";

export function world() {
  const w = connectionsWorld({ now: NOW });
  const ce = corpusExportOf(w.host, { record: w.record, now: () => w.clock.now });
  let n = 0;
  return Object.assign(w, {
    ce,
    /** An inquiry holding only its `bundle.md`, citing `cites` (promoted again when it is held: a base link). */
    inquiry(id, { question = `Is ${id} answered?`, cites = [] } = {}) {
      const head = w.record.head(id);
      const r = w.promotion.promote({ bundleId: id, base: head ? head.bundleSha : null, snapKey: `q${++n}`,
        author: "member:alice", files: [{ path: "bundle.md", text: inquiryMd(id, question, cites) }],
        meta: { object_type: "inquiry" } });
      if (!r.ok) throw new Error(`fixture inquiry refused: ${JSON.stringify(r).slice(0, 400)}`);
      return r;
    },
    /** Every byte sequence an export names, keyed by its SHA-256, as the exporting store holds them: live files,
        snapshots and registered captures (inline text; this world binds no evidence store). */
    bytesFor(manifest) {
      const out = new Map();
      const put = (s, text) => { if (typeof text === "string") out.set(s, new TextEncoder().encode(text)); };
      for (const b of manifest.bundles) {
        for (const f of b.files) put(f.sha256, w.record.readFile(b.bundle_id, f.path)?.text);
        for (const s of b.snapshots)
          put(s.sha256, w.row(`SELECT content FROM history WHERE bundle_id=? AND snap_key=? AND path=?`,
                              b.bundle_id, s.snap_key, s.path)?.content);
      }
      for (const r of manifest.register) put(r.capture_sha, w.record.readFile(r.bundle_id, r.path)?.text);
      /* R8: every carried table's pages, each fetched alone from its index and after */
      for (const t of manifest.tables || [])
        for (const p of t.pages) {
          const got = ce.exportPage({ table: t.table, index: p.index, after: p.after });
          if (got.ok) out.set(got.sha256, got.bytes);
        }
      return out;
    },
  });
}

export function inquiryMd(id, question, cites = []) {
  return ["---", `id: ${id}`, "object_type: inquiry", "schema: inquiry@1", `title: "${question}"`,
    "current_state: open", "prior_state: null", `created: "2026-09-27T00:00:00Z"`,
    `last_updated: "2026-09-27T00:00:00Z"`, "group: test-group",
    ...(cites.length ? ["references:", ...cites.flatMap((t) => [`  - target: ${t}`, "    rel: cites", "    status: confirmed"])]
                     : ["references: []"]),
    "state_history: []", "surfaced_by: human", 'disposition_reason: ""',
    "---", "", "## Question", "", question, "", word("conformance.rests"), "", "## Conclusion", "",
    word("conformance.falsify"), "", "## Session Log", "", "## Review Notes", ""].join("\n");
}
