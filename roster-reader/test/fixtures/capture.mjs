/* How `roster-documents.json` was made (R9): each document fetched from its public URL, its bytes put into
 * the REAL plane (`bio-plane/src/plane/index.mjs`) with the COMMITTED pdf-worker bundle bound as
 * `PDF_WORKER`, both under one miniflare, and read back with `op=pdfstructure` — the plane's own tier 1, and
 * tier 2 through the member where tier 1 got essentially nothing (the recipe of
 * `bio-plane/test/system/pdf-worker-binding.test.mjs`). The `text` kept is the plane's I2 answer whole
 * (`document`, `pages`); nothing here classifies a document. No OCR member is bound: a page the plane
 * cannot read from text is kept as the plane answered it (empty), never transcribed here.
 *
 * usage (from bio-plane/, where miniflare is installed):
 *   node ../roster-reader/test/fixtures/capture.mjs <manifest.json> <pdf-dir> <out.json>
 *   manifest: [{ key, source, fetched, what }]; `<pdf-dir>/<key>` holds the bytes fetched from `source`. */
import { createRequire } from "node:module";
const { Miniflare } = createRequire(new URL("../../../bio-plane/package.json", import.meta.url))("miniflare");
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
/* the pdf-worker member built fresh from its source by its own fleet recipe (pdf-worker/test/subject.mjs); no committed bundle is read (ARCH, "Committed built files") */
import { BUNDLE } from "../../../pdf-worker/test/subject.mjs";
import { createHash } from "node:crypto";

const [manPath, pdfDir, outPath] = process.argv.slice(2);
const man = JSON.parse(readFileSync(manPath, "utf8"));
const PLANE = fileURLToPath(new URL("../../../bio-plane/src/plane/index.mjs", import.meta.url));
const MEM = "mem-roster-capture";
const mf = new Miniflare({ workers: [{
  name: "plane", modules: true, modulesRoot: "/", scriptPath: PLANE, script: readFileSync(PLANE, "utf8"),
  compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
  durableObjects: { STORE: { className: "Store", useSQLite: true } }, r2Buckets: ["CAPTURES", "PUBLISHED"],
  bindings: { VERSION: "roster-capture", ADMIN_TOKEN: "adm-roster-capture", MEMBER_TOKEN: MEM, PROBE_TOKEN: "prb-roster-capture" },
  serviceBindings: { PDF_WORKER: "pdf-worker" },
}, {
  name: "pdf-worker", modules: true, modulesRoot: "/", scriptPath: BUNDLE, script: readFileSync(BUNDLE, "utf8"),
  compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"], r2Buckets: ["CAPTURES"], bindings: { VERSION: "roster-capture" },
}] });
const documents = {};
try {
  for (const m of man) {
    const bytes = readFileSync(`${pdfDir}/${m.key}`);
    const sha = createHash("sha256").update(bytes).digest("hex");
    const put = await (await mf.dispatchFetch(`http://x/api/capture?token=${MEM}&sha256=${sha}`, { method: "PUT", body: bytes })).json();
    if (!put.ok) throw new Error(`capture refused ${m.key}: ${JSON.stringify(put).slice(0, 200)}`);
    const st = await (await mf.dispatchFetch(`http://x/api/pdfstructure?token=${MEM}&sha256=${sha}`)).json();
    const text = st.text || {};
    documents[m.id] = { source: m.source, sha256: sha, bytes: bytes.length, fetched: m.fetched, what: m.what,
      tier: st.tier ?? null, pages: Array.isArray(text.pages) ? text.pages.length : null,
      chars: String(text.document || "").length,
      text: { document: String(text.document || ""), pages: (text.pages || []).map((p) => ({ page: p.page, text: p.text, source: p.source })) } };
    console.log(m.id, st.tier, documents[m.id].chars);
  }
} finally { await mf.dispose(); }
writeFileSync(outPath, JSON.stringify({ note: "", documents }, null, 1) + "\n");
