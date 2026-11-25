/* R3 and R16 over a real service binding: tier 2 is the `pdf-worker` member reached through the `PDF_WORKER` binding
   (R16: only through its binding, with the capture's digest and store), and a PDF whose tier-1 undetermined markers
   outnumber its glyphs is sent there and merged; a PDF tier 1 decodes is not; with no member bound tier 1 stands and
   the reason is carried (R3). Both Workers run on workerd under one Miniflare: reading-pipeline's `read` in a test-only
   Worker (`pdf-binding-worker.mjs`) loading only this module and earlier ones, and the pdf-worker from a fresh build of
   its source (`pdf-worker/test/subject.mjs`), each reading the same R2 bucket. Moved here from the plane's
   `test/system/pdf-worker-binding.test.mjs`, which reached the same escalation through `op=pdfstructure`.
   Negative control: `needsTier2` answering false, or the `env.PDF_WORKER.fetch` call removed, fails the first test
   (the CID document reads tier 1 with no text). */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { Miniflare } from "miniflare";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BUNDLE } from "../../../../pdf-worker/test/subject.mjs";
import { sha, doc } from "./fixture.mjs";

const READER = fileURLToPath(new URL("./pdf-binding-worker.mjs", import.meta.url));
const workerd = { modules: true, modulesRoot: "/", compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
                  r2Buckets: ["CAPTURES"], bindings: { VERSION: "test" } };
const reader = (bound) => ({ ...workerd, name: "reader", scriptPath: READER, script: readFileSync(READER, "utf8"),
                             ...(bound ? { serviceBindings: { PDF_WORKER: "pdf-worker" } } : {}) });
const pdfWorker = { ...workerd, name: "pdf-worker", scriptPath: BUNDLE, script: readFileSync(BUNDLE, "utf8") };

function buildPdf(bodies) {
  let pdf = "%PDF-1.7\n%\xe2\xe3\xcf\xd3\n";
  const offsets = [];
  bodies.forEach((body, i) => { offsets[i] = pdf.length; pdf += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xrefStart = pdf.length, n = bodies.length + 1;
  let xref = `xref\n0 ${n}\n0000000000 65535 f \n`;
  for (let i = 0; i < bodies.length; i++) xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  return new Uint8Array(Buffer.from(pdf + xref + `trailer\n<< /Size ${n} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`, "latin1"));
}
const page = (font) => [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
  font.stream, font.font, ...(font.more || [])];
const stream = (s) => `<< /Length ${s.length} >>\nstream\n${s}\nendstream`;
/* No /ToUnicode: tier 1 marks its text undetermined (`no_tounicode`); pdf.js in the member decodes it. */
const CID = buildPdf(page({ stream: stream("BT /F1 24 Tf 72 700 Td (Hello Oakland 2026) Tj ET"),
                            font: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>" }));
/* With /ToUnicode: tier 1 decodes it whole. */
const TU = buildPdf(page({ stream: stream("BT /F1 24 Tf 72 700 Td (A) Tj ET"),
                           font: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /ToUnicode 6 0 R >>",
                           more: [stream(`/CIDInit /ProcSet findresource begin 12 dict begin begincmap
/CMapName /Adobe-Identity-UCS def
/CMapType 2 def
1 begincodespacerange <00> <ff> endcodespacerange
1 beginbfchar <41> <0041> endbfchar
endcmap CMapName currentdict /CMap defineresource pop end end`)] }));

const planes = [];
async function readIn(bound, bytes) {
  const mf = new Miniflare({ workers: bound ? [reader(true), pdfWorker] : [reader(false)] });
  planes.push(mf);
  const d = sha(bytes);
  await (await mf.getR2Bucket("CAPTURES")).put(`bio/captures/${d}`, bytes);
  const res = await mf.dispatchFetch("http://reader/", { method: "POST",
    body: JSON.stringify(doc({ digest: d, bytes: bytes.length, ct: "application/pdf", format: "pdf" })) });
  assert.equal(res.status, 200);
  return res.json();
}
after(() => Promise.all(planes.map((mf) => mf.dispose())));

test("R3, R16: tier 1 read nothing, so the pdf-worker through its binding reads the text, credited to it", async () => {
  const { reading, text_units } = await readIn(true, CID);
  assert.equal(reading.text_tier, 2);
  assert.deepEqual(text_units.map((u) => u.text), ["Hello Oakland 2026"]);
  assert.equal(reading.text_undetermined, 0);
  assert.deepEqual(reading.text_source.map((s) => [s.step, s.tier]), [["layer", 2]]);
  assert.deepEqual(reading.provenance.producers, [{ tier: 2, member: "pdf-worker", pages: [0] }]);
});

test("R3: a PDF tier 1 decodes whole is not sent to the member", async () => {
  const { reading, text_units } = await readIn(true, TU);
  assert.equal(reading.text_tier, 1);
  assert.deepEqual(text_units.map((u) => u.text), ["A"]);
  assert.deepEqual(reading.provenance.producers.map((p) => [p.tier, p.member]), [[1, "plane"]]);
});

test("R3: with no member bound tier 1 stands, its text undetermined, never guessed, and the reason is carried", async () => {
  const { reading, text_units } = await readIn(false, CID);
  assert.equal(reading.found, false);
  assert.equal(reading.text_tier, 1);
  assert.equal(text_units, undefined);
  assert.equal(reading.text_glyphs, 0);
  assert.equal(reading.text_undetermined, 1);
  assert.match(reading.basis, /pdf-worker/);
  assert.match(reading.basis, /no_tounicode/);
});
