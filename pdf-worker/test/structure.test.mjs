/* pdf-worker's HTTP surface: R1–R12, R35–R38 and R41 of build/requirements/pdf-worker.md.
 *
 * The subject is a fresh build of the source by the committed bundle's own recipe (`subject.mjs`); that the committed
 * `dist/pdf-worker.bundled.mjs`, the file that deploys, equals such a build is `fleetbundles.test.mjs`'s guard. It is driven two ways: under miniflare (workerd, the runtime it
 * serves in) for the behaviour of each route, and imported into node with a
 * recording `env` where the question is what the Worker touches (R1, R37). */
import "../../bio-plane/test/sandbox.mjs";

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { extractPdfStructure, openPdfRange } from "../../bio-plane/src/pdfstructure.mjs";
import { makePdf, content, image, hex, runner } from "./make-pdf.mjs";
import { generate } from "../../bio-plane/test/pdfgen.mjs";
import { BUNDLE } from "./subject.mjs";

const { Miniflare } = await (async () => {
  try { return await import("miniflare"); } catch { /* fall through */ }
  const planePkg = fileURLToPath(new URL("../../bio-plane/package.json", import.meta.url));
  return await import(pathToFileURL(createRequire(planePkg).resolve("miniflare")).href);
})();

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const bundle = await import(pathToFileURL(BUNDLE).href);
const worker = bundle.default;
const { t, finish } = runner("structure");

/* A three-page document: text, a page with no text, text. Base-14 Helvetica,
   WinAnsiEncoding and no /ToUnicode — the residue tier 2 exists for. */
const pageObj = (c) => `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${c} 0 R >>`;
const DOC = makePdf([
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [4 0 R 5 0 R 6 0 R] /Count 3 >>",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  pageObj(7), pageObj(8), pageObj(9),
  content("BT /F1 24 Tf 72 700 Td (First page words) Tj ET"),
  content("0 0 1 rg 10 10 50 50 re f"),
  content("BT /F1 24 Tf 72 700 Td (Third page words) Tj ET"),
]);
const SHA = hex(DOC);
const NOT_PDF = new TextEncoder().encode("this is not a pdf at all");
const NOT_PDF_SHA = hex(NOT_PDF);
/* A PDF header over a catalog with no page tree: tier 1 reads it, pdf.js throws. */
const BROKEN = new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n");
const BROKEN_SHA = hex(BROKEN);

const newMf = (bindings = {}) => new Miniflare({
  modules: true, modulesRoot: "/", scriptPath: BUNDLE, script: readFileSync(BUNDLE, "utf8"),
  compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
  r2Buckets: ["CAPTURES"], bindings: { VERSION: "1.2.3-test", ...bindings },
});
const post = (mf, body, path = "structure") =>
  mf.dispatchFetch(`http://pdf-worker/${path}`, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });
const answer = async (res) => [res.status, await res.json()];

/* A recording env for the node-imported bundle: every env key read and every
   CAPTURES property touched is logged. */
function spyEnv(objects, extra = {}) {
  const log = { env: new Set(), captures: [] };
  const CAPTURES = new Proxy({
    get: async (key) => {
      const bytes = objects[key];
      return bytes ? { arrayBuffer: async () => bytes.slice().buffer } : null;
    },
  }, { get(target, prop) { if (typeof prop === "string") log.captures.push(prop); return target[prop]; } });
  const env = new Proxy({ CAPTURES, ...extra }, {
    get(target, prop) { if (typeof prop === "string") log.env.add(prop); return target[prop]; },
  });
  return { env, log };
}
const nodeCall = (env, body, { path = "structure", method = "POST" } = {}) =>
  worker.fetch(new Request(`http://pdf-worker/${path}`, { method, ...(method === "POST" ? { body: JSON.stringify(body) } : {}) }), env);

const mf = newMf();
const bucket = await mf.getR2Bucket("CAPTURES");
for (const store of ["bio", "scratch"]) {
  await bucket.put(`${store}/captures/${SHA}`, DOC);
  await bucket.put(`${store}/captures/${NOT_PDF_SHA}`, NOT_PDF);
}
await bucket.put(`biosmoke/captures/${SHA}`, DOC);

