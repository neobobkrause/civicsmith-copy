/* store-assembly's copy of plane's T43 test (T43-15; N853b, N862, N866; DEC-190; K2611, K2691, K2692, K2716): the `bundle` screen's new acts (R23), a
   picture file's page rendered by pdf-pixels' picture renderer for the AI (R57), (the `ai` caller's author on the
   Worker's gated hook, plane R6, stays with plane). Each is checked at the interface (the registry it carries, the transcriber's page rendering,
   the assembled store's door) with a negative control (K874). The fixtures are made for this suite with
   Pillow 12.3.0: `t43-photo-o6.jpg`, a 3200×2400 baseline colour JPEG whose EXIF Orientation is 6, and `t43-page.png`,
   an 800×600 colour PNG. */
import { aiAccountsOf } from "../../../src/ai-accounts/index.mjs";
import "../../../src/store-assembly/register.mjs";   /* R83: the start's registration before any op table is read */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { store, disclosed, admitPart } from "./fixture.mjs";
import { SCREEN_REGISTRY } from "../../../src/wizard-scripts/index.mjs";
import { screenFailures } from "../../../src/store-assembly/wizards.mjs";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { assistantGateOf } from "../../../src/store-assembly/ask.mjs";
import { renderPages, TRANSCRIBE_PICTURE_EDGE, TRANSCRIBE_IMAGE_MAX_BYTES } from "../../../src/store-assembly/transcribe.mjs";
import { aiRunsOf } from "../../../src/ai-runs/index.mjs";
import { extractionOf } from "../../../src/extraction/index.mjs";
import { credentialsOf } from "../../../src/credentials/index.mjs";
import { renderPageToPixels } from "../../../../pdf-worker/src/pagepixels.mjs";
import { renderPictureToPixels } from "../../../../pdf-worker/src/picturepixels.mjs";
import { pageRefusal } from "../../../../pdf-worker/test/pdf-pixels-fixtures.mjs";   /* pdf-pixels' published refusals, made by its real renderers */

const fixture = (rel) => new Uint8Array(readFileSync(fileURLToPath(new URL(rel, import.meta.url))));
const PHOTO = fixture("./fixtures/t43-photo-o6.jpg");
const PAGE_PNG = fixture("./fixtures/t43-page.png");
const SCAN = fixture("../../../../pdf-worker/test/fixtures/scan-dct-page.pdf");
const shaOf = (b) => createHash("sha256").update(b).digest("hex");
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const SENTINEL = "sk-ant-SENTINEL-T43-0000";
const ONE_MATTER = Object.freeze({ id: "t43-set", version: 1, matters: Object.freeze([{ id: "m1" }]) });
const PASSED = { part: "transcribe", set: "t43-set", set_version: 1, false_alarm_rate: 0, passed: true, graded_by: "harness",
                 at: "2026-10-01T00:00:00Z" };

/* A PNG's IHDR: width, height, bit depth and colour type (0 grey, 2 colour). */
function ihdr(png) {
  const b = Buffer.from(png);
  assert.deepEqual([...b.subarray(0, 8)], PNG_SIG, "a PNG");
  assert.equal(b.toString("latin1", 12, 16), "IHDR");
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), depth: b[24], colour: b[25] };
}

/* ===== R23 ===== */

/* (T51; K3807) the registry is the design's (`wizard-scripts`' `SCREEN_REGISTRY`): the `document` screen carries what the
   old `bundle` screen did, and lists the acts itself. `reading` is no act of that screen in the registry. */
const NEW_ACTS = ["pagetranscribe", "transcribe"];
const missingFrom = (screens) => {
  const doc = screens.find((s) => s.id === "document");
  return doc ? NEW_ACTS.filter((a) => !doc.acts.includes(a)) : NEW_ACTS;
};

