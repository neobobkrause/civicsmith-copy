/* extraction R102 as fix round 10 (cause 10, G2; walk A10 N5; K5053) amends it: `pages_left`, in the registered row and in `owedwork`'s answer, is the
   document's unread page count (its pages not yet in the text index), not the count of the piece being read, and equals the figure the Add screen's press
   states. Driven through the module's real entries (`readHeld` as the plane's ledger calls it, `op=pdfstructure&ocr=1`) with the real reader and
   test-support's PDF generator and registrar stub. Each test names the requirement ids it checks. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fresh, bundle, bucket, doc, sha, member, ocrAnswer, homesOver } from "./fixture.mjs";
import { generate } from "../../pdfgen.mjs";
// fixtures-contract: store-assembly job-registrar
import { jobRegistrarStub } from "../../job-registrar-stub.mjs";

const register = (rows) => homesOver(rows);
async function home(bytes) {
  const rows = new Map(), evidence = bucket();
  const w = fresh({ evidence, provenance: register(rows) });
  bundle(w.s, "INFO-1");
  const d = sha(bytes);
  rows.set(d, { bundleId: "INFO-1", path: "f", encoding: "binary", bytes: bytes.length, registered: "t", authored: false });
  await evidence.put(`bio/captures/${d}`, bytes);
  const document = doc({ digest: d, bytes: bytes.length, ct: "application/pdf", format: "pdf" });
  w.core.readFile = (b, p) => (b === "INFO-1" && p === "data/provenance.json" ? { text: JSON.stringify({ documents: [document] }) } : null);
  return { w, d };
}
const scan = async (pages) => generate({ kind: "pdf", seed: "r10", fonts: ["type0"], size: { pages, lines: 3 }, kinds: ["scan"] }).bytes();
/* the unread pages the index holds no glyph of: the figure the press states */
const unreadIn = (w, d, n) => {
  const read = new Set(w.rows(`SELECT extent, text FROM capture_text WHERE capture_sha=? AND extent_kind='pdf-page'`, d)
    .filter((u) => /\S/.test(u.text)).map((u) => JSON.parse(u.extent).page));
  return n - read.size;
};
/* the OCR member answers one page a call and defers the rest, as the deployed member does within its budget */
const ocrFew = () => member((body) => { const [first, ...rest] = Array.isArray(body.pages) ? body.pages : []; return { ...ocrAnswer(first === undefined ? [] : [first], { text: (p) => `ocr words of page ${p}` }), deferred: rest }; });

test("R102 R10 (fix round 10, cause 10; A10 N5): a 300-page scan read in pieces states, after each piece, `pages_left` equal to the document's unread pages (the registered row and the answer), and the press states the same figure", { timeout: 300_000 }, async () => {
  const bytes = await scan(300);
  const { w, d } = await home(bytes);
  const jobs = jobRegistrarStub(), entries = [];
  const registerJob = (e) => { entries.push(structuredClone(e)); return jobs.registerJob(e); };
  const env = { OCR_WORKER: ocrFew() };
  let ticks = 0, checked = 0, more = true;
  for (let a; ticks < 60; ticks++) {
    a = await w.x.readHeld({ sha: d, kind: more ? "reading" : "ocr", env, registerJob, armJobs: jobs.armJobs });
    more = a.more === true;
    const reg = a.registration || a.owed_registration || null;
    const row = jobs.rows().find((x) => x.kind === "ocr" && x.sha === d);
    const unread = unreadIn(w, d, 300);
    if (unread === 0 && !more) break;
    if (!row) { if (!more) assert.equal(unread, 0, `tick ${ticks}: no row only when nothing is unread`); if (!more) break; continue; }
    assert.equal(entries.at(-1).pages_left, unread, `tick ${ticks}: the registered entry states the document's unread pages`);
    if (reg) assert.equal(reg.pages_left, unread, `tick ${ticks}: the answer states the same`);
    const press = await w.x.pdfStructure({ ocr: "1", sha: d, viewer: "class:admin", author: "member:m1", env });
    const candidate = press.body.reextraction.candidate;
    if (Array.isArray(candidate) && candidate.length) assert.equal(entries.at(-1).pages_left, candidate.length, `tick ${ticks}: the press states the same figure`);
    checked++;
  }
  assert.ok(checked > 1, "the scan registered its remainder after several pieces");
});
