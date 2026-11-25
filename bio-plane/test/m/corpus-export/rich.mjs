/* corpus-export over the T33 owners (R7–R10): people's test world (`../people/fixture.mjs`: record-core, membership,
   promotion, provenance, content, entities, events, lines, money, duties, standards and people, each the real module on
   one host), with this module created on that host and handed those owners. Every test drives corpus-export at its
   interface. */
import { world as peopleWorld, ANN, OUT, BOSS, doc } from "../people/fixture.mjs";
import { corpusExportOf } from "../../../src/corpus-export/index.mjs";

export { ANN, OUT, BOSS, doc };
export const NOW = "2026-10-06T00:00:00Z";

export function rich() {
  const w = peopleWorld();
  const ce = corpusExportOf(w.host, { record: w.record, entities: w.entities, events: w.ev, lines: w.lines, money: w.money,
                                      now: () => NOW });
  return Object.assign(w, {
    ce,
    /** Every page a manifest names, fetched alone from its index and after, keyed by its digest. */
    pagesFor(manifest) {
      const out = new Map();
      for (const t of manifest.tables)
        for (const p of t.pages) { const g = ce.exportPage({ table: t.table, index: p.index, after: p.after }); if (g.ok) out.set(g.sha256, g.bytes); }
      return out;
    },
    /** Every byte sequence an export names, keyed by its digest: live files, snapshots, registered captures and pages. */
    bytesFor(manifest) {
      const out = w.pagesFor(manifest);
      const put = (s, text) => { if (typeof text === "string") out.set(s, new TextEncoder().encode(text)); };
      for (const b of manifest.bundles) {
        for (const f of b.files) put(f.sha256, w.record.readFile(b.bundle_id, f.path)?.text);
        for (const s of b.snapshots)
          put(s.sha256, w.one(`SELECT content FROM history WHERE bundle_id=? AND snap_key=? AND path=?`, b.bundle_id, s.snap_key, s.path)?.content);
      }
      for (const r of manifest.register) put(r.capture_sha, w.record.readFile(r.bundle_id, r.path)?.text);
      return out;
    },
    /** A money fact read from a capture (fenced in the project when `fenced`). */
    factOn(capture, { kind = "payment", from, to, amount = "250.00", concerns } = {}) {
      const r = w.money.recordFact({ amount, as_read: `$${amount}`, currency: "USD", sign: "+", precision: "exact", kind, phase: "actual",
        stage: "paid", basis: "cash", period: { from: "2026-01-01", to: "2026-12-31", precision: "day", zone: "UTC" }, from, to,
        ...(concerns ? { concerns } : {}),
        source: { capture_sha: capture.captureSha, extent: { kind: "pdf-page", page: 0 } }, by: ANN });
      if (!r.ok) throw new Error(`fixture fact refused: ${JSON.stringify(r).slice(0, 300)}`);
      return r.fact_id;
    },
    /** An event attested by a capture extent (fenced when the capture is). */
    eventOn(capture, kind, participants = []) {
      const r = w.ev.createEvent({ kind, attestations: [{ captureSha: capture.captureSha, extent: { kind: "pdf-page", page: 0 } }],
        participants: participants.map((x) => ({ entityId: x.entity, role: x.role, attestation: 0 })), by: ANN });
      if (!r.ok) throw new Error(`fixture event refused: ${JSON.stringify(r).slice(0, 300)}`);
      return r.event_id;
    },
  });
}
