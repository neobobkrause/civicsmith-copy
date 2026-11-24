/* Captures the 50 public policies doctypes R35 measures on (fixtures/policies.json), read the way the plane reads a
 * captured PDF. Run by hand, never by a test (K1918 (3)):
 *   npm i --no-save unpdf@1.8.0 miniflare   (pdf-worker's pinned unpdf; the OCR member's miniflare)
 *   node doctypes/test/capture-policies.mjs doctypes/test/fixtures/policies-pick.json
 *   node doctypes/test/capture-policies.mjs doctypes/test/fixtures/policies-fresh-pick.json policies-fresh.json
 * The second argument names the fixture written (default `policies.json`): the out-of-sample set (R35, T36-4) is
 * `policies-fresh.json`, at least 20 more of the same issuers and series, none among the 50.
 * `pick.json` is `[{id, family, name, url}]`: the 50 chosen from the police department's public PowerDMS index
 * (`public.powerdms.com/OAKLAND/documents`, every Special Order and City Administrative Instruction it lists, the four
 * use-of-force and complaint orders `world.md` names, and the other General Orders taken at an even step through the
 * alphabetical list), plus the City's own copies of AI 594 and AI 123.
 *
 * THE READING. pdf-reader's Tier 1 (`extractPdfStructure`); where Tier 1 read essentially nothing (reading-pipeline
 * R3: more undetermined regions than glyphs, unless every marker is a scan marker), pdf-worker's Tier 2 (`unpdf`'s
 * pdf.js text, shaped as its `tier2Text`), merged page by page by text-chain's `mergeTier2Text`; where neither read a
 * text layer (an image-only scan), the ocr-worker member's Tier 3: its committed bundle, engine and model, booted
 * under miniflare as its own suite boots it, each page's line regions joined as the reading pipeline joins them. */
import fs from "node:fs";
import { createHash } from "node:crypto";
import { extractPdfStructure } from "../../bio-plane/src/pdfstructure.mjs";
import { mergeTier2Text, glyphCount } from "../../bio-plane/src/textchain.mjs";

const { getDocumentProxy, extractText } = await import("unpdf");
if (typeof Math.sumPrecise !== "function") Math.sumPrecise = (xs) => { let s = 0; for (const x of xs) s += x; return s; };
const root = new URL("../../", import.meta.url);
const SCAN = ["no_text_layer", "image_content_unread", "image_content_undetermined"];

function needsTier2(text) {
  const c = text && text.counts;
  if (!c || typeof c.chars !== "number" || typeof c.undetermined !== "number") return false;
  const glyphs = typeof text.document === "string" ? glyphCount(text.document) : c.chars;
  if (!(c.undetermined > glyphs)) return false;
  const marks = Array.isArray(text.undetermined) ? text.undetermined : [];
  return !(marks.length && marks.every((m) => m && SCAN.includes(m.reason)));
}
async function tier2Text(bytes) {
  const { text } = await extractText(await getDocumentProxy(bytes), { mergePages: false });
  const pages = [], undetermined = [];
  (Array.isArray(text) ? text : [text]).forEach((t, i) => {
    const u = (t || "").trim().length ? [] : [{ page: i, reason: "no_text_layer", font: null, codes: "", count: 0 }];
    undetermined.push(...u);
    pages.push({ page: i, text: t || "", undetermined: u });
  });
  const document = pages.map((p) => p.text).filter((t) => t.length).join("\n");
  return { document, pages, undetermined, counts: { chars: document.length, undetermined: undetermined.length } };
}