console.log("\n--- R1: no CAPTURES binding ---");
{
  for (const [label, env] of [["no CAPTURES", {}], ["CAPTURES without get", { CAPTURES: {} }], ["get not a function", { CAPTURES: { get: 1 } }]]) {
    let pulled = false;
    const body = new ReadableStream({ pull(c) { pulled = true; c.enqueue(new TextEncoder().encode("{not json")); c.close(); } }, { highWaterMark: 0 });
    const req = new Request("http://pdf-worker/structure", { method: "POST", body, duplex: "half" });
    const [status, out] = await answer(await worker.fetch(req, env));
    t(`R1 ${label}: 503 R2_NOT_CONFIGURED`, [status, out.ok, out.reason], [503, false, "R2_NOT_CONFIGURED"]);
    t(`R1 ${label}: the body was not read`, [pulled, req.bodyUsed], [false, false]);
  }
}

console.log("\n--- R2: capture_sha ---");
{
  const [s, o] = await answer(await post(mf, { capture_sha: SHA.toUpperCase(), store: "bio" }));
  t("R2 an upper-case sha is lower-cased and read", [s, o.ok, o.tier], [200, true, 2]);
  for (const [label, body] of [
    ["missing", { store: "bio" }],
    ["a number", { capture_sha: 12, store: "bio" }],
    ["null", { capture_sha: null, store: "bio" }],
    ["63 hex chars", { capture_sha: SHA.slice(1), store: "bio" }],
    ["65 hex chars", { capture_sha: SHA + "a", store: "bio" }],
    ["non-hex", { capture_sha: "g" + SHA.slice(1), store: "bio" }],
    ["empty", { capture_sha: "", store: "bio" }],
  ]) {
    const [st, out] = await answer(await post(mf, body));
    t(`R2 capture_sha ${label}: 400 BAD_SHA`, [st, out.ok, out.reason], [400, false, "BAD_SHA"]);
  }
  for (const [label, raw] of [["unparsable JSON", "{capture_sha:"], ["an empty body", ""], ["a JSON array", "[1,2]"]]) {
    const [st, out] = await answer(await post(mf, raw));
    t(`R2 ${label}: 400 BAD_SHA`, [st, out.reason], [400, "BAD_SHA"]);
  }
}

console.log("\n--- R3: store must be a string ---");
{
  for (const [label, body] of [
    ["absent", { capture_sha: SHA }],
    ["a number", { capture_sha: SHA, store: 7 }],
    ["null", { capture_sha: SHA, store: null }],
    ["an array", { capture_sha: SHA, store: ["bio"] }],
    ["an object", { capture_sha: SHA, store: { name: "bio" } }],
    ["a boolean", { capture_sha: SHA, store: true }],
  ]) {
    const [st, out] = await answer(await post(mf, body));
    t(`R3 store ${label}: 400 BAD_STORE, not NAMESPACE_UNKNOWN`, [st, out.reason], [400, "BAD_STORE"]);
  }
}

