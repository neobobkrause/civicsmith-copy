/* control-plane (fix round 9, K4842; job 43; R-SEAM, R-ONE, R-CLOCK): SECTION 18 OF `t51-round9-seam.test.mjs` (plan 3b; G125a-c, G133c): A HOSTILE FILE THROUGH THE REAL RENDERER AND THE UPLOAD. The plane is the real one;
   the pdf-worker and the ocr-worker are booted from their committed bytes beside it under the one Miniflare (the committed bundles are as BOB last rebuilt them, rB D10: a case that needs a
   fix in a renderer's source is red by name until the rebuild). Each file is made by the generators or by hand to say what it says (a size its data cannot fill, a character reference no one can
   write), uploaded as a member uploads it and filed; the reading must END: refused, stated, final (never `transient`, never `partial` without a reason, never retried for ever), the answer to
   the upload a 200, and the plane alive (a plain text uploaded after is read). Counts and states, not seconds. */
import "../../sandbox.mjs";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { makeKit } from "./r8-kit.mjs";
import { makeZip } from "../../make-zip.mjs";
import { generate as imgGenerate } from "../../imggen.mjs";
import { ocrWorkerDef } from "../../../../ocr-worker/test/memberworker.mjs";
/* the pdf-worker member built fresh from its source by its own fleet recipe (pdf-worker/test/subject.mjs); no committed bundle is read (ARCH, "Committed built files") */
import { BUNDLE as PDF_BUNDLE } from "../../../../pdf-worker/test/subject.mjs";
import { put, fileIt, uniq, bytesOf, readEnded } from "./r9-seam-parts.mjs";