/* The OCR member, from its committed upload parts (the recipe of ocr-worker/test/memberworker.mjs). */
let ocr = null;
async function tier3Text(bytes) {
  if (!ocr) {
    const { Miniflare } = await import("miniflare");
    const part = (p) => new URL(`ocr-worker/${p}`, root).pathname;
    const mf = new Miniflare({ workers: [{
      name: "ocr-worker", modulesRoot: part(""), compatibilityDate: "2026-07-01", r2Buckets: ["CAPTURES"],
      bindings: { VERSION: "doctypes-r35-capture" },
      modules: [
        { type: "ESModule", path: part("dist/ocr-worker.bundled.mjs"), contents: fs.readFileSync(part("dist/ocr-worker.bundled.mjs"), "utf8") },
        { type: "CompiledWasm", path: part("assets/tesseract-core.wasm"), contents: fs.readFileSync(part("assets/tesseract-core.wasm")) },
        { type: "Data", path: part("assets/eng.traineddata"), contents: fs.readFileSync(part("assets/eng.traineddata")) },
      ] }] });
    ocr = { mf, bucket: await mf.getR2Bucket("CAPTURES"), worker: await mf.getWorker("ocr-worker") };
  }
  const sha = createHash("sha256").update(bytes).digest("hex");
  await ocr.bucket.put(`scratch/captures/${sha}`, bytes);
  const pages = [];
  for (let p = 0; ; p++) {
    const r = await ocr.worker.fetch("http://ocr-worker/transcribe", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ capture_sha: sha, store: "scratch", pages: [p] }) });
    const b = await r.json();
    if (!b.ok) break;
    const regions = ((b.pages || [])[0] || b).regions || [];
    pages.push({ page: p, text: regions.map((x) => x.text).filter((t) => typeof t === "string").join("\n") });
  }
  return { document: pages.map((p) => p.text).filter((t) => t.length).join("\n"), pages };
}

const pick = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const target = process.argv[3] || "policies.json";
const out = {
  note: (target === "policies.json" ? "doctypes R35's 50 public policies" : `doctypes R35's ${pick.length} out-of-sample public policies, none among the 50 of policies.json,`)
      + " of the City of Oakland and its Police Department (Administrative Instructions, "
      + "Departmental General Orders, Special Orders; posted under Penal Code §13650), each fetched from its public address and "
      + "read as the plane reads a captured PDF: pdf-reader Tier 1, and where Tier 1 read essentially nothing, pdf-worker Tier 2 "
      + "(unpdf 1.8.0) merged page by page by text-chain's mergeTier2Text; where neither tier read a text layer (an image-only "
      + "scan), the ocr-worker member's Tier 3 (tesseract-wasm 0.11.0), each page's line regions joined as the reading pipeline "
      + "joins them. `text` is the reading a type is given (I2's {document, pages}); `sha256` and `bytes` are of the PDF as "
      + "served. Unedited.",
  documents: [],
};
for (const p of pick) {
  const res = await fetch(p.url);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const t1 = await extractPdfStructure(bytes);
  let text = t1.text, tier = 1, why = null;
  if (needsTier2(text)) {
    const m = mergeTier2Text(text, await tier2Text(bytes.slice()));
    if (m.ok) { text = { ...m.text, producer: text.producer }; tier = 2; } else why = m.why || "tier 2 refused";
  }
  if (!String(text.document || "").trim()) {
    text = await tier3Text(bytes);
    tier = 3;
    why = "tiers 1 and 2 read no text layer (an image-only scan): each page transcribed by the ocr-worker member "
        + "(tesseract-wasm 0.11.0, tessdata_fast/eng, the committed bundle under miniflare), its line regions joined, no confidence floor";
  }
  out.documents.push({
    id: p.id, family: p.family, name: p.name, source: p.url, fetched: new Date().toISOString(), status: res.status,
    revision: res.headers.get("powerdms-public-document-revisionid"),
    sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, pages: t1.pages, tier, tier_why: why,
    text: { document: text.document, pages: (text.pages || []).map((g) => ({ page: g.page, text: g.text })) },
  });
  console.log(p.id, tier, String(text.document || "").length);
}
if (ocr) await ocr.mf.dispose();
fs.writeFileSync(new URL(`./fixtures/${target}`, import.meta.url), JSON.stringify(out, null, 1) + "\n");