console.log("\n--- R4: store is exactly bio or scratch ---");
{
  const long = "x".repeat(100);
  for (const [label, name] of [
    ["biosmoke (its bytes are seeded under that prefix)", "biosmoke"],
    ["Scratch", "Scratch"], ["BIO", "BIO"], ["bio_smoke", "bio_smoke"], ["the empty string", ""],
    ["a trailing space", "scratch "], ["a name with a space", "a b"], ["100 chars", long],
  ]) {
    const [st, out] = await answer(await post(mf, { capture_sha: SHA, store: name }));
    t(`R4 store ${label}: 400 NAMESPACE_UNKNOWN with asked and namespaces`,
      [st, out.reason, out.asked, out.namespaces], [400, "NAMESPACE_UNKNOWN", name.slice(0, 80), ["bio", "scratch"]]);
  }
  for (const name of ["bio", "scratch"]) {
    const [st, out] = await answer(await post(mf, { capture_sha: SHA, store: name }));
    t(`R4 store ${name} is accepted`, [st, out.ok], [200, true]);
  }
  /* R4: the set equals the plane's own (its `admission` module's). A later module cannot
     be imported here, so its declaration is read from its source. */
  const plane = readFileSync(here("../../bio-plane/src/admission/index.mjs"), "utf8");
  const scratch = (plane.match(/^(?:export )?const SCRATCH = "([^"]+)";$/m) || [])[1];
  const planeSet = ((plane.match(/^(?:export )?const NAMESPACES = Object\.freeze\(\[([^\]]*)\]\);$/m) || [])[1] || "")
    .split(",").map((x) => x.trim()).filter(Boolean).map((x) => (x === "SCRATCH" ? scratch : JSON.parse(x)));
  t("R4 the namespaces this member answers with equal the plane's own set", planeSet, ["bio", "scratch"]);
  /* ...and R2 is never read for an unknown name (R4 is checked before R5). */
  const { env, log } = spyEnv({ [`biosmoke/captures/${SHA}`]: DOC });
  await nodeCall(env, { capture_sha: SHA, store: "biosmoke" });
  t("R4 an unknown namespace never reaches CAPTURES.get", log.captures.filter((p) => p === "get").length, 1);
  t("R4 (the one access is R1's type check, before the body)", log.captures, ["get"]);
}

console.log("\n--- R5: the R2 key, by .get only; NOT_FOUND ---");
{
  const reads = [];
  const env = { CAPTURES: { get: async (k) => { reads.push(k); return null; } } };
  const [st, out] = await answer(await nodeCall(env, { capture_sha: "F".repeat(64), store: "scratch" }));
  t("R5 reads the key <store>/captures/<sha>", reads, [`scratch/captures/${"f".repeat(64)}`]);
  t("R5 a missing object: 404 NOT_FOUND with capture_sha and store",
    [st, out], [404, { ok: false, reason: "NOT_FOUND", capture_sha: "f".repeat(64), store: "scratch" }]);
  const [st2, out2] = await answer(await post(mf, { capture_sha: "e".repeat(64), store: "bio" }));
  t("R5 under workerd too", [st2, out2.reason], [404, "NOT_FOUND"]);
}

/* pdf-reader's own answer for the range asked (R6, R7): the fields the member passes through beside its `text` and `tier`. */
const rangeFields = async (bytes, range = {}) => {
  const { text: _t, notes: _n, ...rest } = await (await openPdfRange(bytes)).range(range);
  return JSON.parse(JSON.stringify(rest));
};
const rangeNotes = async (bytes, range = {}) => (await (await openPdfRange(bytes)).range(range)).notes ?? [];

console.log("\n--- R6: pdf-reader's refusal, verbatim, at 422 ---");
{
  const [st, out] = await answer(await post(mf, { capture_sha: NOT_PDF_SHA, store: "bio" }));
  const want = await extractPdfStructure(NOT_PDF);
  t("R6 not a PDF: 422 and exactly extractPdfStructure's answer", [st, out], [422, JSON.parse(JSON.stringify(want))]);
  t("R6 no tier-2 pass ran (no tier, no text)", [out.tier, out.text], [undefined, undefined]);
}

console.log("\n--- R7 and R9: tier 2 replaces .text, everything else passes through ---");
{
  const [st, out] = await answer(await post(mf, { capture_sha: SHA, store: "bio" }));
  t("R7 200 and tier 2", [st, out.ok, out.tier], [200, true, 2]);
  const { text: _a, tier: _b, notes, ...rest } = out;
  t("R7 every other field is pdf-reader's own for the range, unchanged", rest, await rangeFields(DOC));
  t("R7 the notes are pdf-reader's own for the range, none added here", notes, await rangeNotes(DOC));
  t("R9 one entry per page, pages kept separate", out.text.pages.map((p) => [p.page, p.text.trim()]),
    [[0, "First page words"], [1, ""], [2, "Third page words"]]);
  const marker = { page: 1, reason: "no_text_layer", font: null, codes: "", count: 0 };
  t("R9 the empty page carries one no_text_layer marker", out.text.pages[1].undetermined, [marker]);
  t("R9 the text pages carry none", [out.text.pages[0].undetermined, out.text.pages[2].undetermined], [[], []]);
  t("R9 the document-level list holds the marker", out.text.undetermined, [marker]);
  t("R9 document joins the non-empty pages with a newline",
    out.text.document, [out.text.pages[0].text, out.text.pages[2].text].join("\n"));
  t("R9 counts", out.text.counts, { chars: out.text.document.length, undetermined: 1 });
}