const pdfWorkerDef = () => ({ name: "pdf-worker", modules: true, modulesRoot: "/", scriptPath: PDF_BUNDLE, script: readFileSync(PDF_BUNDLE, "utf8"),
  compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"], r2Buckets: ["CAPTURES"], bindings: { VERSION: "test" } });
const te = (t) => new TextEncoder().encode(t);

/* a PDF whose one page draws an image of `data` declared `w` x `h` in the CCITT group 4 filter */
function ccittPdf(w, h, dataBytes) {
  const data = new Uint8Array(dataBytes);
  let x = 0x2545f491;
  for (let i = 0; i < data.length; i++) { x = (x * 1664525 + 1013904223) >>> 0; data[i] = x >>> 24; }
  const parts = [], offs = [];
  let len = 0;
  const add = (b) => { const u = typeof b === "string" ? te(b) : b; parts.push(u); len += u.length; };
  add("%PDF-1.4\n");
  const obj = (n, body, stream = null) => { offs[n] = len; add(`${n} 0 obj\n${body}\n`); if (stream) { add("stream\n"); add(stream); add("\nendstream\n"); } add("endobj\n"); };
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>");
  const draw = te("q 612 0 0 792 0 0 cm /Im0 Do Q");
  obj(4, `<< /Length ${draw.length} >>`, draw);
  obj(5, `<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceGray /BitsPerComponent 1 /Filter /CCITTFaxDecode /DecodeParms << /K -1 /Columns ${w} /Rows ${h} >> /Length ${data.length} >>`, data);
  const xref = len;
  add(`xref\n0 6\n0000000000 65535 f \n${offs.slice(1).map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(len);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}
/* a JPEG of `total` bytes whose frame header declares `w` x `h` (three components, 8 bits), the rest filler: it cannot hold what it declares */
function jpeg(w, h, total) {
  const u16 = (n) => [(n >> 8) & 255, n & 255];
  const dqt = [0xff, 0xdb, ...u16(67), 0, ...Array(64).fill(1)];
  const sof = [0xff, 0xc0, ...u16(17), 8, ...u16(h), ...u16(w), 3, 1, 0x11, 0, 2, 0x11, 0, 3, 0x11, 0];
  const sos = [0xff, 0xda, ...u16(12), 3, 1, 0, 2, 0, 3, 0, 0, 63, 0];
  const head = [0xff, 0xd8, ...dqt, ...sof, ...sos];
  const body = new Uint8Array(Math.max(0, total - head.length - 2));
  for (let i = 0; i < body.length; i++) body[i] = (i * 31 + 7) & 0x7f;
  return Uint8Array.from([...head, ...body, 0xff, 0xd9]);
}
/* a DOCX with one paragraph whose `docProps/core.xml` holds `ref` (a character reference no one can write) */
function docxWith(ref) {
  const ns = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  return makeZip([
    { name: "[Content_Types].xml", data: te('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>') },
    { name: "_rels/.rels", data: te('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>') },
    { name: "word/document.xml", data: te(`<?xml version="1.0"?><w:document ${ns}><w:body><w:p><w:r><w:t>The clerk filed the register on Tuesday ${uniq()}.</w:t></w:r></w:p></w:body></w:document>`) },
    { name: "docProps/core.xml", data: te(`<?xml version="1.0"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>minutes ${ref}</dc:title></cp:coreProperties>`) },
  ]);
}
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function sections(kit, counting) {
  void kit; void counting;
  const k = makeKit({ tag: "r9hostile", workers: [pdfWorkerDef(), ocrWorkerDef()], serviceBindings: { PDF_WORKER: "pdf-worker", OCR_WORKER: "ocr-worker" } });
  after(() => k.mf.dispose());
  const owner = () => k.ownerOf("r9h-ann").then((o) => o.auth);
  /* uploaded as a member uploads, filed, and read to its end: what the upload answered, and the reading and its job when it ended */
  async function through(bytes, { name, type }) {
    const auth = await owner();
    const { status, up } = await put(k, auth, bytes, { name, type });
    assert.equal(status, 200, "the upload answers 200: " + JSON.stringify(up).slice(0, 300));
    assert.equal(up.ok, true, JSON.stringify(up).slice(0, 300));
    await fileIt(k, auth, up, { title: name });
    const sha = up.capture.sha256;
    const reading = await readEnded(k, auth, sha, 200000);
    const rows = (((await k.get(await k.founder(), { op: "owedwork", sha })).result) || {});
    return { auth, sha, reading, rows };
  }
  const alive = async () => {
    const t = uniq();
    const r = await through(Buffer.from(`The clerk filed the register after the hostile file ${t}.\n`), { name: `after-${t}.txt`, type: "text/plain" });
    return r.reading && r.reading.completeness && r.reading.completeness.state === "whole";
  };
  const refusedFinal = (r) => {
    const c = r.reading.completeness || {};
    const why = c.reason || c.basis || (c.failure_why) || null;
    return { final: c.failure === "final" || c.state === "stated", failure: c.failure, state: c.state, why, shown: JSON.stringify({ completeness: c.state, failure: c.failure, why, job: r.reading.job }).slice(0, 500) };
  };
  const noRetryLeft = (r) => !(r.rows.owed || []).some((e) => (e.kind === "reading" || e.kind === "ocr") && e.attempts > 1);

  test("R9 seam §18 (G125a, SCAN D1-D4, PDF D10; R100 R130): an 8 KB CCITT stream declaring 60,000 x 60,000 in a PDF is refused stated and final through the real renderer (a 200, the reading ended, not retried), and the plane is alive after", { timeout: 900000 }, async () => {
    const r = await through(ccittPdf(60000, 60000, 8000), { name: "ccitt-bomb.pdf", type: "application/pdf" });
    const v = refusedFinal(r);
    assert.ok(v.final, "the reading ended refused or stated, final: " + v.shown);
    assert.ok(v.failure !== "transient", "never transient: " + v.shown);
    assert.ok(noRetryLeft(r), "and not retried: " + JSON.stringify(r.rows).slice(0, 400));
    assert.ok(await alive(), "the plane answers and reads a plain text after it");
  });

  test("R9 seam §18 (G125a, SCAN D1-D4; R100 R130): a 330-byte JPEG declaring 60,000 x 60,000 and a PNG declaring 30,000,000 x 1 are each refused stated and final by their headers, not decoded and not retried", { timeout: 900000 }, async () => {
    const png = await bytesOf(imgGenerate({ kind: "png", seed: 9831, size: { pages: 1, lines: 2 }, declare: { width: 30000000, height: 1 } }));
    const bad = [];
    for (const [label, bytes, type] of [["jpeg", Buffer.from(jpeg(60000, 60000, 330)), "image/jpeg"], ["png", png, "image/png"]]) {
      const r = await through(bytes, { name: `bomb.${label}`, type });
      const v = refusedFinal(r);
      if (!v.final) bad.push(`${label}: not final: ${v.shown}`);
      if (v.failure === "transient") bad.push(`${label}: transient: ${v.shown}`);
      if (!noRetryLeft(r)) bad.push(`${label}: retried: ${JSON.stringify(r.rows).slice(0, 300)}`);
    }
    assert.deepEqual(bad, []);
    assert.ok(await alive(), "the plane answers and reads a plain text after them");
  });

  test("R9 seam §18 (G133c, DOCS O7; R100 R130): a DOCX whose core.xml holds `&#x110000;`, `&#xD800;` or `&#99999999999;` is never a throw retried for ever: its reading ends, final with its reason or read without the property, and the plane is alive", { timeout: 900000 }, async () => {
    const bad = [];
    for (const ref of ["&#x110000;", "&#xD800;", "&#99999999999;"]) {
      const r = await through(Buffer.from(docxWith(ref)), { name: "ref.docx", type: DOCX });
      const c = r.reading.completeness || {};
      const ended = c.state === "whole" || c.failure === "final";
      if (!ended) bad.push(`${ref}: did not end: ${JSON.stringify(c).slice(0, 300)}`);
      if (c.failure === "transient") bad.push(`${ref}: transient: ${JSON.stringify(c).slice(0, 300)}`);
      if (!noRetryLeft(r)) bad.push(`${ref}: retried: ${JSON.stringify(r.rows).slice(0, 300)}`);
    }
    assert.deepEqual(bad, []);
    assert.ok(await alive(), "the plane answers and reads a plain text after them");
  });
}