test("R23 (T43; N862; DEC-190 (1); T51): the registry's `document` screen's acts hold `pagetranscribe` and `transcribe`, each an op op-declarations declares, and the registry still passes the release suite's check", () => {
  assert.deepEqual(missingFrom(SCREEN_REGISTRY), []);
  for (const a of [...NEW_ACTS, "reading"]) assert.ok(Object.hasOwn(OPS, a), `${a} is declared`);
  assert.deepEqual(screenFailures(SCREEN_REGISTRY, OPS), []);
  /* negative controls: the screen without them is caught, and an op spec missing for one fails the suite */
  const without = SCREEN_REGISTRY.map((s) => (s.id === "document" ? { ...s, acts: s.acts.filter((a) => !NEW_ACTS.includes(a)) } : s));
  assert.deepEqual(missingFrom(without), NEW_ACTS);
  const { transcribe, ...lacking } = OPS;
  assert.ok(transcribe);
  assert.deepEqual(screenFailures(SCREEN_REGISTRY, lacking), [{ screen: "document", problem: "no op spec", act: "transcribe" }]);
});

/* ===== R57: the picture route ===== */

test("R57 (T43; N853b; K2716): TRANSCRIBE_PICTURE_EDGE is exported, 1,568 px, and fits agent-worker's cap: a 1,568 px square grey PNG at 8 bits is under TRANSCRIBE_IMAGE_MAX_BYTES before any compression", () => {
  assert.equal(TRANSCRIBE_PICTURE_EDGE, 1568);
  assert.ok(TRANSCRIBE_PICTURE_EDGE * TRANSCRIBE_PICTURE_EDGE + TRANSCRIBE_PICTURE_EDGE < TRANSCRIBE_IMAGE_MAX_BYTES);
  /* negative control: the high-resolution tier's 2,576 px is not the figure */
  assert.notEqual(TRANSCRIBE_PICTURE_EDGE, 2576);
});

test("R57 (T43; N853b): a page the page renderer answers NOT_A_PDF for is rendered by renderPictureToPixels(bytes, page, {maxEdge: TRANSCRIBE_PICTURE_EDGE, grey: true}); a JPEG photo's page 0 is sent as pdf-pixels' upright grey PNG, its long edge at most 1,568 px", async () => {
  const out = await renderPages(PHOTO, [0]);
  assert.deepEqual(out.map((p) => [p.page, p.media_type]), [[0, "image/png"]]);
  const sent = Buffer.from(out[0].data, "base64");
  const expected = await renderPictureToPixels(PHOTO, 0, { maxEdge: TRANSCRIBE_PICTURE_EDGE, grey: true });
  assert.equal(expected.ok, true, JSON.stringify(expected));
  assert.ok(sent.equals(Buffer.from(expected.bytes)), "the picture renderer's PNG, as it made it");
  const h = ihdr(sent);
  assert.equal(h.colour, 0, "grey");
  assert.ok(Math.max(h.width, h.height) <= TRANSCRIBE_PICTURE_EDGE, `${h.width}×${h.height}`);
  assert.ok(h.height > h.width, "Orientation 6 turned upright: portrait");
  assert.ok(!sent.equals(Buffer.from(PHOTO)), "never the member's file itself (agent-worker R63)");
  /* a PNG upload is rendered the same way: grey, its 800 px edge unreduced */
  const png = await renderPages(PAGE_PNG, [0]);
  const hp = ihdr(Buffer.from(png[0].data, "base64"));
  assert.deepEqual([hp.colour, hp.width, hp.height], [0, 800, 600]);
  /* the options handed to the picture renderer, and only after NOT_A_PDF */
  const asked = [];
  const spy = async (b, page, opts) => { asked.push([page, opts]); return renderPictureToPixels(b, page, opts); };
  await renderPages(PHOTO, [0], renderPageToPixels, spy);
  assert.deepEqual(asked, [[0, { maxEdge: 1568, grey: true }]]);
  /* negative control: without the fall-back (the page renderer alone) the photo is not sent */
  const pdfOnly = await renderPageToPixels(PHOTO, 0, { decodeDct: true });
  assert.deepEqual([pdfOnly.ok, pdfOnly.reason], [false, "NOT_A_PDF"]);
});