console.log("\n--- R8: over the envelope ---");
{
  const mfSmall = newMf({ MAX_PDF_BYTES: String(DOC.length - 1) });
  const b = await mfSmall.getR2Bucket("CAPTURES");
  await b.put(`bio/captures/${SHA}`, DOC);
  const [st, out] = await answer(await post(mfSmall, { capture_sha: SHA, store: "bio" }));
  t("R8 over the env limit: 200, tier 1", [st, out.tier], [200, 1]);
  t("R8 the text is the over_envelope shape", out.text, {
    document: "", pages: [],
    undetermined: [{ page: null, reason: "over_envelope", font: null, codes: "", count: 0, bytes: DOC.length, limit: DOC.length - 1 }],
    counts: { chars: 0, undetermined: 1 } });
  t("R8 the note is appended", out.notes, ["tier2_declined_over_envelope"]);
  await mfSmall.dispose();

  const mfExact = newMf({ MAX_PDF_BYTES: String(DOC.length) });
  const b2 = await mfExact.getR2Bucket("CAPTURES");
  await b2.put(`bio/captures/${SHA}`, DOC);
  t("R8 exactly at the limit is not over it", (await (await post(mfExact, { capture_sha: SHA, store: "bio" })).json()).tier, 2);
  await mfExact.dispose();

  /* The default, 67,108,864 bytes (64 MiB, measured: test/envelope-memory.probe.mjs): the same document padded with a
     comment to one byte over, and to exactly the limit. */
  const pad = (n) => { const u = new Uint8Array(n); u.set(DOC); u.fill(0x20, DOC.length); u[DOC.length] = 0x25; return u; };
  const DEFAULT = 64 * 1024 * 1024;
  for (const [label, n, tier] of [["one byte over the default", DEFAULT + 1, 1], ["exactly the default", DEFAULT, 2],
                                  ["the old 16 MiB default plus one", 16777217, 2]]) {
    const bytes = pad(n);
    const sha = hex(bytes);
    const { env } = spyEnv({ [`bio/captures/${sha}`]: bytes });
    const o = await (await nodeCall(env, { capture_sha: sha, store: "bio" })).json();
    t(`R8 ${label} (${n} B): tier ${tier}`, [o.tier, o.text.undetermined[0]?.limit ?? null],
      [tier, tier === 1 ? DEFAULT : null]);
    if (tier === 1)
      t(`R8 ${label}: the decline names the size and the limit`, o.text.undetermined[0],
        { page: null, reason: "over_envelope", font: null, codes: "", count: 0, bytes: n, limit: DEFAULT });
  }
}

