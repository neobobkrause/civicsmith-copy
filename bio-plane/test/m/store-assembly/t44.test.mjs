/* store-assembly's copy of plane's T44 test (T44-13; N869, N874; DEC-191 (4), (5); K2719, K2726): a `NO_PAGE_RENDERED` answer carries `refused`, one
   `{page, reason, process?}` per asked page not sent (R57); the gated hook's `by` for an `ai` caller (plane R6) stays with plane. Each is checked at the interface
   (the transcriber's AI path, its page rendering) with a negative control (K874). The pictures are pdf-pixels' own fixtures (`picture-variants.json`,
   made with Pillow) or a JPEG header written here; the vector-only PDF page is written here. */
import { ENTRIES } from "../ai-accounts/catalogue.mjs";
import "../../../src/store-assembly/register.mjs";   /* R83: the start's registration before any op table is read */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { store, admitPart } from "./fixture.mjs";
import { transcriberOf, renderAsked, renderPages, TRANSCRIBE_IMAGE_MAX_BYTES } from "../../../src/store-assembly/transcribe.mjs";
import { renderPageToPixels } from "../../../../pdf-worker/src/pagepixels.mjs";
import { renderPictureToPixels, PICTURE_SOURCE_MAX } from "../../../../pdf-worker/src/picturepixels.mjs";

const here = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const VARIANTS = JSON.parse(readFileSync(here("../../../../pdf-worker/test/fixtures/picture-variants.json"), "utf8")).variants;
const variant = (name) => new Uint8Array(Buffer.from(VARIANTS.find((v) => v.name === name).b64, "base64"));
const PROGRESSIVE = variant("refuse-progressive");
const BASELINE = variant("orient-none");
const SCAN = new Uint8Array(readFileSync(here("../../../../pdf-worker/test/fixtures/scan-dct-page.pdf")));
const shaOf = (b) => createHash("sha256").update(b).digest("hex");
const SENTINEL = "sk-ant-SENTINEL-T44-0000";
const ACCOUNT = { ok: true, entry_id: ENTRIES.a, kind: "apikey", level: "member", key: SENTINEL };

/* A baseline JPEG whose frame header says `w` × `h` (its SOF0 rewritten), so the picture renderer judges the frame
   before any decode. */
function framed(w, h) {
  const b = new Uint8Array(BASELINE);
  for (let i = 2; i < b.length - 9; i++)
    if (b[i] === 0xff && b[i + 1] === 0xc0) {
      b[i + 5] = h >> 8; b[i + 6] = h & 0xff; b[i + 7] = w >> 8; b[i + 8] = w & 0xff;
      return b;
    }
  throw new Error("no SOF0");
}
const HUGE = framed(20000, 15000);   /* over pdf-pixels' PICTURE_SOURCE_MAX, judged before decode */

/* A one-page PDF that paints a stroked line and no image: pdf-pixels R17's NOT_IMAGE_ONLY. */
function vectorPdf() {
  const ops = "0 0 m 100 100 l S";
  const objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>",
    `<< /Length ${ops.length} >>\nstream\n${ops}\nendstream`];
  let out = "%PDF-1.7\n";
  const at = objs.map((o, i) => { const off = out.length; out += `${i + 1} 0 obj\n${o}\nendobj\n`; return off; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + at.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(out, "latin1"));
}
const VECTOR = vectorPdf();

/* The evidence bucket, in memory. */
function bucket() {
  const held = new Map();
  const object = (k, b) => ({ key: k, size: b.length, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) });
  return { async put(k, v) { held.set(k, v); return { key: k, size: v.length }; },
           async get(k) { return held.has(k) ? object(k, held.get(k)) : null; },
           async head(k) { return held.has(k) ? { key: k, size: held.get(k).length } : null; } };
}
/* agent-worker's `/transcribe`, recording every request. */
function agentWorker() {
  const seen = [];
  return { seen, fetch: async (u, init) => { const body = JSON.parse(init.body); seen.push(body);
    return new Response(JSON.stringify({ ok: true, engine: "claude-test", version: null,
      pages: body.pages.map((p) => ({ page: p.page, text: "words" })), not_transcribed: [] }),
      { status: 200, headers: { "content-type": "application/json" } }); } };
}
/* The AI path of one act on an assembled store over a fresh storage, `bytes` held in its evidence store. */
async function pathFor(bytes) {
  const evidence = bucket(), worker = agentWorker();
  const env = { STORE: { idFromName: (n) => n }, ACCOUNT_SEAL_SECRET: "a-long-seal-secret-for-the-t44-test", CAPTURES: evidence,
                AGENT_WORKER: worker };
  const st = await store({ env });
  await admitPart(st.ctx, "transcribe");   /* ai-runs R78: admitted on the fixture's entries */
  const d = shaOf(bytes);
  await evidence.put(`bio/captures/${d}`, bytes);
  const tx = transcriberOf(st.ctx, env).transcription({ member: "member:ann", at: "2026-10-11T06:00:00Z" });
  return { worker, ctx: st.ctx, ask: (pages) => tx.transcribe({ account: ACCOUNT, capture_sha: d, pages }) };
}

/* ===== R57 ===== */

test("R57 (T44; N869; DEC-191 (5)): a progressive JPEG's page is answered NO_PAGE_RENDERED with `refused` naming the picture renderer's UNSUPPORTED_JPEG_PROCESS and its process; nothing is posted", async () => {
  const own = await renderPictureToPixels(PROGRESSIVE, 0, { maxEdge: 1568, grey: true });
  assert.equal(own.reason, "UNSUPPORTED_JPEG_PROCESS", JSON.stringify(own));
  const x = await pathFor(PROGRESSIVE);
  const r = await x.ask([0]);
  assert.deepEqual(r, { ok: false, reason: "NO_PAGE_RENDERED",
                        refused: [{ page: 0, reason: "UNSUPPORTED_JPEG_PROCESS", process: own.process }],
                        asked: [0], sent: [], owed: [] }, "R58: the pages asked and sent are stated");
  assert.match(r.refused[0].process, /progressive/);
  assert.equal(x.worker.seen.length, 0, "nothing posted");
  assert.ok(!JSON.stringify(r).includes(SENTINEL));
});