test("R57 (T43; N853b): the picture renderer's refusals, and a throw, leave the page unread; a page renderer refusal other than NOT_A_PDF never reaches the picture renderer; a PDF page renders as before, byte for byte", async () => {
  /* a picture's page 1 does not exist (NO_SUCH_PAGE): unread, page 0 sent */
  const two = await renderPages(PHOTO, [1, 0]);
  assert.deepEqual(two.map((p) => p.page), [0]);
  assert.equal((await renderPictureToPixels(PHOTO, 1, { maxEdge: 1568, grey: true })).reason, "NO_SUCH_PAGE");
  /* bytes neither PDF nor picture: NOT_A_PICTURE, unread */
  assert.deepEqual(await renderPages(new TextEncoder().encode("plain words, no picture"), [0]), []);
  /* a picture renderer that refuses or throws, or answers a PNG over the cap: unread */
  const big = new Uint8Array(TRANSCRIBE_IMAGE_MAX_BYTES + 1); big.set(PNG_SIG);
  for (const picture of [async () => ({ ok: false, reason: "IMAGE_TOO_LARGE" }), async () => { throw new Error("x"); },
                         async () => ({ ok: true, mediaType: "image/png", bytes: big })])
    assert.deepEqual(await renderPages(PHOTO, [0], renderPageToPixels, picture), []);
  /* another refusal of the page renderer is answered as before: no picture asked */
  let pictured = 0;
  const count = async (...a) => { pictured++; return renderPictureToPixels(...a); };
  const refuse = async () => pageRefusal("PAGE_HAS_TEXT_LAYER");
  assert.deepEqual(await renderPages(PHOTO, [0], refuse, count), []);
  assert.equal(pictured, 0);
  /* control: a PDF page renders as before, byte for byte, the picture renderer never asked */
  const pdf = await renderPages(SCAN, [0], renderPageToPixels, count);
  const before = await renderPageToPixels(SCAN, 0, { decodeDct: true });
  assert.ok(Buffer.from(pdf[0].data, "base64").equals(Buffer.from(before.bytes)));
  assert.equal(pictured, 0);
});

/* The evidence bucket, in memory. */
function bucket() {
  const held = new Map();
  const object = (k, b) => ({ key: k, size: b.length, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) });
  return { held,
    async put(k, v) { held.set(k, v); return { key: k, size: v.length }; },
    async get(k) { return held.has(k) ? object(k, held.get(k)) : null; },
    async head(k) { return held.has(k) ? { key: k, size: held.get(k).length } : null; },
    async delete(k) { held.delete(k); },
    async list() { return { objects: [...held.keys()].map((key) => ({ key })), truncated: false }; } };
}
/* agent-worker's `/transcribe`, recording every request. */
function agentWorker() {
  const seen = [];
  return { seen, fetch: async (u, init) => { const body = JSON.parse(init.body); seen.push(body);
    return new Response(JSON.stringify({ ok: true, engine: "claude-test", version: null,
      pages: body.pages.map((p) => ({ page: p.page, text: `the AI's words on page ${p.page}` })), not_transcribed: [],
      usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, total_cost_usd: 0.01 },
      calls: body.pages.length }), { status: 200, headers: { "content-type": "application/json" } }); } };
}
/* An assembled store over a fresh storage with a one-matter set passed, `ann` holding an API-key account, and `bytes` filed as an
   uploaded capture with its reading (one page, not read as text), as a promotion leaves it. */