console.log("\n--- R8: a 23 MB PDF in WinAnsi fonts with no /ToUnicode is read (G34) ---");
{
  /* The walker's two files (reportlab, 23.2 MB and 23 MB): twenty text pages in Helvetica, WinAnsiEncoding, no
     /ToUnicode, and the bulk of the bytes one incompressible image. Tier 1 cannot decode such a font, so only tier 2 has
     the words; they were over the old 16 MiB envelope, and ended "undetermined, no_tounicode". */
  const pseudo = (n) => { const out = Buffer.alloc(n); let x = 2463534242; for (let i = 0; i < n; i++) { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; out[i] = x & 0xff; } return out; };
  const pageIds = Array.from({ length: 20 }, (_, i) => 4 + i);
  const contentId = (i) => 24 + i;
  const lines = (p) => Array.from({ length: 30 }, (_, l) => `BT /F1 11 Tf 40 ${760 - l * 12} Td (Page ${p + 1} line ${l + 1} budget appropriation fund amount for the record) Tj ET`).join("\n");
  const WALKER = makePdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(" ")}] /Count 20 >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    ...pageIds.map((_, i) => `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >>${i === 0 ? " /XObject << /Im0 44 0 R >>" : ""} >> /Contents ${contentId(i)} 0 R >>`),
    ...pageIds.map((_, i) => content(lines(i))),
    image(4800, 4800, "/ColorSpace /DeviceGray /BitsPerComponent 8", pseudo(4800 * 4800)),
  ]);
  const sha = hex(WALKER);
  const tier1 = await extractPdfStructure(WALKER);
  t("R8 the walker's shape: the file is over the old 16 MiB envelope and under 24 MiB",
    [WALKER.length > 16 * 1024 * 1024, WALKER.length < 24 * 1024 * 1024], [true, true]);
  t("R8 the walker's shape: tier 1 alone cannot read its words (no_tounicode, no characters)",
    [tier1.text.counts.chars, tier1.text.undetermined.length > 0, tier1.text.undetermined[0].reason], [0, true, "no_tounicode"]);
  const mfWalker = newMf();
  await (await mfWalker.getR2Bucket("CAPTURES")).put(`bio/captures/${sha}`, WALKER);
  const [st, out] = await answer(await post(mfWalker, { capture_sha: sha, store: "bio" }));
  t("R8 the walker's shape under workerd: 200, tier 2, with its words and nothing undetermined",
    [st, out.tier, out.text.document.includes("Page 20 line 30 budget appropriation fund amount for the record"), out.text.pages.length, out.text.counts.undetermined],
    [200, 2, true, 20, 0]);
  t("R8 the walker's shape: no decline note", out.notes.includes("tier2_declined_over_envelope"), false);
  await mfWalker.dispose();
}

console.log("\n--- R10: the tier-2 pass throws ---");
{
  await bucket.put(`bio/captures/${BROKEN_SHA}`, BROKEN);
  const [st, out] = await answer(await post(mf, { capture_sha: BROKEN_SHA, store: "bio" }));
  t("R10 200, tier 1", [st, out.ok, out.tier], [200, true, 1]);
  t("R10 the tier2_extraction_error text", out.text, {
    document: "", pages: [],
    undetermined: [{ page: null, reason: "tier2_extraction_error", font: null, codes: "", count: 0 }],
    counts: { chars: 0, undetermined: 1 } });
  const note = out.notes[out.notes.length - 1] || "";
  t("R10 one tier2_error note appended, message at most 80 chars",
    [out.notes.filter((n) => n.startsWith("tier2_error:")).length, /^tier2_error:.{1,80}$/s.test(note)], [1, true]);
  const { text: _a, tier: _b, notes: _n, ...rest } = out;
  t("R10 the range's fields are kept", rest, await rangeFields(BROKEN));
  t("R10 pdf-reader's own notes are kept, the tier2_error note after them", out.notes.slice(0, -1), await rangeNotes(BROKEN));
}

console.log("\n--- R10: a file cut before its trailer is read on a repaired view (fix round 10, cause 8) ---");
{
  /* The walker's case (A5b): 30 pages of six lines, cut at 70 per cent of its bytes (16,746 B). pdf.js throws on the cut
     file; tier 1 cannot decode its WinAnsi font; so before this the whole file answered tier2_extraction_error. */
  const cut = generate({ kind: "pdf", seed: "rw9-A-5b", size: { pages: 30, lines: 6 }, truncate: 0.7 });
  const bytes = await cut.bytes();
  const sha = hex(bytes);
  await bucket.put(`bio/captures/${sha}`, bytes);
  t("R10 the walker's file is 16,746 bytes and loses pages 23 to 30", [bytes.length, [...Array(30)].map((_, i) => cut.truth.page(i + 1).unread).filter(Boolean).length], [16746, 8]);
  const [st, out] = await answer(await post(mf, { capture_sha: sha, store: "bio" }));
  const words = (x) => x.replace(/\s+/g, "");
  t("R10 a cut file: 200, tier 2, stated partial", [st, out.ok, out.tier, out.partial, out.notes.includes("pdf_truncated")], [200, true, 2, true, true]);
  t("R10 a cut file: pages 0 to 21 carry the truth's text, none unread",
    out.text.pages.slice(0, 22).map((p) => [p.page, words(p.text), p.undetermined.length]),
    Array.from({ length: 22 }, (_, i) => [i, words(cut.truth.page(i + 1).text), 0]));
  t("R10 a cut file: the pages it could not read are named, pages 22 to 29",
    out.text.undetermined.map((u) => [u.page, u.reason]), Array.from({ length: 8 }, (_, i) => [22 + i, "truncated"]));
  t("R10 a cut file: no tier2_extraction_error", out.text.undetermined.some((u) => u.reason === "tier2_extraction_error"), false);
  t("R10 a cut file: the counts", out.text.counts, { chars: out.text.document.length, undetermined: 8 });
  /* the range asked is kept on a cut file (R42) */
  const [, r] = await answer(await post(mf, { capture_sha: sha, store: "bio", from: 20, count: 4 }));
  t("R10 a cut file, pages 20 to 23: two read, two named", r.text.pages.map((p) => [p.page, p.undetermined.map((u) => u.reason)]),
    [[20, []], [21, []], [22, ["truncated"]], [23, ["truncated"]]]);
  /* a whole file is not partial */
  const [, whole] = await answer(await post(mf, { capture_sha: SHA, store: "bio" }));
  t("R10 a whole file is not stated partial", [whole.partial, whole.notes], [undefined, []]);
}

