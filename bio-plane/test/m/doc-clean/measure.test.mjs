/* doc-clean R4: a 16 MiB PDF and a 16 MiB OOXML file cleaned in workerd (Miniflare, the plane's own runner), their
 * time and memory measured and the answer checked.
 *
 * The PDF: 400 pages of compressed text, a thousand small objects in object streams, and eight 1.9 MB JPEGs with
 * EXIF, XMP and a comment, up to just under CLEAN_MAX_BYTES. The .docx: a `word/document.xml` near
 * CLEAN_MAX_PART_BYTES of paragraphs, each with a tracked change (so every one is edited), and stored JPEGs of
 * about 1.9 MB, up to just under CLEAN_MAX_BYTES. A JPEG's scan data is filler without a 0xFF byte: R8 copies it as it is.
 *
 * Time is the request's wall time less the same body's echo (workerd's clock does not advance inside a request).
 * Memory is the workerd process's peak resident set during the request (Linux `VmHWM`, its peak reset through
 * `clear_refs` first) less its resident set just before: the request body, the answer and the work together, with
 * whatever garbage the isolate had not yet collected. Both are printed for the job's record; the test holds the
 * measurement to the isolate's 128 MB. */
import "../../sandbox.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { CLEAN_MAX_BYTES, CLEAN_MAX_PART_BYTES } from "../../../src/doc-clean/index.mjs";
import { jpeg, makePdf, makeZip, docx, unzipCopy } from "./fixtures.mjs";
/** @import { ZipEntry } from "../../make-zip.mjs" */
/** @import { PdfBody } from "../../../../pdf-worker/test/make-pdf.mjs" */

/** What the measuring worker below answers of a clean: the answer's members as JSON, `bytes` the copy's length and
 *  `secret` whether any marker string is left in it.
 *  @typedef {{ ok: unknown, clean: unknown, code: unknown, detail: unknown, images: { stripped: unknown } | undefined, bytes: number, secret: unknown }} Measured */

const MB = 1024 * 1024;

/** A JPEG of about `size` bytes: the fixture's segments with its metadata, and filler scan data.
 *  @param {number} size @param {number} seed @returns {Uint8Array} */
function bigJpeg(size, seed) {
  const small = jpeg();
  const head = small.subarray(0, small.length - 3);
  const out = new Uint8Array(size);
  out.set(head);
  for (let i = head.length, x = seed; i < size - 2; i++) { x = (x * 1103515245 + 12345) >>> 0; out[i] = (x >>> 16) % 255; }
  out.set([0xff, 0xd9], size - 2);
  return out;
}