async function planeHolding(bytes, worker) {
  const evidence = bucket();
  const env = { ACCOUNT_SEAL_SECRET: "a-long-seal-secret-for-the-t43-test", CAPTURES: evidence, AGENT_WORKER: worker };
  /* R50 (T46): the set ai-runs is built with */
  const { s, ctx } = await store({ env, before: (c) => assistantGateOf(c, { testSet: ONE_MATTER }) });
  const sql = ctx.storage.sql;
  sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
            VALUES ('ada', 'Cover ada', 'h_ada', 'admin', 'active', '["contribute"]', 't', 't')`);
  assert.equal(credentialsOf(ctx).aiKeepAwaySet({ on: false, by: "ada" }).ok, true);
  sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
            VALUES ('ann', 'Cover ann', 'h_ann', 'member', 'active', '["contribute"]', 't', 't')`);
  await disclosed(ctx);   /* R35 (T47): the disclosure first, as the assembled plane asks */
  assert.equal((await aiAccountsOf(ctx).accountReferenceSet({ member: "member:ann", kind: "apikey", secret: SENTINEL, by: "member:ann" })).ok, true);
  assert.equal(aiRunsOf(ctx).testBarRecord(PASSED).ok, true);
  await admitPart(ctx, "transcribe");   /* ai-runs R78: admitted on the fixture's entries */
  const d = shaOf(bytes);
  await evidence.put(`bio/captures/${d}`, bytes);
  sql.exec(`INSERT INTO bundles (bundle_id, object_type, group_id, title, current_state, created, last_updated, bundle_sha, row_version)
            VALUES ('B-T43', 'information', 'g', 't', 'collected', '2026-01-01', '2026-01-01', 'x', 1)`);
  const w = extractionOf(ctx).writeReading({ bundleId: "B-T43", captureSha: d, reading: { content_type: "generic", reader_version: 1,
    read_from_text: false, found: false, entities: [], facts: {}, at: "2026-09-01T00:00:00Z", basis: "b", text_source: null,
    page_count: 1 } });
  assert.notEqual(w && w.ok, false, JSON.stringify(w));
  const call = async (path) => {
    const op = new URL("http://do" + path).pathname.slice(1);
    return JSON.parse(JSON.stringify(await s.routes(new URL("http://do" + path), null)[op]() ?? null));
  };
  return { d, call };
}
const stamps = (d) => `/pagetranscribe?sha256=${d}&cls=member&session=1&caps=contribute&viewer=member:ann&author=member:ann&store=bio`;

test("R57 (T43; N853b; extraction R73): end to end on the object, a member's pagetranscribe of an uploaded JPEG posts its page 0 to agent-worker as one grey PNG whose long edge is at most 1,568 px; control: a PDF scan's page is posted as before, byte for byte", async () => {
  const worker = agentWorker();
  const x = await planeHolding(PHOTO, worker);
  const r = await x.call(stamps(x.d));
  assert.equal(r.status, 200, JSON.stringify(r));
  assert.equal(r.body.transcription.performed, true, JSON.stringify(r.body));
  assert.deepEqual(r.body.transcription.pages, [0]);
  assert.equal(worker.seen.length, 1);
  const pages = worker.seen[0].pages;
  assert.deepEqual(pages.map((p) => [p.page, p.media_type]), [[0, "image/png"]]);
  const h = ihdr(Buffer.from(pages[0].data, "base64"));
  assert.equal(h.colour, 0, "grey");
  assert.ok(Math.max(h.width, h.height) <= 1568 && h.height > h.width, `${h.width}×${h.height}`);
  /* control: a PDF scan's page is the page renderer's PNG, unchanged by the picture route */
  const pw = agentWorker();
  const y = await planeHolding(SCAN, pw);
  const ry = await y.call(stamps(y.d));
  assert.equal(ry.body.transcription.performed, true, JSON.stringify(ry.body));
  const before = await renderPageToPixels(SCAN, 0, { decodeDct: true });
  assert.ok(Buffer.from(pw.seen[0].pages[0].data, "base64").equals(Buffer.from(before.bytes)));
});
