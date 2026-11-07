/* corpus-export over registers' test world (R16-R20): `../registers/fixture.mjs` (record-core with an evidence bucket,
   membership, promotion, content with provenance, acquisition over a scripted network, and registers, each the real
   module on one host), with this module created on that host. A register import runs through registers' own door and
   its alarm; a stored file in the bucket is put through record-core's evidence store and promoted through promotion.
   Every test drives corpus-export at its interface. */
import { seeded, V, served, csv, rowOf, enc, URL_ } from "../registers/fixture.mjs";
import { inquiryMd } from "./fixture.mjs";
import { corpusExportOf } from "../../../src/corpus-export/index.mjs";
import { byteLedger } from "../../../src/byte-ledger.mjs";
import { createSha256 } from "../../../src/record-grammar/index.mjs";

export { V, csv, rowOf, enc };
export const NOW = "2026-11-05T00:00:00Z";
export const SENTINEL = "SENTINEL-EXPORT Quillon";

export function registersWorld({ view = null, partBytes = null, env = null } = {}) {
  const w = seeded(view ? { view } : {});
  const ledger = byteLedger();
  const ce = corpusExportOf(w.host, { record: w.record, provenance: w.content.provenance, now: () => NOW, ledger,
                                      ...(partBytes ? { partBytes } : {}), ...(env ? { env } : {}) });
  let n = 0;
  return Object.assign(w, {
    ce, ledger,
    /** an import of `town_filings` with the sentinel at row 5, run to its end */
    async importOnce(over = {}) {
      const r = w.registers.importStart({ register: "town_filings", filter: {}, scope: "team", author: V("alice"), viewer: V("alice"), holes: { table: "2025" }, ...over });
      if (!r.ok) throw new Error(`fixture import refused: ${JSON.stringify(r).slice(0, 300)}`);
      await w.drain({ [URL_]: served(enc(csv(12, { cell: (i) => rowOf(i, i === 5 ? { donor_name: SENTINEL } : {}) }))) });
      return r.import;
    },
    /** the first import's row at source row `src`, removed by an administrator */
    async removeRow(src = 3) {
      const key = w.sql(`SELECT row_key FROM register_import_rows WHERE src_row=? ORDER BY import_id LIMIT 1`, src)[0].row_key;
      const r = await w.registers.rowExpunge({ register: "town_filings", row_key: key, ground: "unlawful", reason: "held unlawfully", author: V("alice") });
      if (!r.ok) throw new Error(`fixture removal refused: ${JSON.stringify(r).slice(0, 300)}`);
      return key;
    },
    /** an inquiry holding its bundle.md and a file of `bytes` held in the evidence bucket */
    async storedFile(id, bytes) {
      const sha = createSha256().update(bytes).hex();
      await w.record.evidenceStore().put(sha, bytes);
      const r = w.promotion.promote({ bundleId: id, base: null, snapKey: `s${++n}`, author: V("bob"),
        files: [{ path: "bundle.md", text: inquiryMd(id, `Is ${id} answered?`) }, { path: "data/scan.bin", blobSha: sha, sha256: sha, bytes: bytes.length }],
        meta: { object_type: "inquiry" }, register: [{ sha256: sha, path: "data/scan.bin", encoding: "binary", bytes: bytes.length }] });
      if (!r.ok) throw new Error(`fixture stored file refused: ${JSON.stringify(r).slice(0, 400)}`);
      return sha;
    },
    /** the export as an outside party holds it: the manifest, every page's bytes and (for a whole-record export) every part's */
    async everything(m) {
      const out = [JSON.stringify(m)];
      for (const t of m.tables) for (const p of t.pages) out.push(new TextDecoder().decode(ce.exportPage({ table: t.table, index: p.index, after: p.after }).bytes));
      for (const p of m.parts || []) out.push(new TextDecoder("utf-8", { fatal: false }).decode((await ce.exportWholePart({ file: p.file, offset: p.offset, bytes: p.bytes })).bytes));
      return out.join("\n");
    },
  });
}