console.log("\n--- R11: GET /version ---");
{
  const [st, out] = await answer(await mf.dispatchFetch("http://pdf-worker/version"));
  t("R11 the bound VERSION", [st, out], [200, { ok: true, name: "pdf-worker", version: "1.2.3-test" }]);
  const [st2, out2] = await answer(await worker.fetch(new Request("http://pdf-worker/version"), {}));
  t("R11 no VERSION bound: 0.0.0", [st2, out2], [200, { ok: true, name: "pdf-worker", version: "0.0.0" }]);
  const [st3, out3] = await answer(await worker.fetch(new Request("http://pdf-worker//version"), { VERSION: "7.0.0" }));
  t("R11 leading slashes are one path", [st3, out3.version], [200, "7.0.0"]);
}

console.log("\n--- R12: anything else ---");
{
  // fixtures-own: input the module's own refusal for a route it does not serve, compared with its own dispatch
  const want = { ok: false, reason: "UNKNOWN", detail: "POST /structure or GET /version only" };
  for (const [label, path, method] of [
    ["POST /version", "version", "POST"], ["GET /structure", "structure", "GET"], ["PUT /structure", "structure", "PUT"],
    ["GET /", "", "GET"], ["POST /other", "other", "POST"], ["GET /structure/x", "structure/x", "GET"],
  ]) {
    const res = await mf.dispatchFetch(`http://pdf-worker/${path}`, { method, ...(method === "GET" ? {} : { body: "{}" }) });
    t(`R12 ${label}: 404 UNKNOWN`, await answer(res), [404, want]);
  }
  const [st] = await answer(await post(mf, { capture_sha: SHA, store: "bio" }, ""));
  t("R12 (and the empty path is /structure)", st, 200);
}

console.log("\n--- R35, R36: the declared surface ---");
{
  t("R35 SURFACE names exactly structure (POST) and version (GET), neither mutating", bundle.SURFACE,
    { structure: { method: "POST", mutating: false }, version: { method: "GET", mutating: false } });
  const fm = JSON.parse(readFileSync(here("../fleet-member.json"), "utf8"));
  t("R36 fleet-member.json", [fm.entry, fm.surface, fm.testDir, fm.bundle?.entry, fm.bundle?.outfile, fm.bundle?.manifest],
    ["src/index.mjs", "SURFACE", "test", "src/index.mjs", "dist/pdf-worker.bundled.mjs", "dist/pdf-worker.bundle.json"]);
}