/** @returns {Uint8Array} */
function bigPdf() {
  /** @type {PdfBody[]} */
  const bodies = ["<< /Type /Catalog /Pages 2 0 R >>", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  /** @type {number[]} */
  const kids = [];
  /** @type {number[]} */
  const images = [];
  for (let i = 0; i < 8; i++) { images.push(bodies.length + 1); bodies.push({ dict: "<< /Type /XObject /Subtype /Image /Width 8 /Height 8 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /DCTDecode >>", data: bigJpeg(Math.round(1.9 * MB), i + 1) }); }
  for (let p = 0; p < 400; p++) {
    const ops = Array.from({ length: 40 }, (_, l) => `BT /F1 9 Tf 40 ${760 - l * 18} Td (Page ${p + 1}, line ${l + 1}: the budget item reads as amended.) Tj ET`).join("\n") +
      (p < 8 ? `\nq 100 0 0 100 300 300 cm /Im Do Q` : "");
    bodies.push({ dict: "<< /Filter /FlateDecode >>", data: new Uint8Array(deflateSync(ops)) });
    kids.push(bodies.length + 1);
    bodies.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >>${p < 8 ? ` /XObject << /Im ${images[p]} 0 R >>` : ""} >> /Contents ${bodies.length} 0 R /Annots [${bodies.length + 2} 0 R] >>`);
    bodies.push(`<< /Type /Annot /Subtype /Text /Rect [0 0 9 9] /T (COMMENTERSECRET) /M (D:20190304) /Contents (Note ${p}) >>`);
  }
  bodies[1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
  const first = bodies.length + 1, stm = Array.from({ length: 1000 }, (_, i) => `<< /Type /OutlineItem /Title (Item ${i}) /Data [${i} ${i + 1} ${i + 2}] >>`);
  let head = "", body = "";
  stm.forEach((b, i) => { head += `${first + 1 + i} ${body.length} `; body += b + "\n"; });
  bodies.push({ dict: `<< /Type /ObjStm /N ${stm.length} /First ${head.length} /Filter /FlateDecode >>`, data: new Uint8Array(deflateSync(Buffer.from(head + body, "latin1"))) });
  const catalog = `<< /Type /Catalog /Pages 2 0 R /Extra [${stm.map((_, i) => `${first + 1 + i} 0 R`).join(" ")}] >>`;
  bodies[0] = catalog;
  let pdf = makePdf(bodies, { trailer: "/Info 3 0 R" });
  const pad = CLEAN_MAX_BYTES - 4096 - pdf.length;
  if (pad > 0) { bodies.push({ dict: "<< /Type /XObject /Subtype /Image /Width 8 /Height 8 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /DCTDecode >>", data: bigJpeg(pad, 99) }); bodies[0] = catalog.replace(" >>", ` /Pad ${bodies.length} 0 R >>`); pdf = makePdf(bodies, { trailer: "/Info 3 0 R" }); }
  return pdf;
}

/** The object walk's worst case: as many small objects as fit under CLEAN_MAX_BYTES (about 135,000), every one
 *  reached from the catalog, every one an annotation to edit. */
/** @returns {Uint8Array} */
function manyObjects() {
  const per = `9999999 0 obj\n<< /Type /Annot /Subtype /Text /Rect [0 0 1 1] /K 999999 /T (COMMENTERSECRET) >>\nendobj\n0000000000 00000 n \n9999999 0 R `.length;
  const n = Math.floor((CLEAN_MAX_BYTES - 64 * 1024) / per);
  /** @type {PdfBody[]} */
  const bodies = ["<< /Type /Catalog /Pages 2 0 R /All 4 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 9 9] /Annots [5 0 R] >>", `[${Array.from({ length: n }, (_, i) => `${i + 5} 0 R`).join(" ")}]`];
  for (let i = 0; i < n; i++) bodies.push(`<< /Type /Annot /Subtype /Text /Rect [0 0 1 1] /K ${i} /T (COMMENTERSECRET) >>`);
  return makePdf(bodies);
}

/** @returns {Uint8Array} */
function bigDocx() {
  const para = /** @param {number} i */ (i) => `<w:p><w:r><w:t xml:space="preserve">Paragraph ${i} of the minutes, as read into the record. </w:t></w:r><w:ins w:id="${i}" w:author="CHANGERSECRET" w:date="2019-03-04T00:00:00Z"><w:r><w:t>amended</w:t></w:r></w:ins></w:p>`;
  const one = para(100000).length, n = Math.floor((CLEAN_MAX_PART_BYTES - 4096) / one);
  const body = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${Array.from({ length: n }, (_, i) => para(100000 + i)).join("")}</w:body></w:document>`;
  /** @type {ZipEntry[]} */
  const base = [];
  for (const p of unzipCopy(docx()).parts) base.push({ name: p.name, data: p.name === "word/document.xml" ? body : p.data });
  let z = makeZip(base);
  /** @type {ZipEntry[]} */
  const media = [];
  for (let i = 0; z.length + 1.95 * MB < CLEAN_MAX_BYTES; i++) { media.push({ name: `word/media/big${i}.jpeg`, data: bigJpeg(Math.round(1.9 * MB), i + 7), method: 0 }); z = makeZip([...base, ...media]); }
  media.push({ name: "word/media/last.jpeg", data: bigJpeg(CLEAN_MAX_BYTES - z.length - 4096, 3), method: 0 });
  return makeZip([...base, ...media]);
}

function workerdPid() {
  for (const d of readdirSync("/proc")) {
    if (!/^\d+$/.test(d)) continue;
    try {
      const stat = readFileSync(`/proc/${d}/stat`, "utf8");
      const ppid = Number(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[1]);
      if (ppid === process.pid && readFileSync(`/proc/${d}/cmdline`, "utf8").includes("workerd")) return Number(d);
    } catch {}
  }
  throw new Error("no workerd child process");
}
/** @param {number} pid @param {string} key @returns {number} */
const status = (pid, key) => {
  const m = readFileSync(`/proc/${pid}/status`, "utf8").match(new RegExp(`${key}:\\s+(\\d+) kB`));
  if (!m) throw new Error(`no ${key} for ${pid}`);
  return Number(m[1] ?? "") * 1024;
};

/** The worker's answer, read back from its JSON.
 *  @param {unknown} v @returns {Measured} */
function measured(v) {
  if (typeof v !== "object" || v === null) throw new Error("the worker answered no object");
  const images = "images" in v ? v.images : undefined, bytes = "bytes" in v ? v.bytes : undefined;
  return {
    ok: "ok" in v ? v.ok : undefined, clean: "clean" in v ? v.clean : undefined, code: "code" in v ? v.code : undefined,
    detail: "detail" in v ? v.detail : undefined, secret: "secret" in v ? v.secret : undefined,
    images: typeof images === "object" && images !== null ? { stripped: "stripped" in images ? images.stripped : undefined } : undefined,
    bytes: typeof bytes === "number" ? bytes : NaN,
  };
}

test("R4 a 16 MiB PDF (and one of small objects) and a 16 MiB OOXML file cleaned in workerd: time and peak memory measured, each answer a whole copy, the memory inside the isolate's 128 MB", { timeout: 900_000 }, async () => {
  const entry = fileURLToPath(new URL("../../../src/doc-clean/index.mjs", import.meta.url));
  const { outputFiles } = await build({
    stdin: {
      contents: `import { cleanDocument } from ${JSON.stringify(entry)};
export default { async fetch(req) {
  const b = new Uint8Array(await req.arrayBuffer());
  if (req.headers.get("x-echo")) return Response.json({ length: b.length });
  const r = await cleanDocument(b);
  const found = (w) => { const k = new TextEncoder().encode(w); for (let i = r.bytes.indexOf(k[0]); i >= 0; i = r.bytes.indexOf(k[0], i + 1)) { let j = 1; while (j < k.length && r.bytes[i + j] === k[j]) j++; if (j === k.length) return true; } return false; };
  return Response.json({ ok: r.ok, clean: r.clean, code: r.code, detail: r.detail, format: r.format, images: r.images, bytes: r.bytes?.length,
    secret: Boolean(r.bytes) && ["COMMENTERSECRET", "CHANGERSECRET", "GPSSECRET", "XMPSECRET", "COMSECRET"].some(found) });
} };`,
      resolveDir: fileURLToPath(new URL(".", import.meta.url)), loader: "js",
    },
    bundle: true, format: "esm", write: false, platform: "neutral",
  });
  const bundled = outputFiles[0];
  if (!bundled) throw new Error("esbuild wrote no bundle");
  const mf = new Miniflare({ modules: true, script: bundled.text, compatibilityDate: "2025-01-01" });
  /** @type {{ label: string, document_mb: number, copy_mb: number, ms: number, peak_growth_mb: number }[]} */
  const rows = [];
  try {
    await mf.ready;
    const pid = workerdPid();
    /** @param {Uint8Array} body @param {Record<string, string>} headers */
    const call = (body, headers) => mf.dispatchFetch("http://clean/", { method: "POST", body, headers });
    /** @type {[string, () => Uint8Array, number | null][]} */
    const documents = [["16 MiB PDF", bigPdf, 9], ["16 MiB PDF of small objects", manyObjects, 0], ["16 MiB .docx", bigDocx, null]];
    for (const [label, make, images] of documents) {
      const doc = make();
      assert.ok(doc.length <= CLEAN_MAX_BYTES && doc.length > CLEAN_MAX_BYTES - 2 * 1024 * 1024, `${label}: ${doc.length}`);
      await (await call(doc, { "x-echo": "1" })).json();
      const t0 = performance.now();
      await (await call(doc, { "x-echo": "1" })).json();
      const echoMs = performance.now() - t0;
      const before = status(pid, "VmRSS");
      writeFileSync(`/proc/${pid}/clear_refs`, "5");
      const t1 = performance.now();
      const r = measured(await (await call(doc, {})).json());
      const ms = performance.now() - t1 - echoMs;
      const peak = status(pid, "VmHWM");
      assert.equal(r.ok, true, `${label}: ${r.code} ${r.detail}`);
      assert.equal(r.clean, false);
      assert.equal(r.secret, false, `${label}: no metadata left`);
      if (images !== null) assert.equal(r.images?.stripped, images);
      rows.push({ label, document_mb: +(doc.length / MB).toFixed(1), copy_mb: +(r.bytes / MB).toFixed(1), ms: Math.round(ms), peak_growth_mb: +((peak - before) / MB).toFixed(1) });
      assert.ok(peak - before < 128 * MB, `${label}: ${((peak - before) / MB).toFixed(1)} MB`);
    }
  } finally {
    await mf.dispose();
  }
  console.log(`doc-clean R4 (workerd): ${JSON.stringify(rows)}`);
});