test("R57 (T44; N869; DEC-191 (5)): an oversized frame (a JPEG over PICTURE_SOURCE_MAX) is refused IMAGE_TOO_LARGE in `refused`, as the picture renderer answers it, with no process; nothing is posted", async () => {
  assert.ok(20000 * 15000 * 3 > PICTURE_SOURCE_MAX);
  const own = await renderPictureToPixels(HUGE, 0, { maxEdge: 1568, grey: true });
  assert.equal(own.reason, "IMAGE_TOO_LARGE", JSON.stringify(own));
  const x = await pathFor(HUGE);
  assert.deepEqual(await x.ask([0]), { ok: false, reason: "NO_PAGE_RENDERED", refused: [{ page: 0, reason: "IMAGE_TOO_LARGE" }],
                                         asked: [0], sent: [], owed: [] });
  assert.equal(x.worker.seen.length, 0);
});

test("R57 (T44; N869): a PDF page that paints no image is refused NOT_IMAGE_ONLY in `refused`, the page renderer's key; nothing is posted", async () => {
  const own = await renderPageToPixels(VECTOR, 0, { decodeDct: true });
  assert.equal(own.reason, "NOT_IMAGE_ONLY", JSON.stringify(own));
  const x = await pathFor(VECTOR);
  assert.deepEqual(await x.ask([0]), { ok: false, reason: "NO_PAGE_RENDERED", refused: [{ page: 0, reason: "NOT_IMAGE_ONLY" }],
                                         asked: [0], sent: [], owed: [] });
  assert.equal(x.worker.seen.length, 0);
});

test("R57 (T44) negative control: a rendered page is posted, and the answer carries no `refused`; a page that renders is never in `refused` beside one that does not", async () => {
  const x = await pathFor(SCAN);
  const r = await x.ask([0]);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(Object.hasOwn(r, "refused"), false);
  assert.equal(x.worker.seen.length, 1);
  /* page 1 of a one-page scan is refused, page 0 sent: the act posts page 0 and answers no `refused` */
  const y = await pathFor(SCAN);
  const ry = await y.ask([0, 1]);
  assert.equal(ry.ok, true);
  assert.equal(Object.hasOwn(ry, "refused"), false);
  assert.deepEqual(y.worker.seen[0].pages.map((p) => p.page), [0]);
  /* R58: the page not sent is named unread, never dropped silently */
  assert.deepEqual([ry.asked, ry.sent, ry.unread.map((u) => u.page)], [[0, 1], [0], [1]]);
});

test("R57 (T44; N869): `refused` holds one entry per asked page not sent, in ascending order: the renderer's own key, DECODE_FAILED for a renderer that throws or answers no PNG, IMAGE_TOO_LARGE for a PNG over TRANSCRIBE_IMAGE_MAX_BYTES, `process` only when the renderer's detail names one", async () => {
  const png = (n) => { const b = new Uint8Array(n); b.set([0x89, 0x50, 0x4e, 0x47]); return b; };
  const render = async (bytes, page) => {
    if (page === 0) return { ok: false, reason: "PAGE_HAS_TEXT_LAYER", why: "w", page };
    if (page === 1) throw new Error("bad");
    if (page === 2) return { ok: true, mediaType: "image/jpeg", bytes: new Uint8Array(10) };
    if (page === 3) return { ok: true, mediaType: "image/png", bytes: png(TRANSCRIBE_IMAGE_MAX_BYTES + 1) };
    if (page === 4) return { ok: false, reason: "UNSUPPORTED_JPEG_PROCESS", jpeg: "UNSUPPORTED_PROCESS", process: "lossless-huffman", page };
    if (page === 5) return { ok: false, reason: "NOT_A_PDF" };
    if (page === 6) return { ok: true, mediaType: "image/png", bytes: new Uint8Array(0) };
    return { ok: true, mediaType: "image/png", bytes: png(16) };
  };
  const picture = async () => { throw new Error("no picture"); };
  const out = await renderAsked(new Uint8Array(1), [7, 6, 5, 4, 3, 2, 1, 0, 0], render, picture);
  assert.deepEqual(out.refused, [{ page: 0, reason: "PAGE_HAS_TEXT_LAYER" }, { page: 1, reason: "DECODE_FAILED" },
    { page: 2, reason: "DECODE_FAILED" }, { page: 3, reason: "IMAGE_TOO_LARGE" },
    { page: 4, reason: "UNSUPPORTED_JPEG_PROCESS", process: "lossless-huffman" }, { page: 5, reason: "DECODE_FAILED" },
    { page: 6, reason: "DECODE_FAILED" }]);
  assert.deepEqual(out.sent.map((p) => p.page), [7]);
  /* renderPages answers the same pages sent */
  assert.deepEqual((await renderPages(new Uint8Array(1), [7, 6, 5, 4, 3, 2, 1, 0], render, picture)).map((p) => p.page), [7]);
  /* a picture renderer's refusal after NOT_A_PDF is the picture's, never NOT_A_PDF */
  const pictured = await renderAsked(new Uint8Array(1), [5], render, async () => ({ ok: false, reason: "NOT_A_PICTURE" }));
  assert.deepEqual(pictured.refused, [{ page: 5, reason: "NOT_A_PICTURE" }]);
});