console.log("\n--- R37: never writes ---");
{
  const objects = { [`bio/captures/${SHA}`]: DOC, [`bio/captures/${NOT_PDF_SHA}`]: NOT_PDF };
  const { env, log } = spyEnv(objects, { VERSION: "1", MAX_PDF_BYTES: undefined });
  for (const body of [
    { capture_sha: SHA, store: "bio" }, { capture_sha: NOT_PDF_SHA, store: "bio" }, { capture_sha: "a".repeat(64), store: "bio" },
    { capture_sha: SHA, store: "nope" }, { capture_sha: SHA }, { capture_sha: "x", store: "bio" },
  ]) await nodeCall(env, body);
  await nodeCall(env, null, { path: "version", method: "GET" });
  await nodeCall(env, null, { path: "other", method: "GET" });
  t("R37 CAPTURES is only ever .get", [...new Set(log.captures)], ["get"]);
  t("R37 the only env keys read are CAPTURES, MAX_PDF_BYTES and VERSION",
    [...log.env].sort(), ["CAPTURES", "MAX_PDF_BYTES", "VERSION"]);
  const before = (await bucket.list()).objects.map((o) => `${o.key}:${o.etag}`).sort();
  await post(mf, { capture_sha: SHA, store: "bio" });
  await post(mf, { capture_sha: NOT_PDF_SHA, store: "scratch" });
  t("R37 the bucket is unchanged after calls under workerd",
    (await bucket.list()).objects.map((o) => `${o.key}:${o.etag}`).sort(), before);
  /* The deployed bindings: wrangler.jsonc is the member's contract with the
     platform. Its comments are whole lines. */
  const cfg = JSON.parse(readFileSync(here("../wrangler.jsonc"), "utf8").replace(/^\s*\/\/.*$/gm, ""));
  t("R37 the one data binding is the CAPTURES R2 bucket",
    [cfg.r2_buckets?.map((b) => b.binding), cfg.durable_objects, cfg.kv_namespaces, cfg.d1_databases, cfg.services],
    [["CAPTURES"], undefined, undefined, undefined, undefined]);
}

console.log("\n--- R38: no place named ---");
{
  const PLACES = /\b(Oakland|Alameda|California|Berkeley|Legistar)\b/i;
  /* Every answer this member can give: each refusal, the 422, the tier-1 and
     tier-2 answers, the version and the unknown route. */
  const { env } = spyEnv({ [`bio/captures/${SHA}`]: DOC, [`bio/captures/${NOT_PDF_SHA}`]: NOT_PDF,
                           [`bio/captures/${BROKEN_SHA}`]: BROKEN });
  const texts = [];
  for (const body of [
    { capture_sha: SHA }, { capture_sha: "x", store: "bio" }, { capture_sha: SHA, store: "zz" },
    { capture_sha: "a".repeat(64), store: "bio" }, { capture_sha: NOT_PDF_SHA, store: "bio" },
    { capture_sha: BROKEN_SHA, store: "bio" }, { capture_sha: SHA, store: "bio" },
  ]) texts.push(await (await nodeCall(env, body)).text());
  const { env: small } = spyEnv({ [`bio/captures/${SHA}`]: DOC }, { MAX_PDF_BYTES: "1" });
  texts.push(await (await nodeCall(small, { capture_sha: SHA, store: "bio" })).text());
  texts.push(await (await worker.fetch(new Request("http://pdf-worker/structure", { method: "POST" }), {})).text());
  texts.push(await (await nodeCall(env, null, { path: "version", method: "GET" })).text());
  texts.push(await (await nodeCall(env, null, { path: "zz", method: "GET" })).text());
  t("R38 no refusal text names a place", texts.filter((s) => PLACES.test(s)), []);
  /* This module's code, `src/index.mjs`, comments removed: only a comment may
     cite where a measurement was taken (layers.md, rule 6). The other files in
     `src/` belong to image-codecs and pdf-pixels, which hold their own R38. */
  const code = readFileSync(here("../src/index.mjs"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  t("R38 no place is named in the module's code", PLACES.test(code), false);
}

console.log("\n--- R41: pure per call ---");
{
  const objects = { [`bio/captures/${SHA}`]: DOC, [`bio/captures/${NOT_PDF_SHA}`]: NOT_PDF,
                    [`bio/captures/${BROKEN_SHA}`]: BROKEN };
  /* One call of each kind the member answers, each with its own options. */
  const CALLS = [
    ["tier 2", { capture_sha: SHA, store: "bio" }],
    ["tier 2, upper-case sha", { capture_sha: SHA.toUpperCase(), store: "bio" }],
    ["not a PDF (422)", { capture_sha: NOT_PDF_SHA, store: "bio" }],
    ["tier-2 failure", { capture_sha: BROKEN_SHA, store: "bio" }],
    ["over the envelope", { capture_sha: SHA, store: "bio" }, { MAX_PDF_BYTES: String(DOC.length - 1) }],
    ["not found", { capture_sha: "a".repeat(64), store: "scratch" }],
    ["bad sha", { capture_sha: "x", store: "bio" }],
    ["bad store", { capture_sha: SHA }],
    ["unknown namespace", { capture_sha: SHA, store: "biosmoke" }],
    ["version", null, { VERSION: "4.5.6" }, { path: "version", method: "GET" }],
    ["unknown route", null, {}, { path: "zz", method: "GET" }],
  ];
  const one = async ([, body, extra = {}, how]) => {
    const res = await nodeCall(spyEnv(objects, extra).env, body, how);
    return [res.status, await res.text()];
  };
  const runAll = async (order) => {
    const out = {};
    for (const c of order) out[c[0]] = await one(c);
    return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)));
  };
  const first = await runAll(CALLS);
  t("R41 (each call answers as R2–R12 say, so every kind of answer is covered)",
    Object.fromEntries(Object.entries(first).map(([l, [st]]) => [l, st])),
    { "bad sha": 400, "bad store": 400, "not a PDF (422)": 422, "not found": 404, "over the envelope": 200,
      "tier 2": 200, "tier 2, upper-case sha": 200, "tier-2 failure": 200, "unknown namespace": 400,
      "unknown route": 404, "version": 200 });
  t("R41 the same calls again, in reverse order: every answer byte-identical",
    await runAll([...CALLS].reverse()), first);
  const again = [];
  for (const c of CALLS) again.push([c[0], ...(await one(c))], [c[0], ...(await one(c))]);
  t("R41 each call made twice in a row answers the same both times",
    again.filter((_, i) => i % 2 === 0).map(([l, s, b]) => [l, s, b]), again.filter((_, i) => i % 2 === 1).map(([l, s, b]) => [l, s, b]));

  /* No clock and no randomness: the same calls under a clock ten years on and
     random sources that return other values answer exactly as before. */
  const RealDate = Date, realRandom = Math.random, realNow = performance.now.bind(performance);
  const realGRV = crypto.getRandomValues.bind(crypto), realUUID = crypto.randomUUID?.bind(crypto);
  const SKEW = 10 * 365.25 * 864e5;
  let touched = false;
  const mark = () => { touched = true; };
  globalThis.Date = class extends RealDate {
    constructor(...a) { if (!a.length) mark(); super(...(a.length ? a : [RealDate.now() + SKEW])); }
    static now() { mark(); return RealDate.now() + SKEW; }
  };
  Math.random = () => { mark(); return 0.999; };
  performance.now = () => { mark(); return realNow() + SKEW; };
  crypto.getRandomValues = (a) => { mark(); return a.fill(0xab); };
  if (realUUID) crypto.randomUUID = () => { mark(); return "00000000-0000-4000-8000-000000000000"; };
  let skewed;
  try { skewed = await runAll(CALLS); }
  finally {
    globalThis.Date = RealDate; Math.random = realRandom; performance.now = realNow;
    crypto.getRandomValues = realGRV; if (realUUID) crypto.randomUUID = realUUID;
  }
  t("R41 under another clock and other random values, every answer is the same", skewed, first);
  console.log(`  (a clock or random source was ${touched ? "read, and changed nothing" : "never read"})`);

  /* The runtime it serves in answers the same bytes as node, and the same on a
     second call to the same isolate. */
  for (const [label, body] of [["tier 2", { capture_sha: SHA, store: "bio" }],
                               ["tier-2 failure", { capture_sha: BROKEN_SHA, store: "bio" }]]) {
    const a = await (await post(mf, body)).text();
    const b = await (await post(mf, body)).text();
    t(`R41 ${label} under workerd: the same answer twice, and the same as node's`, [a, b], [first[label][1], first[label][1]]);
  }
}

await mf.dispose();
finish();
