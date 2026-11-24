/* ocr-worker.test.mjs — the member's requirements (build/requirements/ocr-worker.md), each tested at the
 * member's interface and named by its id.
 *
 * TWO HALVES, ONE SUBJECT.
 *   Part A drives `makeMember` (`src/member.mjs`, the handler and the one-page pipeline, which import no engine)
 *   in node, through its `fetch`, with a recording `CAPTURES` and, where a step cannot be reached any other way,
 *   a stand-in renderer or engine. It reaches every refusal R7 orders — including the two the real renderer never
 *   produces (a container other than PNG, a PNG its reader refuses) — and proves what the member touches (R15,
 *   R16, R21) rather than what its source says.
 *   Part B boots the COMMITTED BUNDLE from its three upload parts under workerd (miniflare) with the real engine
 *   and the real renderer, over a real scanned page, and over broken installs (a wrong model, a wasm core that did
 *   not arrive compiled).
 *
 * IT DOES NOT MEASURE ACCURACY. The fidelity this member reports is CPDF-15's measurement (MEASUREMENTS.md
 * 2026-09-10), whose reach is ONE human-ground-truthed page, ONE engine version, ONE model. The text arms below are
 * PINS on that known page (the two strings CPDF-11 measured a generative model minting wrong on it), not a score.
 *
 * THE ONE EXPECTATION THAT DOES NOT COME FROM THE SUBJECT: `IND_UPRIGHT_SHA`, the page's samples as an
 * INDEPENDENT decoder produced them (Pillow/libtiff CCITT G4 through pypdf 6.14.2 / Pillow 11.3.0, 2026-08-08,
 * CPDF-12). If the fixture changes, it is re-derived from the independent decoder, never from a failing run.
 *
 * Run: node test/ocr-worker.test.mjs
 */
import "../../bio-plane/test/sandbox.mjs";  /* test-support: owns $TMPDIR, synchronous stdio */

import { Miniflare } from "miniflare";
import { renderedPage, pixelRefusal } from "../../pdf-worker/test/pdf-pixels-fixtures.mjs";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { deflateSync } from "node:zlib";
import { ocrWorkerDef, WASM, MODEL } from "./memberworker.mjs";
import { makeMember, NAMESPACES } from "../src/member.mjs";
import { MEASURED_BY, MAX_FRAME_BYTES, NAMESPACES as CONTRACT_NAMESPACES, PICTURE_MAX_EDGE, PLANE_OPS, REFUSALS, LEGIBLE_CONFIDENCE, LEGIBLE_NOTE_BELOW, LEGIBLE_REFUSE_BELOW, PAGE_SEG_MODES, declaredPictureFrame, psmFrom, sourceOfBytes } from "../src/contract.mjs";
import { PNG_REFUSALS, pngToSamples, samplesToRgba } from "../src/pngsamples.mjs";
import { createOCREngine as srcCreate } from "../src/tesslib.mjs";
import { readFrame } from "../src/frame.mjs";
import { generate } from "../../bio-plane/test/imggen.mjs";
import { renderPageToPixels } from "../../pdf-worker/src/pagepixels.mjs";
import { renderPictureToPixels as realRenderPicture } from "../../pdf-worker/src/picturepixels.mjs";
import { renderPictureToPixels } from "../../pdf-worker/src/picturepixels.mjs";
import { checkAnchor, checkConfidence } from "../../bio-plane/src/textchain.mjs";
import { BASIS_GRADES } from "../../bio-plane/src/record-grammar/index.mjs";
import { discoverMembers, verifyStatic } from "../../bio-plane/scripts/fleet-bundle.mjs";

const hex = (b) => createHash("sha256").update(b).digest("hex");
const F = (p) => new Uint8Array(readFileSync(fileURLToPath(new URL(p, import.meta.url))));

let pass = 0, fail = 0, footReached = false;
/* THE FOOT SENTINEL: a TypeError inside an assertion ends the module through no assertion at all; this prints a
   tally WITH a failure in that case, so silence never reads as green. */
process.on("exit", () => {
  if (!footReached) console.log(`\nocr-worker: ${pass} passed, ${fail + 1} failed — SUITE ENDED BEFORE ITS OWN FOOT`);
});
const t = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n         want ${JSON.stringify(want)}\n         got  ${JSON.stringify(got)}`}`);
  ok ? pass++ : fail++;
};
const keys = (o) => Object.keys(o || {}).sort();
/* Part B boots the COMMITTED bundle, which BOB rebuilds once after batch B (fix round 9): until then it is the bundle of
   the round's start, and after it the source's. What the rebuild adds to an answer (a PDF page's `legibility`, the
   image's `turned_deg`) is set aside where the committed answer is compared, so the arm reads the same either side of it;
   the new behaviour is tested over the source in Part A. */
const settled = (o) => { if (!o || typeof o !== "object") return o; const { turned_deg, ...rest } = o; return rest; };

/* Every wire answer this suite sees, for R20. */
const WIRE = [];

/* ============================================================================================================ *
 * Fixtures
 * ============================================================================================================ */

/* THE REAL PAGE: page 2 of Oakland Legistar attachment 15721260, the scanned council resolution CPDF-9
   ground-truthed and CPDF-15 measured this engine on (provenance, not behaviour: layers.md rule 6). */
const SCAN = F("../../pdf-worker/test/fixtures/scan-ccitt-g4-page.pdf");
const SCAN_SHA = hex(SCAN);
const IND_UPRIGHT_SHA = "ac4eb57f0f966f5d5b07eca8c97b065ab56746f32cfe33f3ba8b31cd1579efbc";
/* D-460's committed two-page fixture (a copy of the plane's `bio-plane/test/fixtures/d460/agenda-p2.pdf`): two image-only pages. */
const TWO_PAGE = F("./fixtures/agenda-two-scanned-pages.pdf");

function pdf(objs) {
  const chunks = [Buffer.from("%PDF-1.7\n", "latin1")];
  for (const o of objs) {
    chunks.push(Buffer.from(`${o.num} 0 obj\n`, "latin1"));
    if (o.stream) {
      chunks.push(Buffer.from(o.head + "\nstream\n", "latin1"), Buffer.from(o.stream),
                  Buffer.from("\nendstream\n", "latin1"));
    } else chunks.push(Buffer.from(o.body + "\n", "latin1"));
    chunks.push(Buffer.from("endobj\n", "latin1"));
  }
  chunks.push(Buffer.from("%%EOF\n", "latin1"));
  return new Uint8Array(Buffer.concat(chunks));
}
/** A one-page image-only PDF: one 1-bit FlateDecode image of the given size, filled from `fill(byteIndex)`. */
function bilevelPagePdf(width, height, fill, rotate = 0) {
  const raw = Buffer.alloc(Math.ceil(width / 8) * height);
  for (let i = 0; i < raw.length; i++) raw[i] = fill(i);
  const data = deflateSync(raw);
  const content = Buffer.from(`q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q`, "latin1");
  return pdf([
    { num: 1, body: "<< /Type /Catalog /Pages 2 0 R >>" },
    { num: 2, body: "<< /Type /Pages /Kids [3 0 R] /Count 1 >>" },
    { num: 3, body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] ${rotate ? `/Rotate ${rotate} ` : ""}`
                  + `/Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>` },
    { num: 4, head: `<< /Length ${content.length} >>`, stream: content },
    { num: 5, head: `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} `
                  + `/ColorSpace /DeviceGray /BitsPerComponent 1 /Filter /FlateDecode /Length ${data.length} >>`,
      stream: data },
  ]);
}
/** A one-page PDF with a real text layer and no image. */
function textPagePdf() {
  const content = Buffer.from("BT /F1 12 Tf 72 700 Td (Hello) Tj ET", "latin1");
  return pdf([
    { num: 1, body: "<< /Type /Catalog /Pages 2 0 R >>" },
    { num: 2, body: "<< /Type /Pages /Kids [3 0 R] /Count 1 >>" },
    { num: 3, body: "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
                  + "/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>" },
    { num: 4, head: `<< /Length ${content.length} >>`, stream: content },
    { num: 5, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>" },
  ]);
}
function lcg(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) >>> 24; }

const BLANK = bilevelPagePdf(1200, 1600, () => 0xff);
const NOISE = (() => { const r = lcg(11); return bilevelPagePdf(1200, 1600, () => r()); })();
/* 5000 x 5000 is a 100,000,000 B RGBA frame, past the 75.7 MB frame CPDF-15 measured being KILLED. A real,
   decodable page: a refusal that fired because the renderer failed would prove nothing about the bound. */
const HUGE = bilevelPagePdf(5000, 5000, () => 0xff);
const TEXTY = textPagePdf();
const NOT_PDF = new TextEncoder().encode("this is not a PDF at all, just bytes in the bucket");

/* R23's photographs: a printed sentence photographed (a JPEG) and the same frame as a PNG, generated once with
   Pillow (a sentence in two lines, lit unevenly, noisy, turned 1.2 degrees, softened); the words are what the
   test expects the engine to read back, not what it was shown. */
const PHOTO_JPG = F("./fixtures/photo-printed-sentence.jpg");
const PHOTO_PNG = F("./fixtures/photo-printed-sentence.png");
const PHOTO_WORDS = ["council", "approved", "budget", "Tuesday", "evening"];

/* ---- a PNG writer, for the stand-in renderer: every shape the member's reader accepts or refuses ---------- */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0); out.write(type, 4, "latin1"); Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
/** `rows` is an array of scanlines WITHOUT filter bytes; `filter` is the byte each is written with. */
function png({ width, height, bitDepth = 8, colorType = 0, interlace = 0, rows, filter = 0, idat = true,
               ihdr = true, truncate = false }) {
  const head = Buffer.alloc(13);
  head.writeUInt32BE(width, 0); head.writeUInt32BE(height, 4);
  head[8] = bitDepth; head[9] = colorType; head[10] = 0; head[11] = 0; head[12] = interlace;
  const raw = Buffer.concat(rows.map((r) => Buffer.concat([Buffer.from([filter]), Buffer.from(r)])));
  const parts = [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])];
  if (ihdr) parts.push(chunk("IHDR", head));
  if (idat) parts.push(chunk("IDAT", deflateSync(raw)));
  parts.push(chunk("IEND", Buffer.alloc(0)));
  const all = Buffer.concat(parts);
  return new Uint8Array(truncate ? all.subarray(0, all.length - 20) : all);
}
const GREY4x3 = png({ width: 4, height: 3, rows: [[0, 64, 128, 255], [1, 2, 3, 4], [9, 8, 7, 6]] });
const RGB2x2 = png({ width: 2, height: 2, colorType: 2, rows: [[1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12]] });
const BILEVEL9x2 = png({ width: 9, height: 2, bitDepth: 1, rows: [[0b10110000, 0b10000000], [0xff, 0x00]] });

/** An RGBA frame `{rgba, width, height}` turned clockwise by 90, 180 or 270 degrees (pdf-pixels R48's convention). */
const turnRgba = ({ rgba, width: w, height: h }, deg) => {
  const [W, H] = deg % 180 ? [h, w] : [w, h];
  const out = new Uint8Array(W * H * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [nx, ny] = deg === 90 ? [h - 1 - y, x] : deg === 180 ? [w - 1 - x, h - 1 - y] : deg === 270 ? [y, w - 1 - x] : [x, y];
    const a = (y * w + x) * 4, b = (ny * W + nx) * 4;
    out[b] = rgba[a]; out[b + 1] = rgba[a + 1]; out[b + 2] = rgba[a + 2]; out[b + 3] = 255;
  }
  return { rgba: out, width: W, height: H };
};

/** pdf-pixels R47 (job 14, unmerged when this was written) as a minimal local implementation: a renderer that takes a source
 *  `{size, readRange}` in place of bytes, over a renderer that takes the bytes. It reads the whole object, so it proves the
 *  member's logic over the real renderer, not R47; the seam test (A24) is the real renderers asked a source. */
const viaBytes = (render) => async (input, page, opts) => render(input instanceof Uint8Array ? input : await input.readRange(0, input.size), page, opts);

/** THE REAL ENGINE, as the committed source drives it: `frame.mjs`'s reading over `tesslib.mjs` and the committed core and
 *  model, compiled here as the platform compiles them at upload. `reads` counts the frames it was given. */
const wasmCore = await WebAssembly.compile(readFileSync(WASM));
const modelBytes = readFileSync(MODEL);
const srcEngine = { name: "tesseract-wasm", version: "0.11.0", model: "tessdata_fast/eng", reads: 0, check: () => null,
  transcribeFrame(rgba, width, height, opts) {
    srcEngine.reads++;
    return readFrame(() => srcCreate({ instantiateWasm: (info, receive) => { const i = new WebAssembly.Instance(wasmCore, info); receive(i, wasmCore); return i.exports; }, locateFile: (p) => p }),
                     modelBytes, rgba, width, height, opts);
  } };

/* ============================================================================================================ *
 * Part A — the member's code in node: `makeMember`, a recording bucket, stand-ins where a step needs one
 * ============================================================================================================ */

const REAL_ENGINE_NAMES = { name: "tesseract-wasm", version: "0.11.0", model: "tessdata_fast/eng" };

// fixtures-own: harness the engine seam of this member's own makeMember (src/member.mjs takes the engine as an argument); a scripted engine is how a test reaches a step no real page reaches
/** A stand-in engine. `regions` is what `transcribeFrame` answers; `calls` records every frame it was given. */
function stubEngine({ regions = [], check = null, frame = null, boxCount, words, orientation = { rotation: 0 } } = {}) {
  const e = { ...REAL_ENGINE_NAMES, calls: [], checks: 0 };
  e.check = () => { e.checks++; return check; };
  e.transcribeFrame = async (rgba, width, height, opts) => {
    e.calls.push({ length: rgba.length, width, height, rgba: Array.from(rgba.slice(0, 128)), opts });
    if (frame) return frame(rgba, width, height, opts);
    /* the engine's words (R25): each word of a region at its line's rating, unless the test names them */
    const ws = words ?? regions.flatMap((r) => String(r.text).trim().split(/\s+/).filter(Boolean).map(() => ({ confidence: r.confidence })));
    return { ok: true, regions, grain: "line", boxCount: boxCount ?? regions.length, words: ws,
             orientation: typeof orientation === "function" ? orientation(rgba, width, height, opts) : orientation };
  };
  return e;
}
// fixtures-own: harness a spy on the renderer seam of this member's own makeMember; the answers it serves are pdf-pixels' published fixture (RENDERED, pixelRefusal)
/** A stand-in renderer answering `answer` (a function of the page, or a value), recording every call. */
function stubRender(answer) {
  const r = async (bytes, page, opts) => { r.calls.push({ page, opts, bytes: bytes.length ?? bytes.size });
    return typeof answer === "function" ? answer(page, opts, bytes) : answer; };
  r.calls = [];
  return r;
}
/* pdf-pixels' real answer for a rendered page (its published fixture), the frame and the digest being the case's own */
const RENDERED = await renderedPage("pdf");
const pngPage = (bytes, width, height, extra = {}) => ({
  ...RENDERED, bytes, width, height, pixels_sha256: "f".repeat(64), ...extra });

/** A bucket that records every property touched on it, and answers `.get` from `objects`. */
function recordingBucket(objects = new Map()) {
  const log = [];
  const target = {
    get: async (key, opts) => { log.push(["get", key, opts && opts.range ? { ...opts.range } : null]); const b = objects.get(key);
      if (!b) return null;
      const r = opts && opts.range;
      if (r && (b.length === 0 || r.offset >= b.length || !(r.length > 0))) throw new Error("get: The requested range is not satisfiable (10039)");
      const part = r ? b.subarray(r.offset, Math.min(b.length, r.offset + r.length)) : b;
      return { size: b.length, arrayBuffer: async () => part.slice().buffer }; },
  };
  const proxy = new Proxy(target, { get(o, p) { log.push(["touch", String(p)]); return o[p]; } });
  return { proxy, log, objects };
}
const DOC = new Uint8Array([37, 80, 68, 70, 45]);   /* the bytes are opaque to the member: the renderer reads them */
const DOC_SHA = hex(DOC);

/** POST a body to a member made over `engine` and `render`, in `env`; returns {status, body}. */
async function post(member, env, body, path = "/transcribe") {
  const r = await member.fetch(new Request(`http://ocr-worker${path}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body) }), env);
  const out = { status: r.status, body: await r.json() };
  WIRE.push(out.body);
  return out;
}
function world({ engine = stubEngine({ regions: [{ text: "a line", rect: [0, 0, 2, 1], confidence: 0.9 }] }),
                 render = stubRender(pngPage(GREY4x3, 4, 3)), renderPicture = stubRender(pngPage(GREY4x3, 4, 3, { route: "decoded-picture" })),
                 doc = DOC, env = {} } = {}) {
  const sha = hex(doc);
  const bucket = recordingBucket(new Map([[`scratch/captures/${sha}`, doc], [`bio/captures/${sha}`, doc]]));
  const member = makeMember(engine, { render, renderPicture });
  return { engine, render, renderPicture, sha, bucket, member, env: { CAPTURES: bucket.proxy, VERSION: "stub-build", ...env },
           ask: (body, path) => post(member, { CAPTURES: bucket.proxy, VERSION: "stub-build", ...env }, body, path) };
}
const good = (over = {}) => ({ capture_sha: DOC_SHA, store: "scratch", pages: [0], ...over });

/* R21's fence: no network call of any kind while the member runs. */
const realFetch = globalThis.fetch;
const netCalls = [];
globalThis.fetch = async (...a) => { netCalls.push(String(a[0])); throw new Error("no network in this suite"); };

try {

console.log("\n--- A1 · R1: capture_sha — 64 hex, case-insensitive, checked before the store and the pages ---");
{
  const w = world();
  for (const [label, sha] of [["absent", undefined], ["63 hex", "a".repeat(63)], ["65 hex", "a".repeat(65)],
                              ["not hex", "g".repeat(64)], ["a number", 7], ["null", null], ["an array", ["a"]]]) {
    const r = await w.ask({ capture_sha: sha, store: "scratch", pages: [0] });
    t(`R1 capture_sha ${label} -> 400 BAD_SHA`, [r.status, r.body.ok, r.body.reason], [400, false, "BAD_SHA"]);
  }
  const notJson = await w.ask("{not json");
  t("R1 a body that is not JSON -> 400 BAD_SHA", [notJson.status, notJson.body.reason], [400, "BAD_SHA"]);
  const first = await w.ask({ capture_sha: "nope", store: 7 });
  t("R1 BAD_SHA is checked BEFORE the store and the pages (bad store, no pages still reads BAD_SHA)",
    [first.status, first.body.reason], [400, "BAD_SHA"]);
  t("R1 and nothing was read for any of them", w.bucket.log.filter(([k]) => k === "get"), []);
  const upper = await w.ask(good({ capture_sha: DOC_SHA.toUpperCase() }));
  t("R1 an UPPER-CASE sha is accepted and normalised to lower case before use",
    [upper.status, upper.body.ok, w.bucket.log.filter(([k]) => k === "get").map(([, key]) => key)],
    [200, true, [`scratch/captures/${DOC_SHA}`]]);
}

console.log("\n--- A2 · R2, R3, R16: the store is named, and it is exactly `bio` or `scratch` ---");
{
  const w = world();
  for (const [label, store] of [["absent", undefined], ["a number", 7], ["null", null], ["an object", {}],
                                ["an array", ["bio"]], ["a boolean", true]]) {
    const r = await w.ask({ capture_sha: DOC_SHA, store, pages: [0] });
    t(`R2 store ${label} -> 400 BAD_STORE`, [r.status, r.body.ok, r.body.reason], [400, false, "BAD_STORE"]);
  }
  const noPages = await w.ask({ capture_sha: DOC_SHA });
  t("R2 BAD_STORE is answered before the pages are looked at", noPages.body.reason, "BAD_STORE");

  /* R3/R16: the unknown names are driven with bytes sitting under that exact key, so a member that spent the name
     on R2 would find them. The recording bucket shows it never asked. */
  for (const name of ["biosmoke", "Scratch", "BIO", "bio ", " scratch", "bio_smoke", "biosmoke-fleet", "", "not a token"])
    w.bucket.objects.set(`${name}/captures/${DOC_SHA}`, DOC);
  const before = w.bucket.log.length;
  for (const name of ["biosmoke", "Scratch", "BIO", "bio ", " scratch", "bio_smoke", "biosmoke-fleet", "", "not a token"]) {
    const r = await w.ask({ capture_sha: DOC_SHA, store: name, pages: [0] });
    t(`R3 R16 store ${JSON.stringify(name)} -> 400 NAMESPACE_UNKNOWN, asked and namespaces named`,
      [r.status, r.body.ok, r.body.reason, r.body.asked, r.body.namespaces],
      [400, false, "NAMESPACE_UNKNOWN", name, ["bio", "scratch"]]);
  }
  t("R3 R16 and the bucket was never addressed for any of them, though bytes sit under each key",
    w.bucket.log.slice(before).filter(([k]) => k === "get"), []);
  const long = await w.ask({ capture_sha: DOC_SHA, store: "x".repeat(200), pages: [0] });
  t("R3 `asked` is truncated to 80 characters", [long.body.reason, long.body.asked], ["NAMESPACE_UNKNOWN", "x".repeat(80)]);
  const unknown = await w.ask({ capture_sha: DOC_SHA, store: "biosmoke", pages: [0] });
  t("R3 R5 the detail says which fact this is — not NOT_FOUND",
    [/NOT_FOUND/.test(unknown.body.detail), unknown.body.detail === REFUSALS.NAMESPACE_UNKNOWN], [true, true]);
  for (const name of ["bio", "scratch"]) {
    const r = await w.ask({ capture_sha: DOC_SHA, store: name, pages: [0] });
    t(`R16 the namespace \`${name}\` exists and is read`, [r.status, r.body.ok], [200, true]);
  }
  t("R16 the member's set is exactly the two names, frozen", [[...NAMESPACES], Object.isFrozen(NAMESPACES)],
    [["bio", "scratch"], true]);

  /* THE COPY AGES, and the check that it has not is control-plane's (layer 11, N402): this layer-1 member cannot
     import the plane, so it EXPORTS its set from the engine-free contract and the plane pins it against its own
     namespace gate. Here: the set on the wire is the exported set, and the member's own module states the same. */
  t("R16 R22 the set this member refuses with EQUALS the exported, frozen contract set",
    [unknown.body.namespaces, [...CONTRACT_NAMESPACES], Object.isFrozen(CONTRACT_NAMESPACES), NAMESPACES === CONTRACT_NAMESPACES],
    [["bio", "scratch"], ["bio", "scratch"], true, true]);
}

console.log("\n--- A3 · R4, R6: pages — a non-empty array; ONE page per call, the lowest; the rest deferred ---");
{
  const w = world();
  for (const [label, pages] of [["absent", undefined], ["empty", []], ["a number", 0], ["a string", "0"],
                                ["an object", { 0: 0 }], ["null", null]]) {
    const r = await w.ask(good({ pages }));
    t(`R4 pages ${label} -> 400 BAD_PAGES`, [r.status, r.body.ok, r.body.reason], [400, false, "BAD_PAGES"]);
  }
  const none = await w.ask(good({ pages: [-1, 1.5, "0", null, NaN, {}] }));
  t("R4 R6 a non-empty array naming no non-negative integer -> 400 BAD_PAGES, the same way",
    [none.status, none.body.ok, none.body.reason], [400, false, "BAD_PAGES"]);
  t("R6 and no page was rendered for it", w.render.calls.length, 0);

  const many = await w.ask(good({ pages: [9, 5, 2, 2, -1, 1.5, "3", 5, 12] }));
  t("R6 exactly ONE page is transcribed: the lowest distinct non-negative integer",
    [many.body.ok, many.body.pages.map((p) => p.page), w.render.calls.map((c) => c.page)], [true, [2], [2]]);
  t("R6 the rest of the distinct integers, ascending, are `deferred` and not attempted", many.body.deferred, [5, 9, 12]);
  t("R6 `notes` says why: one page per invocation, the measured memory bound, whole-document unmeasured",
    [many.body.notes.some((n) => /ONE PAGE PER INVOCATION/.test(n) && /61\.3 MB/.test(n) && /75\.7 MB frame is killed/.test(n)
                                && /UNMEASURED/.test(n) && /\(5, 9, 12\)/.test(n))], [true]);
  const one = await w.ask(good({ pages: [4, 4] }));
  t("R6 nothing deferred -> `deferred` is empty and no deferral note is written",
    [one.body.deferred, one.body.notes.some((n) => /ONE PAGE PER INVOCATION/.test(n))], [[], false]);

  const wr = world({ render: stubRender({ ok: false, reason: "NO_SUCH_PAGE", pageCount: 1 }) });
  const refused = await wr.ask(good({ pages: [7, 3] }));
  t("R6 a refused page still names what it deferred, with the note",
    [refused.body.ok, refused.body.page, refused.body.deferred, refused.body.notes.some((n) => /ONE PAGE PER INVOCATION/.test(n))],
    [false, 3, [7], true]);
}

console.log("\n--- A4 · R5: the binding, the key, and a capture genuinely absent ---");
{
  const w = world();
  let bodyRead = false;
  const req = { method: "POST", url: "http://ocr-worker/transcribe", json: async () => { bodyRead = true; return good(); } };
  for (const [label, env] of [["no CAPTURES", {}], ["CAPTURES without get", { CAPTURES: {} }],
                              ["CAPTURES.get not a function", { CAPTURES: { get: "yes" } }], ["no env at all", undefined]]) {
    const r = await w.member.fetch(req, env);
    const body = await r.json(); WIRE.push(body);
    t(`R5 ${label} -> 503 R2_NOT_CONFIGURED`, [r.status, body.ok, body.reason], [503, false, "R2_NOT_CONFIGURED"]);
  }
  t("R5 and the body was never read", bodyRead, false);
  const bareBad = await w.member.fetch(new Request("http://ocr-worker/", { method: "POST", body: "{" }), {});
  t("R5 checked before the body even on a body that would not parse", bareBad.status, 503);

  const missing = "0".repeat(64);
  const absent = await w.ask(good({ capture_sha: missing }));
  t("R5 a capture not in the store -> 404 NOT_FOUND naming capture_sha and store",
    [absent.status, absent.body.ok, absent.body.reason, absent.body.capture_sha, absent.body.store],
    [404, false, "NOT_FOUND", missing, "scratch"]);
  t("R5 the bytes are read at `${store}/captures/${sha}`",
    w.bucket.log.filter(([k]) => k === "get").map(([, key]) => key), [`scratch/captures/${missing}`]);
  const bio = await w.ask(good({ store: "bio" }));
  t("R5 in either namespace", [bio.status, w.bucket.log.filter(([k]) => k === "get").pop()[1]],
    [200, `bio/captures/${DOC_SHA}`]);
}

console.log("\n--- A5 · R7: the page's refusals, in their order, every one 200 ok:false ---");
{
  /* 1 · ENGINE_ABSENT, before any bytes are touched: the renderer is never called. */
  const w1 = world({ engine: stubEngine({ check: "the wasm core did not arrive" }),
                     render: stubRender({ ok: false, reason: "NOT_A_PDF" }) });
  const r1 = await w1.ask(good());
  t("R7.1 ENGINE_ABSENT is answered 200 ok:false, with the engine's reason",
    [r1.status, r1.body.ok, r1.body.reason, r1.body.refusal.why], [200, false, "ENGINE_ABSENT", "the wasm core did not arrive"]);
  t("R7.1 checked before any bytes are touched: the page was never rendered", w1.render.calls.length, 0);

  /* 2 · PAGE_NOT_RENDERABLE forwards the renderer's own reason, whatever it is. */
  for (const reason of ["PAGE_HAS_TEXT_LAYER", "MULTIPLE_IMAGES_ON_PAGE", "UNSUPPORTED_FILTER", "A_REASON_NOBODY_DECLARED"]) {
    const w = world({ render: stubRender({ ok: false, reason, imageCount: 3 }) });
    const r = await w.ask(good());
    t(`R7.2 the renderer's ${reason} -> 200 PAGE_NOT_RENDERABLE carrying that reason verbatim`,
      [r.status, r.body.ok, r.body.reason, r.body.refusal.render.reason, r.body.refusal.render.detail.imageCount],
      [200, false, "PAGE_NOT_RENDERABLE", reason, 3]);
    t(`R7.2 R30 the member asked the renderer to decode DCT and to render a page that shows text (${reason})`, w.render.calls[0].opts, { decodeDct: true, allowTextPage: true });
  }
  const wNull = world({ render: stubRender(null) });
  const rNull = await wNull.ask(good());
  t("R7.2 a renderer answering nothing is PAGE_NOT_RENDERABLE too", [rNull.body.reason, rNull.body.refusal.render], ["PAGE_NOT_RENDERABLE", null]);

  /* 3 · a container that is not PNG — even at a size over the bound: the container is judged first. */
  const w3 = world({ render: stubRender(pngPage(new Uint8Array([0xff, 0xd8, 0xff]), 5000, 5000,
                                                 { mediaType: "image/jpeg", route: "passthrough-dct" })) });
  const r3 = await w3.ask(good());
  t("R7.3 a container other than image/png -> 200 PIXELS_UNREADABLE, even when its frame is over the bound",
    [r3.status, r3.body.ok, r3.body.reason, r3.body.refusal.mediaType], [200, false, "PIXELS_UNREADABLE", "image/jpeg"]);
  t("R7.3 and the engine never ran", w3.engine.calls.length, 0);

  /* 4 · the frame bound, checked once the container passed and before the PNG is read. 5000 x 3065 x 4 is the
     bound exactly; one more row is over it. The bytes are NOT a PNG, so an over-bound page that reached the reader
     would say PIXELS_UNREADABLE instead. */
  t("R7.4 the bound is the largest frame CPDF-15 measured completing", MAX_FRAME_BYTES, 61_300_000);
  const w4 = world({ render: stubRender(pngPage(new Uint8Array([1, 2, 3]), 5000, 3066)) });
  const r4 = await w4.ask(good());
  t("R7.4 a frame one row over the bound -> 200 FRAME_OVER_MEASURED_BOUND, before its (unreadable) PNG is read",
    [r4.status, r4.body.ok, r4.body.reason], [200, false, "FRAME_OVER_MEASURED_BOUND"]);
  t("R7.4 the refusal names width, height, frame_bytes and bound_bytes",
    [r4.body.refusal.width, r4.body.refusal.height, r4.body.refusal.frame_bytes, r4.body.refusal.bound_bytes],
    [5000, 3066, 5000 * 3066 * 4, 61_300_000]);
  t("R7.4 and states a workload size, never a share of 128 MB",
    [/NOT a share of any ceiling/.test(r4.body.refusal.why), /128/.test(r4.body.refusal.why)], [true, false]);
  const w4b = world({ render: stubRender(pngPage(new Uint8Array([1, 2, 3]), 5000, 3065)) });
  const r4b = await w4b.ask(good());
  t("R7.4 a frame EXACTLY at the bound is not refused by it (it reaches the PNG reader, step 5)",
    r4b.body.reason, "PIXELS_UNREADABLE");

  /* 5 · a PNG the member's reader refuses, every shape. */
  const bad = [
    ["not a PNG at all", new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]), "NOT_A_PNG"],
    ["interlaced", png({ width: 4, height: 3, interlace: 1, rows: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]] }), "PNG_INTERLACED"],
    ["RGBA (colour type 6)", png({ width: 1, height: 1, colorType: 6, rows: [[1, 2, 3, 4]] }), "PNG_UNSUPPORTED_SHAPE"],
    ["16-bit grey", png({ width: 1, height: 1, bitDepth: 16, rows: [[1, 2]] }), "PNG_UNSUPPORTED_SHAPE"],
    ["1-bit RGB", png({ width: 8, height: 1, bitDepth: 1, colorType: 2, rows: [[0]] }), "PNG_UNSUPPORTED_SHAPE"],
    ["a scanline filter other than 0", png({ width: 4, height: 3, filter: 1, rows: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]] }), "PNG_FILTER_UNSUPPORTED"],
    ["a truncated chunk", png({ width: 4, height: 3, rows: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], truncate: true }), "PNG_TRUNCATED"],
    ["no IHDR", png({ width: 4, height: 3, ihdr: false, rows: [[0, 0, 0, 0]] }), "PNG_NO_IHDR"],
    ["no IDAT", png({ width: 4, height: 3, idat: false, rows: [] }), "PNG_NO_IDAT"],
    ["a raster shorter than its header", png({ width: 4, height: 3, rows: [[0, 0, 0, 0]] }), "PNG_SHORT_RASTER"],
  ];
  for (const [label, bytes, why] of bad) {
    const w = world({ render: stubRender(pngPage(bytes, 4, 3)) });
    const r = await w.ask(good());
    t(`R7.5 a PNG that is ${label} -> 200 PIXELS_UNREADABLE (${why}), and the engine never ran`,
      [r.status, r.body.ok, r.body.reason, r.body.refusal.png?.reason, w.engine.calls.length],
      [200, false, "PIXELS_UNREADABLE", why, 0]);
  }

  /* 6 · the engine refused, or threw. */
  const w6 = world({ engine: stubEngine({ frame: () => ({ ok: false, error: "loadImage refused", name: "RangeError" }) }) });
  const r6 = await w6.ask(good());
  t("R7.6 the engine refused -> 200 ENGINE_FAILED with its own error name and message",
    [r6.status, r6.body.ok, r6.body.reason, r6.body.refusal.engine_error_name, r6.body.refusal.engine_error],
    [200, false, "ENGINE_FAILED", "RangeError", "loadImage refused"]);
  const w6b = world({ engine: stubEngine({ frame: () => { throw new TypeError("wasm trap"); } }) });
  const r6b = await w6b.ask(good());
  t("R7.6 the engine threw -> the same 200 ENGINE_FAILED, never a 500",
    [r6b.status, r6b.body.reason, r6b.body.refusal.engine_error_name, r6b.body.refusal.engine_error],
    [200, "ENGINE_FAILED", "TypeError", "wasm trap"]);

  /* 7 · nothing anchorable came back. */
  const w7 = world({ engine: stubEngine({ regions: [{ text: "", rect: [0, 0, 1, 1], confidence: 0.9 },
                                                    { text: "  \n", rect: [0, 0, 1, 1] },
                                                    { text: "word", rect: [0, 0, NaN, 1] }] }) });
  const r7 = await w7.ask(good());
  t("R7.7 no region with both text and a finite rectangle -> 200 NOTHING_TRANSCRIBED, naming the boxes",
    [r7.status, r7.body.ok, r7.body.reason, r7.body.refusal.boxes, r7.body.refusal.blank, r7.body.refusal.unanchored],
    [200, false, "NOTHING_TRANSCRIBED", 3, 2, 1]);
  const w7b = world({ engine: stubEngine({ regions: [] }) });
  const r7b = await w7b.ask(good());
  t("R7.7 an engine that boxed nothing at all is the same finding", [r7b.status, r7b.body.reason, r7b.body.refusal.boxes],
    [200, "NOTHING_TRANSCRIBED", 0]);
  t("R7 every refusal reason this member emits is declared in its refusal table",
    ["ENGINE_ABSENT", "PAGE_NOT_RENDERABLE", "PIXELS_UNREADABLE", "FRAME_OVER_MEASURED_BOUND", "ENGINE_FAILED",
     "NOTHING_TRANSCRIBED", "BAD_SHA", "BAD_STORE", "NAMESPACE_UNKNOWN", "BAD_PAGES", "NOT_FOUND", "R2_NOT_CONFIGURED"]
      .filter((k) => !(k in REFUSALS)), []);
}

console.log("\n--- A6 · R8, R9, R10, R17, R18: the successful answer, its regions, and what is dropped ---");
{
  const regions = [
    { text: "  lowest respon-", rect: [10, 20, 300, 40], confidence: 0.91 },
    { text: "sible\tbidder  ", rect: [10.5, 41, 280.25, 60], confidence: 0 },
    { text: "teh $50,000", rect: [1, 2, 3, 4], confidence: 1 },
    { text: "unrated", rect: [0, 0, 1, 1], confidence: null },
    { text: "over", rect: [0, 0, 1, 1], confidence: 1.01 },
    { text: "under", rect: [0, 0, 1, 1], confidence: -0.01 },
    { text: "nan", rect: [0, 0, 1, 1], confidence: NaN },
    { text: "string", rect: [0, 0, 1, 1], confidence: "0.9" },
    { text: "object", rect: [0, 0, 1, 1], confidence: { value: 0.9, basis: "self_reported" } },
    { text: "", rect: [0, 0, 1, 1], confidence: 0.9 },
    { text: "   ", rect: [0, 0, 1, 1] },
    { text: null, rect: [0, 0, 1, 1] },
    { text: "no rect" },
    { text: "short rect", rect: [0, 0, 1] },
    { text: "infinite", rect: [0, 0, Infinity, 1] },
    { text: "string coord", rect: [0, 0, "1", 1] },
    { text: "rect a string", rect: "0,0,1,1" },
  ];
  /* the engine rates every word it read at 0.9: the page is legible (R25), so what is under test is the regions */
  const w = world({ engine: stubEngine({ regions, words: Array.from({ length: 20 }, () => ({ confidence: 0.9 })) }),
                    render: stubRender((page) => pngPage(GREY4x3, 4, 3, { rotate_deg: 90, page })) });
  const { status, body } = await w.ask(good({ pages: [6, 8] }));
  t("R8 a successful answer is 200 ok:true", [status, body.ok], [200, true]);
  t("R8 it carries exactly the named fields",
    keys(body), ["cap", "confidence_floor", "deferred", "engine", "grain", "image", "legibility", "measured_by", "model", "notes", "ok", "pages", "version"]);
  t("R8 engine, version, model name the engine", [body.engine, body.version, body.model],
    ["tesseract-wasm", "0.11.0", "tessdata_fast/eng"]);
  t("R8 cap is the fixed letter C", body.cap, "C");
  /* PINNED BYTE FOR BYTE (the requirement's Suggestion): a rewritten measurement citation is a change, caught. */
  /* The citation is read through its key (K3810): the suite compares with the contract's constant, which is that key's
     text, and holds no copy of the sentence. */
  t("R8 measured_by is the one measurement's citation, read through its key", body.measured_by, MEASURED_BY);
  t("R8 grain is line; deferred as R6; notes an array", [body.grain, body.deferred, Array.isArray(body.notes)], ["line", [8], true]);
  t("R8 image carries exactly the rendered frame's facts",
    body.image, { width: 4, height: 3, frame_bytes: 48, route: RENDERED.route, upright: true, rotate_deg: 90, dpi: RENDERED.page_geometry.dpi,
                  pixels_sha256: "f".repeat(64), turned_deg: 0 });
  t("R8 pages is exactly one {page, regions}", [body.pages.length, keys(body.pages[0]), body.pages[0].page],
    [1, ["page", "regions"], 6]);
  t("R8 the engine was given the RGBA frame of the page, width*height*4",
    [w.engine.calls[0].width, w.engine.calls[0].height, w.engine.calls[0].length], [4, 3, 48]);
  t("R8 and that frame is the PNG's samples, grey spread to RGB, opaque",
    w.engine.calls[0].rgba.slice(0, 16), [0, 0, 0, 255, 64, 64, 64, 255, 128, 128, 128, 255, 255, 255, 255, 255]);

  const got = body.pages[0].regions;
  t("R10 regions with blank text or no four finite numbers are dropped: only the anchorable nine remain",
    got.map((r) => r.text), ["  lowest respon-", "sible\tbidder  ", "teh $50,000", "unrated", "over", "under", "nan", "string", "object"]);
  t("R10 the dropped are COUNTED on the wire, never kept as text with no anchor",
    body.notes.some((n) => /^5 region\(s\) the engine returned carried no usable rectangle/.test(n)), true);
  t("R18 the text is exactly what the decoder decoded: no joining, no trimming, no correction",
    got.slice(0, 3).map((r) => r.text), ["  lowest respon-", "sible\tbidder  ", "teh $50,000"]);
  t("R9 every region carries exactly text, source, confidence", [...new Set(got.map((r) => keys(r).join()))],
    ["confidence,source,text"]);
  t("R9 the source is a pdf-page anchor in image pixels, with the image it indexes",
    got[1].source, { kind: "pdf-page", ref: "p6", page: 6, rect: [10.5, 41, 280.25, 60], space: "image-px",
                     image: { width: 4, height: 3, route: RENDERED.route, upright: true, rotate_deg: 90,
                              pixels_sha256: "f".repeat(64) } });
  t("R9 the PLANE's own anchor check accepts every region", got.filter((r) => checkAnchor(r.source) != null).length, 0);
  t("R9 R17 an engine-rated value in 0..1 is carried unchanged, basis engine",
    got.slice(0, 3).map((r) => r.confidence), [{ value: 0.91, basis: "engine" }, { value: 0, basis: "engine" },
                                               { value: 1, basis: "engine" }]);
  t("R9 R17 anything else is the stated string none — never substituted, rescaled or invented",
    got.slice(3).map((r) => r.confidence), ["none", "none", "none", "none", "none", "none"]);
  t("R17 the only bases on the wire are engine and none",
    [...new Set(got.map((r) => (r.confidence === "none" ? "none" : r.confidence.basis)))].sort(), ["engine", "none"]);
  t("R9 R17 the PLANE's own confidence check accepts every region", got.filter((r) => checkConfidence(r.confidence) != null).length, 0);
  t("R17 the unrated are counted on the wire",
    body.notes.some((n) => /^6 region\(s\) came back with no engine-computed confidence/.test(n)), true);

  const clean = world();
  const c = await clean.ask(good());
  t("R8 notes is empty when there is nothing to say", c.body.notes, []);
  const rgb = world({ render: stubRender(pngPage(RGB2x2, 2, 2)) });
  await rgb.ask(good());
  t("R8 an RGB page reaches the engine as its own RGBA", rgb.engine.calls[0].rgba.slice(0, 16),
    [1, 2, 3, 255, 4, 5, 6, 255, 7, 8, 9, 255, 10, 11, 12, 255]);
  const bil = world({ render: stubRender(pngPage(BILEVEL9x2, 9, 2)) });
  await bil.ask(good());
  t("R8 a bilevel page reaches the engine as white (1) and black (0), padding bits unread",
    bil.engine.calls[0].rgba.filter((_, i) => i % 4 === 0).slice(0, 18), [255, 0, 255, 255, 0, 0, 0, 0, 255,
                                                                          255, 255, 255, 255, 255, 255, 255, 255, 0]);
}

console.log("\n--- A7 · R8: the confidence floor is the instance's, or a stated null ---");
{
  for (const [raw, want] of [[undefined, null], ["", null], ["0.5", 0.5], ["0", 0], ["1", 1], [0.25, 0.25],
                             ["1.5", null], ["-0.1", null], ["abc", null], ["NaN", null], [null, null]]) {
    const w = world({ env: { OCR_CONFIDENCE_FLOOR: raw } });
    const r = await w.ask(good());
    t(`R8 OCR_CONFIDENCE_FLOOR ${JSON.stringify(raw)} -> confidence_floor ${JSON.stringify(want)}`, r.body.confidence_floor, want);
  }
  const w = world({ env: { OCR_CONFIDENCE_FLOOR: "0.99" } });
  const r = await w.ask(good());
  t("R8 the member states the floor and never applies it: a region under it is still on the wire",
    [r.body.confidence_floor, r.body.pages[0].regions.map((x) => x.confidence.value)], [0.99, [0.9]]);
  const p = world({ env: { OCR_PSM: "6" } });
  await p.ask(good());
  t("R21 the instance's OCR_PSM is threaded to the engine as its segmentation mode", p.engine.calls[0].opts, { psm: "6" });
}

console.log("\n--- A8 · R11, R12, R13, R14: /version and every other route ---");
{
  const get = async (member, env, path, method = "GET") => {
    const r = await member.fetch(new Request(`http://ocr-worker${path}`, { method }), env);
    const body = await r.json(); WIRE.push(body); return { status: r.status, body };
  };
  const loaded = makeMember(stubEngine());
  const v = await get(loaded, { VERSION: "build-7" }, "/version");
  t("R11 R12 R13 GET /version answers exactly the named fields",
    [v.status, v.body], [200, { ok: true, name: "ocr-worker", version: "build-7", engine: "tesseract-wasm",
                                engine_version: "0.11.0", model: "tessdata_fast/eng", engine_loaded: true }]);
  t("R11 the version is the running build's env.VERSION, whatever it is",
    (await get(loaded, { VERSION: "another-build" }, "/version")).body.version, "another-build");
  const e = stubEngine({ check: "the language model is 12 B" });
  const broken = await get(makeMember(e), { VERSION: "b" }, "/version");
  t("R13 engine_loaded is asked: false, with engine_unavailable naming why",
    [broken.body.engine_loaded, broken.body.engine_unavailable, e.checks], [false, "the language model is 12 B", 1]);
  t("R13 a member without its engine answers every other route normally",
    (await post(makeMember(e), { CAPTURES: recordingBucket().proxy }, good({ capture_sha: "x" }))).body.reason, "BAD_SHA");
  for (const [method, path] of [["GET", "/transcribe"], ["POST", "/version"], ["PUT", "/transcribe"], ["GET", "/"],
                                ["DELETE", "/transcribe"], ["GET", "/other"], ["POST", "/transcribe/more"],
                                ["POST", "/Transcribe"], ["PATCH", "/"]]) {
    const r = await get(loaded, { CAPTURES: recordingBucket().proxy }, path, method);
    t(`R14 ${method} ${path} -> 404 UNKNOWN`, [r.status, r.body.ok, r.body.reason], [404, false, "UNKNOWN"]);
  }
  const w = world();
  const bare = await w.ask(good(), "/");
  t("R14 POST at the bare path IS transcribe, not unknown", [bare.status, bare.body.ok], [200, true]);
}

console.log("\n--- A9 · R15, R21: what the member touched — only CAPTURES.get, no network, no state ---");
{
  const w = world({ engine: stubEngine({ regions: [{ text: "x", rect: [0, 0, 1, 1], confidence: 0.9 }] }) });
  const a1 = await w.ask(good({ pages: [0, 3] }));
  const b = await w.ask(good({ capture_sha: "0".repeat(64) }));
  const a2 = await w.ask(good({ pages: [0, 3] }));
  t("R21 the same request answers the same bytes, whatever was asked in between", JSON.stringify(a2.body), JSON.stringify(a1.body));
  t("R21 R15 the only thing touched on CAPTURES was `get`", [...new Set(w.bucket.log.filter(([k]) => k === "touch").map(([, p]) => p))], ["get"]);
  t("R21 no network call was made by the member in all of Part A", netCalls, []);
  t("R15 and the stand-in bucket's contents are unchanged", [...w.bucket.objects.keys()].length, 2);
  /* The ops this member calls at the plane, declared for control-plane's pin (N402): none. It is called by the plane
     and reads only CAPTURES.get, so its declared set is empty — and frozen, so no caller can add one to it. */
  t("R22 R21 the member exports the plane ops it calls from its contract: none (PLANE_OPS is empty and frozen)",
    [Object.keys(PLANE_OPS), Object.isFrozen(PLANE_OPS)], [[], true]);
  void b;
}

console.log("\n--- A10 · R23: a JPEG or PNG capture is a one-page document, taken through the picture renderer ---");
{
  const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9]);
  const eng = () => stubEngine({ regions: [{ text: "a printed line", rect: [1, 1, 3, 2], confidence: 0.7 }] });
  const picRender = () => stubRender(pngPage(GREY4x3, 4, 3, { route: "decoded-picture", upright: true, rotate_deg: 0, page_geometry: undefined }));
  for (const [label, doc] of [["JPEG", JPG], ["PNG", PNG]]) {
    const w = world({ engine: eng(), doc, renderPicture: picRender() });
    const r = await w.ask({ capture_sha: w.sha, store: "scratch", pages: [0] });
    t(`R23 a ${label} capture, page 0: 200 ok:true, answered by the picture renderer and not the page renderer`,
      [r.status, r.body.ok, w.renderPicture.calls.length, w.render.calls.length], [200, true, 1, 0]);
    t(`R23 R24 the picture renderer is asked for page 0, a bounded long edge (${PICTURE_MAX_EDGE}), grey pixels, prepared`,
      w.renderPicture.calls[0], { page: 0, opts: { maxEdge: PICTURE_MAX_EDGE, grey: true, prepare: true }, bytes: doc.length });
    t(`R23 ${label}: the same fields R8 names, the frame's route stated, the text anchored to p0`,
      [keys(r.body), r.body.image.route, r.body.image.dpi, r.body.pages[0].page, r.body.pages[0].regions[0].text,
       r.body.pages[0].regions[0].source.ref, r.body.pages[0].regions[0].source.kind, r.body.cap],
      [["cap", "confidence_floor", "deferred", "engine", "grain", "image", "legibility", "measured_by", "model", "notes", "ok", "pages", "version"],
       "decoded-picture", null, 0, "a printed line", "p0", "pdf-page", "C"]);

    /* any other page: NO_SUCH_PAGE, naming it, before a pixel is made */
    for (const pg of [1, 7]) {
      const x = world({ engine: eng(), doc });
      const q = await x.ask({ capture_sha: x.sha, store: "scratch", pages: [pg] });
      t(`R23 ${label} page ${pg}: 200 NO_SUCH_PAGE naming it, nothing rendered, the engine never ran`,
        [q.status, q.body.ok, q.body.reason, q.body.page, q.body.refusal.page_count, x.renderPicture.calls.length, x.render.calls.length, x.engine.calls.length],
        [200, false, "NO_SUCH_PAGE", pg, 1, 0, 0, 0]);
    }
    const two = world({ engine: eng(), doc });
    const q2 = await two.ask({ capture_sha: two.sha, store: "scratch", pages: [1, 0] });
    t(`R23 ${label} pages [1,0]: page 0 is taken (R6) and page 1 stays deferred`,
      [q2.body.ok, q2.body.pages[0].page, q2.body.deferred], [true, 0, [1]]);
  }

  /* the renderer's refusal is forwarded as R7 step 2 does */
  const refusing = world({ doc: JPG, renderPicture: stubRender({ ok: false, reason: "IMAGE_TOO_LARGE", bound_name: "PICTURE_FRAME_MAX" }) });
  const rr = await refusing.ask({ capture_sha: refusing.sha, store: "scratch", pages: [0] });
  t("R23 R7.2 a picture the renderer refuses -> 200 PAGE_NOT_RENDERABLE carrying its reason verbatim",
    [rr.status, rr.body.ok, rr.body.reason, rr.body.refusal.render.reason, rr.body.refusal.render.detail.bound_name],
    [200, false, "PAGE_NOT_RENDERABLE", "IMAGE_TOO_LARGE", "PICTURE_FRAME_MAX"]);

  /* R7 is unchanged for a picture: engine first, then the bound, then the PNG reader */
  const noEngine = world({ engine: stubEngine({ check: "no engine" }), doc: JPG });
  const ne = await noEngine.ask({ capture_sha: noEngine.sha, store: "scratch", pages: [3] });
  t("R23 R7.1 the engine is checked first: ENGINE_ABSENT even for a page a picture does not have",
    [ne.body.reason, noEngine.renderPicture.calls.length], ["ENGINE_ABSENT", 0]);
  const big = world({ doc: JPG, renderPicture: stubRender(pngPage(new Uint8Array([1, 2, 3]), 5000, 3066, { route: "decoded-picture" })) });
  const bb = await big.ask({ capture_sha: big.sha, store: "scratch", pages: [0] });
  t("R23 R7.4 a picture frame over the measured bound is refused by its true reason, before its PNG is read",
    [bb.body.reason, bb.body.refusal.frame_bytes], ["FRAME_OVER_MEASURED_BOUND", 5000 * 3066 * 4]);

  /* controls: a PDF page and bytes that are neither */
  const pdfW = world();
  const pr = await pdfW.ask(good());
  t("R23 control: a PDF page is rendered by the page renderer, asked to decode DCT, and the picture renderer is never asked",
    [pr.body.ok, pdfW.render.calls.length, pdfW.render.calls[0].opts, pdfW.renderPicture.calls.length], [true, 1, { decodeDct: true, allowTextPage: true }, 0]);
  const neither = world({ doc: NOT_PDF, render: stubRender({ ok: false, reason: "NOT_A_PDF" }) });
  const nr = await neither.ask({ capture_sha: neither.sha, store: "scratch", pages: [0] });
  t("R23 control: bytes that are neither a picture nor a PDF are refused as today, by the page renderer",
    [nr.body.reason, nr.body.refusal.render.reason, neither.render.calls.length, neither.renderPicture.calls.length],
    ["PAGE_NOT_RENDERABLE", "NOT_A_PDF", 1, 0]);
  for (const [label, doc] of [["a lone 0xff 0xd8", new Uint8Array([0xff, 0xd8])], ["a PNG signature cut short", PNG.subarray(0, 7)]]) {
    const w = world({ doc, render: stubRender({ ok: false, reason: "NOT_A_PDF" }) });
    const q = await w.ask({ capture_sha: w.sha, store: "scratch", pages: [1] });
    t(`R23 control: ${label} is not a picture: the page renderer refuses it as today`,
      [q.body.reason, w.render.calls.length, w.renderPicture.calls.length], ["PAGE_NOT_RENDERABLE", 1, 0]);
  }
  t("R23 NO_SUCH_PAGE is a declared refusal of this member", typeof REFUSALS.NO_SUCH_PAGE, "string");
}

console.log("\n--- A11 · R24: a photographed page is prepared before the engine reads it ---");
{
  const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  const asked = async (renderPicture, engine = stubEngine({ regions: [{ text: "a printed line", rect: [1, 1, 3, 2], confidence: 0.7 }] })) => {
    const w = world({ doc: JPG, renderPicture, engine });
    return { w, r: await w.ask({ capture_sha: w.sha, store: "scratch", pages: [0] }) };
  };
  const found = (text_found) => stubRender(pngPage(GREY4x3, 4, 3, { route: "decoded-picture", prepared: { text_found, tilt_deg: 0, scale: 1, line_px: 40 } }));

  /* no text: not handed to the engine as text */
  const none = await asked(found(false));
  t("R24 a picture whose prepared answer says text_found false is answered NOTHING_TRANSCRIBED, and the engine never runs",
    [none.r.status, none.r.body.ok, none.r.body.reason, none.w.engine.calls.length], [200, false, "NOTHING_TRANSCRIBED", 0]);
  t("R24 the no-text answer counts nothing boxed, nothing blank and nothing unanchored",
    [none.r.body.refusal.boxes, none.r.body.refusal.blank, none.r.body.refusal.unanchored], [0, 0, 0]);
  t("R24 ocr-worker.member.the_picture_has_no_lines_of_text: the no-text answer says why, in a sentence",
    [none.r.body.notes.length, typeof none.r.body.notes[0], none.r.body.notes[0].trim().length > 0], [1, "string", true]);
  const some = await asked(found(true));
  t("R24 control: the same picture with text_found true is read by the engine",
    [some.r.body.ok, some.w.engine.calls.length], [true, 1]);
  const bare = await asked(stubRender(pngPage(GREY4x3, 4, 3, { route: "decoded-picture" })));
  t("R24 control: an answer with no prepared field (the old answer) is read by the engine",
    [bare.r.body.ok, bare.w.engine.calls.length], [true, 1]);

  /* the bound is judged on the prepared frame the renderer answers */
  const grown = await asked(stubRender(pngPage(new Uint8Array([1, 2, 3]), 5000, 3066, { route: "decoded-picture", prepared: { text_found: true, tilt_deg: 0, scale: 2.5, line_px: 40 } })));
  t("R24 R7.4 a prepared frame over the measured bound is refused by its true reason, on the prepared size",
    [grown.r.body.reason, grown.r.body.refusal.width, grown.r.body.refusal.height, grown.r.body.refusal.frame_bytes, grown.w.engine.calls.length],
    ["FRAME_OVER_MEASURED_BOUND", 5000, 3066, 5000 * 3066 * 4, 0]);
  const grownBlank = await asked(stubRender(pngPage(new Uint8Array([1, 2, 3]), 5000, 3066, { route: "decoded-picture", prepared: { text_found: false, tilt_deg: 0, scale: 1, line_px: 0 } })));
  t("R24 R7 the bound is checked before the no-text answer: a too-large frame is refused by its size",
    grownBlank.r.body.reason, "FRAME_OVER_MEASURED_BOUND");

  /* a PDF page is as before */
  const pdfW = world();
  const pr = await pdfW.ask(good());
  t("R24 control: a PDF page is rendered without prepare", [pr.body.ok, pdfW.render.calls[0].opts], [true, { decodeDct: true, allowTextPage: true }]);

  /* THE REAL PATH: the real picture renderer, the real engine (the member's own engine code, in node) */
  const realEngine = srcEngine;   /* the member's own engine code over the committed core and model (frame.mjs, tesslib.mjs) */
  /* the words each photograph holds: the page's own text, as drawn (`fixtures/page-words.json`) */
  const TRUTH = JSON.parse(Buffer.from(F("./fixtures/page-words.json")).toString("utf8"));
  const words = (x) => x.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
  const shareRead = (truth, got) => {
    const left = new Map();
    for (const w of words(got)) left.set(w, (left.get(w) || 0) + 1);
    const want = words(truth);
    let hit = 0;
    for (const w of want) if (left.get(w) > 0) { hit++; left.set(w, left.get(w) - 1); }
    return want.length ? hit / want.length : 0;
  };
  const unprepared = (bytes, page, opts) => realRenderPicture(bytes, page, { ...opts, prepare: false });
  const realWorld = (doc, renderPicture) => {
    const sha = hex(doc);
    const bucket = recordingBucket(new Map([[`scratch/captures/${sha}`, doc]]));
    const member = makeMember(realEngine, { renderPicture: viaBytes(renderPicture) });
    return post(member, { CAPTURES: bucket.proxy, VERSION: "stub-build" }, { capture_sha: sha, store: "scratch", pages: [0] });
  };
  const got = (a) => (a.body.ok ? a.body.pages[0].regions.map((r) => r.text).join(" ") : "");
  for (const name of ["page-noise-shade", "page-combined-a", "page-110dpi"]) {
    const doc = F(`./fixtures/${name}.jpg`);
    const prep = await realWorld(doc, realRenderPicture);
    const old = await realWorld(doc, unprepared);
    const gain = shareRead(TRUTH[name], got(prep)), was = shareRead(TRUTH[name], got(old));
    console.log(`        ${name}: prepared ${(gain * 100).toFixed(0)} %, unprepared ${(was * 100).toFixed(0)} %`);
    t(`R24 ${name}: the member reads at least 90 percent of the page's words from the prepared picture`, gain >= 0.9, true);
    /* the 110 dpi page is read whole either way by this engine (the renderer's floor is on the other fixtures); the
       control is on the two pages the old answer fails */
    if (name !== "page-110dpi")
      t(`R24 control: ${name} asked without prepare (the old answer) reads fewer of its words, under 90 percent`, [was < 0.9, was < gain], [true, true]);
    t(`R24 ${name}: the answer's image is the prepared frame (its own digest, not the unprepared one's)`,
      prep.body.image.pixels_sha256 !== (old.body.image && old.body.image.pixels_sha256) && prep.body.image.frame_bytes === prep.body.image.width * prep.body.image.height * 4, true);
  }
  /* C18 (T51 fix round 2): the walk's hard photograph, `page-hard` (a whole page, 231 words, 110 dpi, a 2.4 degree tilt,
     perspective, noise, blur 1.0), is read through the member's real path at least HARD_FLOOR of its words where the
     member asked without `prepare` reads under it; and what the member says of each picture (its legibility) is the
     share it truly read, within a tenth (never over it by more), so a picture it cannot read says so. `page-hard-blur` (smaller, blurrier) is
     beyond any preparation: its answer is the refusal, not a short text. */
  const HARD_FLOOR = 0.52;
  const hardP = await realWorld(F("./fixtures/page-hard.jpg"), realRenderPicture);
  const hardO = await realWorld(F("./fixtures/page-hard.jpg"), unprepared);
  const hardGain = shareRead(TRUTH["page-hard"], got(hardP)), hardWas = shareRead(TRUTH["page-hard"], got(hardO));
  console.log(`        page-hard: prepared ${(hardGain * 100).toFixed(0)} %, unprepared ${(hardWas * 100).toFixed(0)} %`);
  t(`R24 C18 page-hard: the member reads at least ${HARD_FLOOR * 100} percent of the page's words from the prepared picture`, hardGain >= HARD_FLOOR, true);
  t("R24 C18 control: page-hard asked without prepare (the old answer) reads under that floor", hardWas < HARD_FLOOR, true);
  for (const name of ["page-110dpi", "page-noise-shade", "page-combined-a", "page-hard"]) {
    const a = await realWorld(F(`./fixtures/${name}.jpg`), realRenderPicture);
    const truly = shareRead(TRUTH[name], got(a));
    t(`R25 ${name}: the legibility the member states (${a.body.legibility && a.body.legibility.share}) is the share truly read (${truly.toFixed(2)}), within a tenth`,
      Math.abs(a.body.legibility.share - truly) <= 0.1, true);
    t(`R25 ${name}: a share under LEGIBLE_NOTE_BELOW is said in a note, a share at or over it is not`,
      [a.body.legibility.share < LEGIBLE_NOTE_BELOW, a.body.notes.length > 0], [name === "page-hard", name === "page-hard"]);
  }
  const unclear = await realWorld(F("./fixtures/page-hard-blur.jpg"), realRenderPicture);
  t("R25 C18 page-hard-blur, which no preparation can read, is refused PICTURE_NOT_LEGIBLE with its figures, and no text is returned",
    [unclear.status, unclear.body.ok, unclear.body.reason, unclear.body.refusal.legibility.share < LEGIBLE_REFUSE_BELOW, unclear.body.pages],
    [200, false, "PICTURE_NOT_LEGIBLE", true, undefined]);
  const before = realEngine.reads;
  const blank = await realWorld(F("./fixtures/page-blank.jpg"), realRenderPicture);
  t("R24 the blank picture reads no words: NOTHING_TRANSCRIBED, and the real engine never ran",
    [blank.body.ok, blank.body.reason, realEngine.reads - before], [false, "NOTHING_TRANSCRIBED", 0]);
}

console.log("\n--- A12 · R25: a picture says how much of it the engine could read, and says so when it could not ---");
{
  const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  const line = (text, confidence) => ({ text, rect: [1, 1, 3, 2], confidence });
  const picRender = () => stubRender(pngPage(GREY4x3, 4, 3, { route: "decoded-picture", prepared: { text_found: true, tilt_deg: 0, scale: 1, line_px: 20 } }));
  const ask = async (regions, { doc = JPG, renderPicture = picRender(), words } = {}) => {
    const w = world({ doc, renderPicture, engine: stubEngine({ regions, words }) });
    return { w, r: await w.ask({ capture_sha: w.sha, store: "scratch", pages: [0] }) };
  };
  t("R25 the constants the requirement states: confident at 0.6, said under 0.8, refused under 0.2", [LEGIBLE_CONFIDENCE, LEGIBLE_NOTE_BELOW, LEGIBLE_REFUSE_BELOW], [0.6, 0.8, 0.2]);
  t("R25 PICTURE_NOT_LEGIBLE is a declared refusal of this member", typeof REFUSALS.PICTURE_NOT_LEGIBLE, "string");

  /* the figures: words, the words the engine rated at or over 0.6, their ratio; basis the engine's */
  const part = await ask([line("one two three four", 0.9), line("five six", 0.4)]);
  t("R25 a picture read in part states its words, its confident words and their share (the engine's own ratings)",
    [part.r.body.ok, part.r.body.legibility], [true, { words: 6, confident_words: 4, share: 0.67 }]);
  t("R25 a share under LEGIBLE_NOTE_BELOW is said in a note, and the text read is still answered whole",
    [part.r.body.notes.length, typeof part.r.body.notes[0], part.r.body.notes[0].trim().length > 0, part.r.body.pages[0].regions.map((x) => x.text)],
    [1, "string", true, ["one two three four", "five six"]]);
  const whole = await ask([line("one two three four", 0.9), line("five six", 0.6)]);
  t("R25 a word rated exactly 0.6 is confident; a picture read whole states share 1 and says nothing more",
    [whole.r.body.legibility, whole.r.body.notes], [{ words: 6, confident_words: 6, share: 1 }, []]);
  const at8 = await ask([line("a b c d", 0.9), line("e f g h", 0.9), line("i j", 0.1), line("k l", 0.1)]);
  t("R25 8 of 12 words is under the note line, and is said", [at8.r.body.legibility.share, at8.r.body.notes.length], [0.67, 1]);
  const exact8 = await ask([line("a b c d", 0.9), line("e f g h", 0.9), line("i j", 0.1)]);
  t("R25 a share of exactly 0.8 (8 of 10) is at the line, not under it: no note", [exact8.r.body.legibility.share, exact8.r.body.notes], [0.8, []]);
  const unrated = await ask([line("one two three four", 0.9), line("five six", null), line("seven eight", "x")]);
  t("R25 a line the engine did not rate is not confident, and is counted among the words",
    unrated.r.body.legibility, { words: 8, confident_words: 4, share: 0.5 });

  /* the engine's WORDS carry the ratings: a line rated low by one bad word does not make its good words unread */
  const mixed = await ask([line("one two three four", 0.5)], { words: [{ confidence: 0.9 }, { confidence: 0.9 }, { confidence: 0.9 }, { confidence: 0.1 }] });
  t("R25 the share is of the engine's words, each at its own rating, not of its lines: 3 of 4 words rated 0.6 or more in a line rated 0.5",
    [mixed.r.body.legibility, mixed.r.body.notes.length], [{ words: 4, confident_words: 3, share: 0.75 }, 1]);
  const noWords = await ask([line("one two", 0.9)], { words: [] });
  t("R25 an engine that gave no words states no legibility, and the answer is R8's as before (nothing invented)",
    [noWords.r.body.ok, "legibility" in noWords.r.body, noWords.r.body.notes], [true, false, []]);

  /* the refusal: a picture the engine cannot read says so rather than returning its junk text */
  const junk = await ask([line("fumnery Staft recorwenends thet", 0.3), line("comeanttes soprove", 0.2)]);
  t("R25 a share under LEGIBLE_REFUSE_BELOW is refused PICTURE_NOT_LEGIBLE (200, ok:false), carrying the figures, with no text answered",
    [junk.r.status, junk.r.body.ok, junk.r.body.reason, junk.r.body.refusal.legibility, junk.r.body.pages, junk.w.engine.calls.length],
    [200, false, "PICTURE_NOT_LEGIBLE", { words: 6, confident_words: 0, share: 0 }, undefined, 4]);
  t("R25 the refusal says why in a sentence, and its detail is the declared one",
    [junk.r.body.detail === REFUSALS.PICTURE_NOT_LEGIBLE, junk.r.body.notes.length, junk.r.body.notes[0].trim().length > 0], [true, 1, true]);
  const edge2 = await ask([line("a b", 0.9), line("c d e f g h i j", 0.1)]);
  t("R25 a share of exactly 0.2 (2 of 10) is not refused: it is answered, with its note", [edge2.r.body.ok, edge2.r.body.legibility.share, edge2.r.body.notes.length], [true, 0.2, 1]);

  /* fix round 9, G137d: a PDF page is judged by the same figures as a picture, refused with its own reason */
  const pdfPart = world({ engine: stubEngine({ regions: [line("one two three four", 0.9), line("five six", 0.4)] }) });
  const pp = await pdfPart.ask(good());
  t("R25 a PDF page read in part states its legibility like a picture does, says it in a note, and answers its text whole",
    [pp.body.ok, pp.body.legibility, pp.body.notes.length, pp.body.pages[0].regions.map((x) => x.text)],
    [true, { words: 6, confident_words: 4, share: 0.67 }, 1, ["one two three four", "five six"]]);
  const pdfWhole = world({ engine: stubEngine({ regions: [line("one two three four", 0.9)] }) });
  const pw = await pdfWhole.ask(good());
  t("R25 a PDF page read whole states share 1 and says nothing more", [pw.body.legibility, pw.body.notes], [{ words: 4, confident_words: 4, share: 1 }, []]);
  const pdfJunk = world({ engine: stubEngine({ regions: [line("fumnery Staft recorwenends thet", 0.3)] }) });
  const pj = await pdfJunk.ask(good());
  t("R25 a PDF page under LEGIBLE_REFUSE_BELOW is refused PAGE_NOT_LEGIBLE (200, ok:false) with its legibility and no text",
    [pj.status, pj.body.ok, pj.body.reason, pj.body.refusal.legibility, pj.body.pages, pj.body.detail === REFUSALS.PAGE_NOT_LEGIBLE],
    [200, false, "PAGE_NOT_LEGIBLE", { words: 4, confident_words: 0, share: 0 }, undefined, true]);
  t("R25 PAGE_NOT_LEGIBLE is a declared refusal, and says why in a sentence in the answer's notes",
    [typeof REFUSALS.PAGE_NOT_LEGIBLE, pj.body.notes.length, pj.body.notes[0].trim().length > 0], ["string", 1, true]);
  const pdfNoWords = world({ engine: stubEngine({ regions: [line("fumnery", 0.1)], words: [] }) });
  const pn = await pdfNoWords.ask(good());
  t("R25 an engine that gave no words states no legibility for a PDF page either (nothing invented)",
    [pn.body.ok, "legibility" in pn.body, pn.body.notes], [true, false, []]);
  const pdfEdge = world({ engine: stubEngine({ regions: [line("a b", 0.9), line("c d e f g h i j", 0.1)] }) });
  const pe = await pdfEdge.ask(good());
  t("R25 a share of exactly 0.2 is not refused for a PDF page either: answered, with its note", [pe.body.ok, pe.body.legibility.share, pe.body.notes.length], [true, 0.2, 1]);
  /* the old answer without text_found: a picture is still judged by what the engine read */
  const bare = await ask([line("one two", 0.9)], { renderPicture: stubRender(pngPage(GREY4x3, 4, 3, { route: "decoded-picture" })) });
  t("R25 control: an answer with no prepared field is judged by the same figures", [bare.r.body.ok, bare.r.body.legibility.share], [true, 1]);
}

console.log("\n--- A13 · R26: the engine's orientation is asked of every frame; a page found turned is read upright, and one it cannot orient is stated ---");
{
  const UPRIGHT = png({ width: 3, height: 4, rows: [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]] });
  const SIDE_SHA = "a".repeat(64), UP_SHA = "b".repeat(64);
  const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  const clear = { text: "the upright line", rect: [0, 0, 8, 1], confidence: 0.9 };
  const partial = { text: "half read of it", rect: [0, 0, 8, 1], confidence: 0.9, words: [0.9, 0.9, 0.3, 0.3, 0.3, 0.3] };
  const garbage = { text: "xq zv jk", rect: [0, 0, 8, 1], confidence: 0.3 };
  const tall = { text: "the upright line", rect: [0, 0, 1, 8], confidence: 0.9 };
  const wordsOf = (r) => (r.words ? r.words.map((c) => ({ confidence: c })) : r.text.split(" ").map(() => ({ confidence: r.confidence })));
  /* an engine that reads the sideways frame (4 wide) as `side` and the upright one (3 wide) as `up`, and claims `claim`
     of the sideways frame (the upright frame it calls upright); it records the width of every frame it was given */
  const turnEngine = ({ claim, side, up }) => {
    const e = { ...REAL_ENGINE_NAMES, calls: [], check: () => null };
    e.transcribeFrame = async (rgba, w) => {
      e.calls.push(w);
      const r = w === 4 ? side : up;
      return { ok: true, regions: r ? [r] : [], grain: "line", boxCount: r ? 1 : 0, words: r ? wordsOf(r) : [],
               ...(claim === undefined ? {} : { orientation: w === 4 ? claim : { rotation: 0 } }) };
    };
    return e;
  };
  /* a renderer that turns a page when asked (pdf-pixels R48): the sideways frame as it lies, the upright one turned */
  const turner = (route) => stubRender((page, opts) => (opts.turn
    ? pngPage(UPRIGHT, 3, 4, { route, pixels_sha256: UP_SHA, turned_deg: opts.turn, prepared: { text_found: true, tilt_deg: 0, scale: 1, line_px: 30 } })
    : pngPage(GREY4x3, 4, 3, { route, pixels_sha256: SIDE_SHA, prepared: { text_found: true, tilt_deg: 0, scale: 1, line_px: 30 } })));
  const run = async ({ kind, claim, side, up, render }) => {
    const picture = kind === "picture";
    const rend = render || turner(picture ? "decoded-picture" : "stub-route");
    const w = world({ engine: turnEngine({ claim, side, up }), doc: picture ? JPG : DOC,
                      ...(picture ? { renderPicture: rend } : { render: rend }) });
    const r = await w.ask({ capture_sha: w.sha, store: "scratch", pages: [0] });
    return { w, r, rend, turns: rend.calls.map((c) => c.opts.turn ?? 0) };
  };

  for (const kind of ["pdf", "picture"]) for (const [rotation, turn] of [[90, 270], [180, 180], [270, 90]]) {
    const x = await run({ kind, claim: { rotation }, side: garbage, up: clear });
    const body = x.r.body, reg = body.pages?.[0].regions[0];
    t(`R26 a ${kind} the engine finds turned ${rotation} degrees is asked again with turn ${turn} and read upright`,
      [body.ok, x.turns, x.w.engine.calls, body.image.turned_deg], [true, [0, turn], [4, 3], turn]);
    t(`R26 ${kind} turned ${rotation}: the image, the rectangles, source.image and pixels_sha256 are those of the turned frame`,
      [body.image.width, body.image.height, body.image.pixels_sha256, reg.text, reg.source.rect, reg.source.image.pixels_sha256, reg.source.image.width, reg.source.image.height],
      [3, 4, UP_SHA, "the upright line", [0, 0, 8, 1], UP_SHA, 3, 4]);
    t(`R26 R25 ${kind} turned ${rotation}: read upright at the legibility floor, with no note`,
      [body.legibility, body.notes], [{ words: 3, confident_words: 3, share: 1 }, []]);
  }
  const picOpts = (await run({ kind: "picture", claim: { rotation: 90 }, side: garbage, up: clear })).rend.calls;
  t("R26 the picture renderer is asked for the turn with the same options it was first asked for (R24)",
    picOpts.map((c) => c.opts), [{ maxEdge: PICTURE_MAX_EDGE, grey: true, prepare: true }, { maxEdge: PICTURE_MAX_EDGE, grey: true, prepare: true, turn: 270 }]);
  const pdfOpts = (await run({ kind: "pdf", claim: { rotation: 270 }, side: garbage, up: clear })).rend.calls;
  t("R26 R30 the page renderer is asked for the turn with the options it was first asked for",
    pdfOpts.map((c) => c.opts), [{ decodeDct: true, allowTextPage: true }, { decodeDct: true, allowTextPage: true, turn: 90 }]);

  /* the controls: an upright page is not turned; the engine's claim of a turn is not obeyed against a page it reads clearly */
  for (const kind of ["pdf", "picture"]) {
    const up = await run({ kind, claim: { rotation: 0 }, side: clear, up: clear });
    t(`R26 control: an upright ${kind} is not turned: one render, turned_deg 0, no note`,
      [up.r.body.ok, up.turns, up.r.body.image.turned_deg, up.r.body.notes], [true, [0], 0, []]);
    const wrong = await run({ kind, claim: { rotation: 90 }, side: clear, up: garbage });
    t(`R26 control: a ${kind} the engine calls turned but reads clearly across the frame is read as it lies (one render)`,
      [wrong.r.body.ok, wrong.turns, wrong.r.body.image.turned_deg, wrong.r.body.notes], [true, [0], 0, []]);
    const quarter = await run({ kind, claim: { rotation: 90 }, side: tall, up: clear });
    t(`R26 a ${kind} read clearly by the engine with its lines running up the frame is still turned upright (the engine reads a quarter turn inside)`,
      [quarter.r.body.ok, quarter.turns, quarter.r.body.image.turned_deg], [true, [0, 270], 270]);
    const worse = await run({ kind, claim: { rotation: 270 }, side: partial, up: garbage });
    t(`R26 a ${kind} whose turned reading is worse than its reading as it lies is kept as it lies (turned_deg 0), with R25's note`,
      [worse.r.body.ok, worse.turns, worse.r.body.image.turned_deg, worse.r.body.legibility.share, worse.r.body.notes.length], [true, [0, 90], 0, 0.33, 1]);
    const blank = await run({ kind, claim: { rotation: 180 }, side: null, up: clear });
    t(`R26 a ${kind} the engine read nothing of and finds turned is asked again, and read upright`,
      [blank.r.body.ok, blank.turns, blank.r.body.image.turned_deg], [true, [0, 180], 180]);
    const both = await run({ kind, claim: { rotation: 90 }, side: garbage, up: garbage });
    t(`R26 R25 a ${kind} still under the floor after being turned is read the other ways too (fix round 10), and refused as R25 says, with no text`,
      [both.r.body.ok, both.r.body.reason, both.turns, both.r.body.pages, both.r.body.refusal.legibility.share],
      [false, kind === "picture" ? "PICTURE_NOT_LEGIBLE" : "PAGE_NOT_LEGIBLE", [0, 270, 90, 180], undefined, 0]);
  }

  /* an engine that cannot tell is stated, never read as garbage and answered with no mention */
  for (const [label, claim] of [["answers nothing", null], ["has no orientation to give", undefined], ["answers a turn that is no quarter turn", { rotation: 45 }]]) {
    for (const kind of ["pdf", "picture"]) {
      const x = await run({ kind, claim, side: clear, up: clear });
      t(`R26 an engine that ${label}: the ${kind} is read as it lies and notes states that its orientation could not be determined`,
        [x.r.body.ok, x.turns, x.r.body.image.turned_deg, x.r.body.notes.length, typeof x.r.body.notes[0], x.r.body.notes[0].trim().length > 0],
        [true, [0], 0, 1, "string", true]);
    }
  }
  const unread = await run({ kind: "pdf", claim: null, side: garbage, up: garbage });
  t("R26 and a page that cannot be oriented and cannot be read is refused with the statement among its notes",
    [unread.r.body.reason, unread.r.body.notes.length], ["PAGE_NOT_LEGIBLE", 2]);

  /* a turn the renderer refuses leaves the page read as it lies, and says so */
  const refusing = stubRender((page, opts) => (opts.turn ? pixelRefusal("PIXELS_UNDETERMINED") : pngPage(GREY4x3, 4, 3, { pixels_sha256: SIDE_SHA })));
  const rf = await run({ kind: "pdf", claim: { rotation: 90 }, side: partial, up: clear, render: refusing });
  t("R26 a turn the renderer refuses leaves the page read as it lies, with the statement that its orientation could not be determined",
    [rf.r.body.ok, rf.turns, rf.r.body.image.turned_deg, rf.r.body.notes.length], [true, [0, 270], 0, 2]);
}

console.log("\n--- A14 · R26: the real engine's orientation, asked before its text is read, through the member's own code ---");
let SCAN_CROP = null;
{
  /* the scanned page of the fixtures, its top 1100 rows: a 300-dpi page, which is where the engine's orientation is exact */
  const first = await renderPageToPixels(SCAN, 0, { decodeDct: true });
  const s0 = await pngToSamples(first.bytes);
  const full = samplesToRgba(s0);
  SCAN_CROP = { rgba: full.slice(0, s0.width * 1100 * 4), width: s0.width, height: 1100 };
  SCAN_CROP.turned = (deg) => turnRgba(SCAN_CROP, deg);
  const upright = await srcEngine.transcribeFrame(SCAN_CROP.rgba, SCAN_CROP.width, SCAN_CROP.height);
  t("R26 the real engine, on an upright 300-dpi page, answers an orientation of 0 with its text", [upright.ok, upright.orientation, upright.regions.length > 5], [true, { rotation: 0 }, true]);
  for (const deg of [90, 180, 270]) {
    const f = SCAN_CROP.turned(deg);
    const out = await srcEngine.transcribeFrame(f.rgba, f.width, f.height);
    t(`R26 the real engine finds the same page turned ${deg} degrees clockwise turned ${deg}`, [out.ok, out.orientation], [true, { rotation: deg }]);
  }
  /* asking the orientation first changes nothing it reads: the same lines as the vendor engine gives without the question */
  const vpkg = createRequire(fileURLToPath(new URL("../package.json", import.meta.url)));
  const { createOCREngine: vendorEngine } = await import(pathToFileURL(vpkg.resolve("tesseract-wasm")).href);
  const e = await vendorEngine({ wasmBinary: readFileSync(vpkg.resolve("tesseract-wasm").replace(/lib\.js$/, "tesseract-core.wasm")) });
  let plain;
  try {
    e.loadModel(new Uint8Array(readFileSync(MODEL)));
    e.loadImage({ data: SCAN_CROP.rgba, width: SCAN_CROP.width, height: SCAN_CROP.height });
    plain = e.getTextBoxes("line").map((b) => b.text);
  } finally { e.destroy(); }
  t("R26 the orientation is asked before the text is read and the text read is unchanged by the question",
    upright.regions.map((r) => r.text), plain);
}

console.log("\n--- A15 · R26 R25 R30: the member over the real engine, with the page renderer turning pages as pdf-pixels R48 says ---");
{
  /* pdf-pixels' `turn` is job 14's and unmerged when this was written: `withTurn` is a minimal local implementation of
     R48's contract over the real renderer's own answer (the page turned clockwise by `turn`), so this arm tests the
     member's logic against the real engine; the arm after it is the real renderers' seam. */
  const encodeGrey = (rgba, w, h) => png({ width: w, height: h, rows: Array.from({ length: h }, (_, y) => Uint8Array.from({ length: w }, (_, x) => rgba[(y * w + x) * 4])) });
  const withTurn = (real) => async (bytes, page, opts) => {
    const a = await real(bytes, page, opts);
    if (!a.ok || !opts.turn || a.turned_deg === opts.turn) return a;   /* a renderer that turns (pdf-pixels R48 merged) is not turned twice */
    const s = await pngToSamples(a.bytes);
    const f = turnRgba({ rgba: samplesToRgba(s), width: s.width, height: s.height }, opts.turn);
    const out = encodeGrey(f.rgba, f.width, f.height);
    return { ...a, bytes: out, width: f.width, height: f.height, turned_deg: opts.turn, pixels_sha256: hex(f.rgba) };
  };
  const memberOf = () => makeMember(srcEngine, { render: withTurn(renderPageToPixels), renderPicture: withTurn(realRenderPicture) });
  const body = async (bytes) => (await memberOf().transcribeRequest(bytes, [0], {}));
  const pictureOf = (deg) => { const f = SCAN_CROP.turned(deg); return encodeGrey(f.rgba, f.width, f.height); };
  const pagePdf = (deg, rotate) => {
    const f = SCAN_CROP.turned(deg);
    const rowBytes = Math.ceil(f.width / 8);
    const raw = Buffer.alloc(rowBytes * f.height);
    for (let y = 0; y < f.height; y++) for (let x = 0; x < f.width; x++) if (f.rgba[(y * f.width + x) * 4] > 127) raw[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
    return bilevelPagePdf(f.width, f.height, (i) => raw[i], rotate);
  };
  const upright = await body(pictureOf(0));
  t("R26 control: an upright picture of the page is read clearly and is not turned", [upright.ok, upright.image.turned_deg, upright.legibility.share >= 0.8, upright.notes], [true, 0, true, []]);
  const wanted = upright.pages[0].regions.map((r) => r.text.replace(/\s+/g, " ").trim()).join(" ");
  const sharedWords = (a, b) => { const bag = new Map(); for (const w of a.toLowerCase().split(/\W+/).filter(Boolean)) bag.set(w, (bag.get(w) || 0) + 1);
    let hit = 0, total = 0; for (const w of b.toLowerCase().split(/\W+/).filter(Boolean)) { total++; if (bag.get(w) > 0) { hit++; bag.set(w, bag.get(w) - 1); } } return total ? hit / total : 0; };
  for (const deg of [90, 180, 270]) {
    const r = await body(pictureOf(deg));
    const got = r.ok ? r.pages[0].regions.map((x) => x.text.replace(/\s+/g, " ").trim()).join(" ") : "";
    t(`R26 B1 a picture of the page turned ${deg} degrees is turned upright and read at the legibility floor`,
      [r.ok, r.image.turned_deg, r.legibility.share >= 0.8, sharedWords(wanted, got) >= 0.9], [true, (360 - deg) % 360, true, true]);
  }
  for (const [label, deg, rotate] of [["turned 90 degrees as its image", 90, 0], ["turned 180 degrees as its image", 180, 0], ["upright and carrying /Rotate 90", 0, 90], ["upright and carrying /Rotate 270", 0, 270]]) {
    const r = await body(pagePdf(deg, rotate));
    const got = r.ok ? r.pages[0].regions.map((x) => x.text.replace(/\s+/g, " ").trim()).join(" ") : "";
    const asked = (360 - ((deg + rotate) % 360)) % 360;
    t(`R26 B2 a PDF page ${label} is turned upright (${asked}) and read at the legibility floor`,
      [r.ok, r.image.turned_deg, r.legibility.share >= 0.8, sharedWords(wanted, got) >= 0.9], [true, asked, true, true]);
  }
}

console.log("\n--- A16 · R26 R25 R30 SEAM: the member over the REAL renderers (pdf-pixels R48, job 14) ---");
{
  /* red by name until pdf-pixels' `turn` merges: the member asked of the real page and picture renderers, unwrapped */
  const real = makeMember(srcEngine);
  const f = SCAN_CROP.turned(90);
  const bytes = png({ width: f.width, height: f.height, rows: Array.from({ length: f.height }, (_, y) => Uint8Array.from({ length: f.width }, (_, x) => f.rgba[(y * f.width + x) * 4])) });
  const r = await real.transcribeRequest(bytes, [0], {});
  t("R26 SEAM pdf-pixels R48: the real picture renderer turns the page the member asks it to, and the page is read upright",
    [r.ok, r.ok && r.image.turned_deg, r.ok && r.legibility.share >= 0.8], [true, 270, true]);
}

console.log("\n--- A17 · R25 G137d: one rule for photographs and PDF pages (inverted, blank, faint, noisy, clear) ---");
{
  const greyPdf = (w, h, pixels) => {
    const data = deflateSync(Buffer.from(pixels));
    const content = Buffer.from(`q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`, "latin1");
    return pdf([
      { num: 1, body: "<< /Type /Catalog /Pages 2 0 R >>" },
      { num: 2, body: "<< /Type /Pages /Kids [3 0 R] /Count 1 >>" },
      { num: 3, body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>` },
      { num: 4, head: `<< /Length ${content.length} >>`, stream: content },
      { num: 5, head: `<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${data.length} >>`, stream: data },
    ]);
  };
  const recipes = [["clear", {}], ["inverted", { invert: true }], ["faint", { contrast: true }], ["noisy", { noise: 0.2 }], ["tilted and shaded", { tilt: 3, shade: 0.5 }]];
  const real = makeMember(srcEngine);
  const classify = (r) => (!r.ok ? (/NOT_LEGIBLE$/.test(r.reason) ? "illegible" : r.reason)
    : r.legibility ? (r.legibility.share >= LEGIBLE_NOTE_BELOW ? "clear" : "partial") : "unrated");
  const consistent = (r, kind) => {
    if (!r.ok) {
      if (!/NOT_LEGIBLE$/.test(r.reason)) return true;        /* another finding (nothing transcribed ...), not a legibility answer */
      return r.reason === (kind === "picture" ? "PICTURE_NOT_LEGIBLE" : "PAGE_NOT_LEGIBLE") && r.refusal.legibility.share < LEGIBLE_REFUSE_BELOW && r.pages === undefined;
    }
    if (!r.legibility) return true;
    return r.legibility.share >= LEGIBLE_REFUSE_BELOW && (r.legibility.share < LEGIBLE_NOTE_BELOW) === (r.notes.length > 0);
  };
  const seen = [];
  for (const [label, degrade] of recipes) {
    const g = generate({ kind: "png", seed: "g137", size: { lines: 12 }, dpi: 150, mode: "L", degrade });
    const picBytes = await g.bytes();
    const tp = g.truth.pages[0];
    const pdfBytes = greyPdf(tp.width, tp.height, tp.pixels());
    const pic = await real.transcribeRequest(picBytes, [0], {});
    const page = await real.transcribeRequest(pdfBytes, [0], {});
    seen.push([label, classify(pic), classify(page)]);
    t(`R25 G137d ${label}: the picture's answer follows R25's rule (refused under 1/5 with PICTURE_NOT_LEGIBLE and no text, a note under 4/5)`,
      [consistent(pic, "picture")], [true]);
    t(`R25 G137d ${label}: the PDF page's answer follows the same rule with its own reason`,
      [consistent(page, "page")], [true]);
    if (page.ok && page.legibility && page.legibility.share < LEGIBLE_NOTE_BELOW)
      t(`R25 G137d ${label}: a PDF page partly legible keeps its text and says so in a note`, [page.pages[0].regions.length > 0, page.notes.length > 0], [true, true]);
  }
  console.log("        classes (picture / page): " + seen.map(([l, a, b]) => `${l} ${a}/${b}`).join(", "));
  const blank = greyPdf(600, 800, new Uint8Array(600 * 800).fill(255));
  const rb = await real.transcribeRequest(blank, [0], {});
  t("R25 G137d a blank page is answered NOTHING_TRANSCRIBED, as a blank picture is", [rb.ok, rb.reason], [false, "NOTHING_TRANSCRIBED"]);
  const g0 = generate({ kind: "png", seed: "g137", size: { lines: 12 }, dpi: 150, mode: "L", degrade: {} });
  const clearPic = await real.transcribeRequest(await g0.bytes(), [0], {});
  t("R25 G137d control: the clear page is not refused as a picture, and its legibility is stated", [clearPic.ok, typeof clearPic.legibility.share], [true, "number"]);
}

console.log("\n--- A18 · R27: a call reads its page's bytes, not the file's ---");
{
  const SIZE = 8 * 1024 * 1024;
  const big = new Uint8Array(SIZE); big.set([0x25, 0x50, 0x44, 0x46, 0x2d], 0);
  const reading = () => stubRender(async (pg, opts, src) => {
    await src.readRange(src.size - 1024, 1024);          /* the cross-reference data */
    await src.readRange(2048 + pg * 4096, 4096);         /* the page's own objects */
    await src.readRange(1 << 20, 64 * 1024);             /* its image stream */
    return pngPage(GREY4x3, 4, 3);
  });
  const w = world({ doc: big, render: reading() });
  const sha = hex(big);
  const gets = () => w.bucket.log.filter(([k]) => k === "get");
  let worst = 0;
  for (let page = 0; page < 24; page++) {
    const before = gets().length;
    const r = await w.ask({ capture_sha: sha, store: "scratch", pages: [page] });
    const mine = gets().slice(before);
    const bytesAsked = mine.reduce((n, [, , range]) => n + (range ? range.length : SIZE), 0);
    worst = Math.max(worst, bytesAsked);
    if (page === 0 || page === 23)
      t(`R27 page ${page} of a ${SIZE}-byte capture: answered, every R2 read is a range, and the bytes asked are the page's`,
        [r.body.ok, mine.every(([, , range]) => range && range.length > 0), bytesAsked < 100 * 1024], [true, true, true]);
  }
  t("R27 across the up to 24 calls of a document no call asked for more than the page's bytes (the largest was a fiftieth of the file)", worst < SIZE / 50, true);
  t("R27 and the source the renderer is given states the capture's size", w.render.calls[0].bytes, SIZE);
  t("R27 R15 only `get` was ever touched on CAPTURES", [...new Set(w.bucket.log.filter(([k]) => k === "touch").map(([, p]) => p))], ["get"]);

  /* the small capture is read from the first read: the sniff of what it is costs no second read */
  const small = world();
  await small.ask(good());
  t("R27 a capture smaller than the first read costs one R2 read in all", small.bucket.log.filter(([k]) => k === "get").length, 1);

  /* a picture: its header is judged from a bounded start of the file and the renderer reads the rest through the source */
  const JPG = new Uint8Array(2 * 1024 * 1024); JPG.set([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xc0, 0, 17, 8, 0x07, 0xd0, 0x0b, 0xb8, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  const pw = world({ doc: JPG, renderPicture: stubRender(async (pg, opts, src) => { await src.readRange(0, 4096); return pngPage(GREY4x3, 4, 3, { route: "decoded-picture" }); }) });
  const pr = await pw.ask({ capture_sha: pw.sha, store: "scratch", pages: [0] });
  t("R27 a picture capture is read as a range too: its header start and what the renderer asks, never the whole object",
    [pr.body.ok, pw.bucket.log.filter(([k]) => k === "get").every(([, , range]) => range && range.length <= 65536)], [true, true]);

  /* an object with nothing in it is a capture R2 will not take a range of: it is read plainly and refused by the renderer */
  const empty = world({ doc: new Uint8Array(0), render: stubRender({ ok: false, reason: "NOT_A_PDF" }) });
  const er = await empty.ask({ capture_sha: empty.sha, store: "scratch", pages: [0] });
  t("R27 a capture of no bytes is answered 200 with the renderer's own refusal, not an error", [er.status, er.body.reason, er.body.refusal.render.reason], [200, "PAGE_NOT_RENDERABLE", "NOT_A_PDF"]);
}

console.log("\n--- A19 · R28: a top-level guard — whatever throws inside a call is a 200 ok:false with the step and the error's name ---");
{
  const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  const throwing = (e) => async () => { throw e; };
  const cases = [
    ["the page renderer throws", { render: throwing(new RangeError("page renderer blew")) }, DOC, "render", "RangeError"],
    ["the picture renderer throws", { renderPicture: throwing(new TypeError("picture renderer blew")), doc: JPG }, JPG, "render", "TypeError"],
    ["the renderer answers bytes the PNG reader cannot take at all", { render: stubRender(pngPage(12345n, 4, 3)) }, DOC, "png", "TypeError"],
    ["the engine's check throws", { engine: (() => { const e = stubEngine(); e.check = () => { throw new Error("check blew"); }; return e; })() }, DOC, "engine_check", "Error"],
  ];
  for (const [label, opts, doc, stage, name] of cases) {
    const w = world({ doc, ...opts });
    const r = await w.ask({ capture_sha: w.sha, store: "scratch", pages: [3, 0] });
    t(`R28 ${label}: 200 ok:false UNEXPECTED_FAILURE naming the step and the error, the deferred page kept`,
      [r.status, r.body.ok, r.body.reason, r.body.stage, r.body.error_name, r.body.refusal.stage, r.body.refusal.error_name, r.body.page, r.body.deferred],
      [200, false, "UNEXPECTED_FAILURE", stage, name, stage, name, 0, [3]]);
  }
  const rr = await post(world().member, { CAPTURES: { get: async () => { throw new Error("R2 blew"); } }, VERSION: "b" }, good());
  t("R28 R2 throws: 200 ok:false UNEXPECTED_FAILURE at the read, never a 5xx and never a thrown error",
    [rr.status, rr.body.ok, rr.body.reason, rr.body.stage, rr.body.error_name], [200, false, "UNEXPECTED_FAILURE", "read", "Error"]);
  t("R28 the answer states the sentence of the refusal and no other status", [typeof REFUSALS.UNEXPECTED_FAILURE, rr.body.detail === REFUSALS.UNEXPECTED_FAILURE], ["string", true]);

  /* the controls: a request R1-R4 refuse is still refused as it was, and a good request is unchanged */
  const w = world();
  const bad = await w.ask({ capture_sha: "x", store: "scratch", pages: [0] });
  const ok = await w.ask(good());
  t("R28 control: the checks of R1-R5 still answer their own statuses, and a good request is still answered ok", [bad.status, bad.body.reason, ok.status, ok.body.ok], [400, "BAD_SHA", 200, true]);

  /* the PNG reader's corrupt-stream case is a refusal of its own, no throw and no unhandled rejection */
  const rawBad = (() => { const head = Buffer.alloc(13); head.writeUInt32BE(4, 0); head.writeUInt32BE(3, 4); head[8] = 8; head[9] = 0;
    return new Uint8Array(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", head), chunk("IDAT", Buffer.from([1, 2, 3, 4, 5, 6, 7, 8])), chunk("IEND", Buffer.alloc(0))])); })();
  const cw = world({ render: stubRender(pngPage(rawBad, 4, 3)) });
  const cr = await cw.ask(good());
  t("R28 R7.5 a PNG whose image data does not inflate is PIXELS_UNREADABLE (PNG_CORRUPT_DATA), a stated finding", [cr.status, cr.body.reason, cr.body.refusal.png.reason], [200, "PIXELS_UNREADABLE", "PNG_CORRUPT_DATA"]);
}

console.log("\n--- A20 · R29: an OCR_PSM that is no page-segmentation mode is refused on every call ---");
{
  let bodyRead = false;
  const req = (body = good()) => ({ method: "POST", url: "http://ocr-worker/transcribe", json: async () => { bodyRead = true; return body; } });
  for (const value of ["abc", "14", "-1", "3.5", "03", " 3", "3 ", "1e1", "0x6", "13.0", "99", 14, -1, 3.5, true, {}, ["3"], "x".repeat(200)]) {
    const w = world({ env: { OCR_PSM: value } });
    bodyRead = false;
    const r = await w.member.fetch(req(), w.env);
    const b = await r.json(); WIRE.push(b);
    t(`R29 OCR_PSM ${JSON.stringify(value).slice(0, 24)} -> 503 BAD_PSM naming the value, the body never read`,
      [r.status, b.ok, b.reason, typeof b.value, b.value.length <= 80, bodyRead, w.engine.calls.length], [503, false, "BAD_PSM", "string", true, false, 0]);
  }
  const long = world({ env: { OCR_PSM: "y".repeat(200) } });
  const lr = await (await long.member.fetch(req(), long.env)).json();
  t("R29 the value is named and truncated to 80 characters", lr.value, "y".repeat(80));
  t("R29 BAD_PSM is a declared refusal", typeof REFUSALS.BAD_PSM, "string");
  const noBucket = await world({ env: { OCR_PSM: "abc" } }).member.fetch(req(), { OCR_PSM: "abc" });
  t("R29 R5 with no CAPTURES binding R5 is answered first (503 R2_NOT_CONFIGURED)", (await noBucket.json()).reason, "R2_NOT_CONFIGURED");
  for (const value of ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", 6, 13, 0]) {
    const w = world({ env: { OCR_PSM: value } });
    const r = await w.ask(good());
    t(`R29 OCR_PSM ${JSON.stringify(value)} is a page-segmentation mode: accepted, and given to the engine as the text ${JSON.stringify(String(value))}`,
      [r.status, r.body.ok, w.engine.calls[0].opts], [200, true, { psm: String(value) }]);
  }
  for (const value of [undefined, null, ""]) {
    const w = world({ env: { OCR_PSM: value } });
    const r = await w.ask(good());
    t(`R29 control: OCR_PSM ${JSON.stringify(value)} is no setting: accepted, the engine given none`, [r.status, r.body.ok, w.engine.calls[0].opts], [200, true, { psm: null }]);
  }
  t("R29 the set the member accepts is exactly tesseract's 14 modes, frozen", [PAGE_SEG_MODES, Object.isFrozen(PAGE_SEG_MODES)], [["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"], true]);
  t("R29 psmFrom reads the setting the way the member does", [psmFrom({ OCR_PSM: "6" }), psmFrom({}), psmFrom({ OCR_PSM: "zz" })],
    [{ set: true, ok: true, mode: "6", value: "6" }, { set: false, ok: true, mode: null }, { set: true, ok: false, mode: null, value: "zz" }]);
}

console.log("\n--- A21 · R30: a page routed here is read though it shows text ---");
{
  /* a scanned page carrying a printed folio: an image page with a text-showing operator */
  const W = 600, H = 800;
  const raw = Buffer.alloc(Math.ceil(W / 8) * H, 0xff);
  const data = deflateSync(raw);
  const content = Buffer.from(`q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q BT /F1 10 Tf 20 20 Td (3) Tj ET`, "latin1");
  const FOLIO = pdf([
    { num: 1, body: "<< /Type /Catalog /Pages 2 0 R >>" },
    { num: 2, body: "<< /Type /Pages /Kids [3 0 R] /Count 1 >>" },
    { num: 3, body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 5 0 R >> /Font << /F1 6 0 R >> >> /Contents 4 0 R >>` },
    { num: 4, head: `<< /Length ${content.length} >>`, stream: content },
    { num: 5, head: `<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceGray /BitsPerComponent 1 /Filter /FlateDecode /Length ${data.length} >>`, stream: data },
    { num: 6, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>" },
  ]);
  const without = await renderPageToPixels(FOLIO, 0, { decodeDct: true });
  t("R30 the page renderer, asked as it was before, refuses the folio page for its text layer (the cause)", [without.ok, without.reason], [false, "PAGE_HAS_TEXT_LAYER"]);
  const sha = hex(FOLIO);
  const line = { text: "RESOLUTION No. 1", rect: [10, 10, 200, 40], confidence: 0.9 };
  const engine = stubEngine({ regions: [line] });
  const bucket = recordingBucket(new Map([[`scratch/captures/${sha}`, FOLIO]]));
  const r = await post(makeMember(engine, { render: viaBytes(renderPageToPixels) }), { CAPTURES: bucket.proxy, VERSION: "v" }, { capture_sha: sha, store: "scratch", pages: [0] });
  t("R30 R7.2 the member transcribes a scanned page that carries a printed folio, through the real page renderer: it is not refused",
    [r.status, r.body.ok, r.body.reason, r.body.pages?.[0].regions.map((x) => x.text), engine.calls.length], [200, true, undefined, ["RESOLUTION No. 1"], 1]);
  const asked = world({ doc: FOLIO });
  await asked.ask({ capture_sha: sha, store: "scratch", pages: [0] });
  t("R30 the page renderer is asked with allowTextPage and decodeDct", asked.render.calls[0].opts, { decodeDct: true, allowTextPage: true });
}

console.log("\n--- A22 · R7 R24 G125g: a picture's frame is judged from its header, before anything is rendered ---");
{
  const jpegOf = (width, height) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0,
    0xff, 0xc0, 0, 17, 8, height >> 8, height & 255, width >> 8, width & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xff, 0xd9]);
  const pngOf = (width, height) => png({ width, height, rows: [] });
  const edge = PICTURE_MAX_EDGE, bound = MAX_FRAME_BYTES;
  const widest = Math.floor(bound / 4 / edge);       /* the tallest 4096-wide frame that fits the bound */
  for (const [format, make] of [["PNG", pngOf], ["JPEG", jpegOf]]) {
    for (const [label, wd, ht, refused] of [
      [`${edge} x ${widest + 1}: one row over the bound`, edge, widest + 1, true],
      [`${edge} x ${edge}`, edge, edge, true],
      [`${edge} x ${widest}: the last row that fits`, edge, widest, false],
      ["a small picture", 800, 600, false],
    ]) {
      const doc = make(wd, ht);
      for (const via of ["R2", "bytes"]) {
        const rp = stubRender(pngPage(GREY4x3, 4, 3, { route: "decoded-picture" }));
        const m = makeMember(stubEngine({ regions: [{ text: "a line", rect: [0, 0, 2, 1], confidence: 0.9 }] }), { renderPicture: rp });
        let out;
        if (via === "bytes") out = await m.transcribeRequest(doc, [0], {});
        else {
          const bucket = recordingBucket(new Map([[`scratch/captures/${hex(doc)}`, doc]]));
          out = (await post(m, { CAPTURES: bucket.proxy, VERSION: "v" }, { capture_sha: hex(doc), store: "scratch", pages: [0] })).body;
        }
        t(`R7.4 G125g a ${format} of ${label} (${via}): ${refused ? "refused before any render, naming its frame" : "reaches the renderer"}`,
          [out.ok, out.reason, rp.calls.length, refused ? [out.refusal.width, out.refusal.height, out.refusal.frame_bytes, out.refusal.bound_bytes] : null],
          refused ? [false, "FRAME_OVER_MEASURED_BOUND", 0, [wd, ht, wd * ht * 4, bound]] : [true, undefined, 1, null]);
      }
    }
  }
  /* the reduced frame is what the renderer makes: a 6000-wide picture is halved and fits */
  const rp = stubRender(pngPage(GREY4x3, 4, 3, { route: "decoded-picture" }));
  const big = makeMember(stubEngine({ regions: [{ text: "a line", rect: [0, 0, 2, 1], confidence: 0.9 }] }), { renderPicture: rp });
  const wide = await big.transcribeRequest(pngOf(6000, 4000), [0], {});
  t("R7.4 G125g a picture longer than the edge is judged as the renderer reduces it (6000 x 4000 becomes 3000 x 2000): it reaches the renderer",
    [wide.ok, rp.calls.length], [true, 1]);
  const none = await big.transcribeRequest(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]), [0], {});
  t("R7.4 a picture whose header cannot be read here is not refused by it: the rendered frame is judged as before", [none.ok, rp.calls.length], [true, 2]);
  const order = makeMember(stubEngine({ check: "no engine" }), { renderPicture: rp });
  const o = await order.transcribeRequest(pngOf(edge, edge), [0], {});
  t("R7.1 R7.4 the engine is checked first: ENGINE_ABSENT, even for a frame over the bound", o.reason, "ENGINE_ABSENT");
  const p1 = await big.transcribeRequest(pngOf(edge, edge), [1], {});
  t("R23 R7.4 a page a picture does not have is named NO_SUCH_PAGE before its frame is judged", p1.reason, "NO_SUCH_PAGE");
  t("R7.4 the frame over the bound is the PDF page's, too, once rendered, as before (a 5000 x 3066 page)",
    (await makeMember(stubEngine(), { render: stubRender(pngPage(new Uint8Array([1, 2, 3]), 5000, 3066)) }).transcribeRequest(DOC, [0], {})).reason, "FRAME_OVER_MEASURED_BOUND");
  t("R7.4 declaredPictureFrame answers null for bytes that are no picture", await declaredPictureFrame(sourceOfBytes(new Uint8Array([1, 2, 3, 4]))), null);
}

console.log("\n--- A23 · R31: no ceiling this module keeps is a numeric literal; each quotes the table ---");
{
  const bounds = await import("../../bio-plane/src/read-bounds.mjs");
  t("R31 R7.4 MAX_FRAME_BYTES is the table's ocr.frame_bytes row, as the active figure", [MAX_FRAME_BYTES, MAX_FRAME_BYTES === bounds.boundOf("ocr", "frame_bytes")], [61_300_000, true]);
  t("R31 PICTURE_MAX_EDGE is the table's ocr.picture_edge row, as the active figure", [PICTURE_MAX_EDGE, PICTURE_MAX_EDGE === bounds.boundOf("ocr", "picture_edge")], [4096, true]);
  const SRC = fileURLToPath(new URL("../src/", import.meta.url));
  const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1").replace(/"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`|'(?:[^'\\\n]|\\.)*'/g, '""');
  const own = readdirSync(SRC).filter((f) => f.endsWith(".mjs") && f !== "tesslib.mjs");
  const literals = [];
  for (const f of own) for (const line of strip(readFileSync(SRC + f, "utf8")).split("\n")) {
    const big = [...line.matchAll(/(?<![\w.])(\d[\d_]{3,})(?![\w.])/g)].map((m) => m[1]);
    if (big.length) literals.push([f, line.trim().slice(0, 100)]);
  }
  /* the module's numeric literals of four digits or more: the read size of a picture's header and the measured byte
     lengths of the engine's own parts are what remain; a literal ceiling anywhere else would be listed here */
  t("R31 the module's source holds no numeric literal of four digits or more for a ceiling: only one read size and the two measured byte lengths of the engine's own parts (R19) remain",
    literals.map(([f, l]) => `${f}: ${l.replace(/\s+/g, " ")}`).sort(),
    ["contract.mjs: const HEADER_WINDOW = 65536;", "tessengine.mjs: export const MODEL_BYTES = 4113088;", "tessengine.mjs: export const WASM_BYTES = 1839004;"]);
  const ceilings = [...own].flatMap((f) => [...readFileSync(SRC + f, "utf8").matchAll(/export const ([A-Z_]*(?:MAX|BOUND)[A-Z_]*) =\s*([^;]*);/g)].map((m) => [f, m[1], m[2]]));
  t("R31 every exported ceiling constant is read through boundOf", ceilings.filter(([, , init]) => !/boundOf\(/.test(init)).map(([f, n]) => `${f}:${n}`), []);
  t("R31 and the ceilings found are the two this module keeps", ceilings.map(([, n]) => n).sort(), ["MAX_FRAME_BYTES", "PICTURE_MAX_EDGE"]);
}

console.log("\n--- A24 · R27 SEAM: the member over the REAL renderers asked a source (pdf-pixels R47, job 14; pdf-reader pageSource) ---");
{
  /* red by name until pdf-pixels' source reading merges: the member, its real page and picture renderers, a capture in a bucket */
  const asked = async (doc) => {
    const bucket = recordingBucket(new Map([[`scratch/captures/${hex(doc)}`, doc]]));
    const m = makeMember(stubEngine({ regions: [{ text: "a line", rect: [0, 0, 2, 1], confidence: 0.9 }] }));
    return { out: await post(m, { CAPTURES: bucket.proxy, VERSION: "v" }, { capture_sha: hex(doc), store: "scratch", pages: [0] }), bucket };
  };
  const pdfAsk = await asked(TWO_PAGE);
  const wholeObject = pdfAsk.bucket.log.filter(([k]) => k === "get").reduce((n, [, , range]) => n + (range ? range.length : TWO_PAGE.length), 0);
  t("R27 SEAM pdf-reader pageSource (through pdf-pixels R47): a scanned PDF page through the real page renderer is read from ranges of the object, fewer bytes than the file holds",
    [pdfAsk.out.body.ok, pdfAsk.bucket.log.every(([k, , range]) => k !== "get" || range), wholeObject < TWO_PAGE.length], [true, true, true]);
  const picAsk = await asked(PHOTO_JPG);
  t("R27 SEAM pdf-pixels R47: a photograph through the real picture renderer is answered from a source", [picAsk.out.body.ok], [true]);
}

/* ============================================================================================================ *
 * Part B — the COMMITTED BUNDLE under workerd, the real engine, the real renderer
 * ============================================================================================================ */
globalThis.fetch = realFetch;

const baseDef = ocrWorkerDef({ bindings: { VERSION: "member-suite" } });
const partsWith = (def, name, replace) => ({ ...def, name, modules: def.modules.map((m) => replace(m) || m) });
const mf = new Miniflare({ workers: [
  baseDef,
  { ...ocrWorkerDef({ name: "ocr-floor", bindings: { VERSION: "member-suite", OCR_CONFIDENCE_FLOOR: "0.5", OCR_PSM: "3" } }) },
  /* A wrong language model: the first 4096 bytes of the real one. */
  partsWith(ocrWorkerDef({ bindings: { VERSION: "member-suite" } }), "ocr-wrong-model",
    (m) => (m.path === MODEL ? { ...m, contents: readFileSync(MODEL).subarray(0, 4096) } : null)),
  /* The wasm core uploaded as plain data rather than compiled at upload. */
  partsWith(ocrWorkerDef({ bindings: { VERSION: "member-suite" } }), "ocr-wasm-as-data",
    (m) => (m.path === WASM ? { ...m, type: "Data" } : null)),
] });
const bucket = await mf.getR2Bucket("CAPTURES");
const STORE = "scratch";
const puts = [["scan", SCAN], ["twopage", TWO_PAGE], ["blank", BLANK], ["noise", NOISE], ["huge", HUGE], ["texty", TEXTY], ["notpdf", NOT_PDF],
                ["photojpg", PHOTO_JPG], ["photopng", PHOTO_PNG]];
const shaOf = new Map();
for (const [name, bytes] of puts) { shaOf.set(name, hex(bytes)); await bucket.put(`${STORE}/captures/${hex(bytes)}`, bytes); }
await bucket.put(`bio/captures/${SCAN_SHA}`, SCAN);
await bucket.put(`biosmoke/captures/${SCAN_SHA}`, SCAN);

async function snapshot() {
  const out = [];
  let cursor;
  do {
    const page = await bucket.list({ cursor });
    for (const o of page.objects) out.push([o.key, hex(Buffer.from(await (await bucket.get(o.key)).arrayBuffer()))]);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return out.sort((a, b) => a[0].localeCompare(b[0]));
}
const BEFORE = await snapshot();

const workerCall = async (worker, path, init) => {
  const w = await mf.getWorker(worker);
  const r = await w.fetch(`http://ocr-worker${path}`, init);
  const body = await r.json(); WIRE.push(body); return { status: r.status, body };
};
const call = (body, worker = "ocr-worker") => workerCall(worker, "/transcribe", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const ask = (name, pages = [0], worker) => call({ capture_sha: shaOf.get(name), store: STORE, pages }, worker);

console.log("\n--- B1 · R11, R12, R13, R19: the committed bundle boots, and the engine is really in it ---");
{
  const v = await workerCall("ocr-worker", "/version");
  t("R11 R12 R13 GET /version, from the committed bundle", [v.status, v.body],
    [200, { ok: true, name: "ocr-worker", version: "member-suite", engine: "tesseract-wasm", engine_version: "0.11.0",
            model: "tessdata_fast/eng", engine_loaded: true }]);
  const wm = await workerCall("ocr-wrong-model", "/version");
  t("R13 R19 a different language model: engine_loaded false, and it says the model is not the measured one",
    [wm.body.engine_loaded, /4096 B/.test(wm.body.engine_unavailable), /4113088 B/.test(wm.body.engine_unavailable)],
    [false, true, true]);
  const wd = await workerCall("ocr-wasm-as-data", "/version");
  t("R13 R19 a wasm core that did not arrive compiled: engine_loaded false, and it says so",
    [wd.body.engine_loaded, /did not arrive as a compiled module/.test(wd.body.engine_unavailable)], [false, true]);
  for (const worker of ["ocr-wrong-model", "ocr-wasm-as-data"]) {
    const r = await ask("texty", [0], worker);
    t(`R7.1 R19 ${worker}: every page is refused ENGINE_ABSENT, before its bytes are looked at`,
      [r.status, r.body.ok, r.body.reason], [200, false, "ENGINE_ABSENT"]);
    t(`R13 ${worker}: the other routes answer normally`, (await call({ capture_sha: "x", store: STORE, pages: [0] }, worker)).body.reason,
      "BAD_SHA");
  }
  /* The core's exact bytes cannot be read back from a compiled module; they are pinned before deploy by the
     bundle manifest, which hashes both upload parts (bundler R4, R6). Q1 in the job record. */
  const member = discoverMembers().find((m) => m.name === "ocr-worker");
  const vs = verifyStatic(member);
  t("R19 the committed manifest's input and asset hashes match the tree (a swapped engine is caught as stale)",
    vs.findings, []);
  t("R19 the manifest pins both upload parts at the measured sizes",
    (vs.manifest?.assets || []).map((a) => [a.path, a.bytes]),
    [["assets/tesseract-core.wasm", 1839004], ["assets/eng.traineddata", 4113088]]);
  t("R19 and the committed files are those sizes", [statSync(WASM).size, statSync(MODEL).size], [1839004, 4113088]);
}

console.log("\n--- B2 · R8, R9, R17, R18, R20, R21: THE REAL PAGE, transcribed inside workerd ---");
let real = null;
{
  const { status, body } = await ask("scan");
  real = body;
  t("R8 200 ok:true, with every named field", [status, body.ok, keys(body).filter((k) => k !== "legibility")],
    [200, true, ["cap", "confidence_floor", "deferred", "engine", "grain", "image", "measured_by", "model", "notes", "ok", "pages", "version"]]);
  t("R8 the engine named; cap C, a letter of the record's scale; measured_by the one citation",
    [body.engine, body.version, body.model, body.cap, BASIS_GRADES.includes(body.cap), body.measured_by === MEASURED_BY],
    ["tesseract-wasm", "0.11.0", "tessdata_fast/eng", "C", true, true]);
  t("R8 the floor is a stated null (none configured); grain line; nothing deferred",
    [body.confidence_floor, body.grain, body.deferred], [null, "line", []]);
  t("R8 the image is the rendered frame's, by the independent decoder's digest",
    settled(body.image), { width: 2550, height: 3300, frame_bytes: 2550 * 3300 * 4, route: "decoded-ccitt-g4", upright: true,
                  rotate_deg: 270, dpi: body.image.dpi, pixels_sha256: IND_UPRIGHT_SHA });
  t("R8 exactly one page, page 0", [body.pages.length, body.pages[0].page], [1, 0]);

  const regions = body.pages[0].regions;
  t("R9 a real page's worth of text came back (floors, not equalities)",
    [regions.length >= 30, regions.reduce((n, r) => n + r.text.length, 0) >= 2000], [true, true]);
  console.log(`        ${regions.length} region(s) · ${regions.reduce((n, r) => n + r.text.length, 0)} character(s)`);
  t("R9 R10 every region: non-blank text, a pdf-page anchor the PLANE accepts, in image pixels, inside the image",
    regions.filter((r) => {
      const s = r.source || {}, rect = Array.isArray(s.rect) ? s.rect : [], im = s.image || {};
      return !(typeof r.text === "string" && r.text.trim() && checkAnchor(s) == null && s.ref === "p0" && s.page === 0
               && s.space === "image-px" && rect.length === 4 && rect[0] >= 0 && rect[1] >= 0 && rect[2] <= im.width
               && rect[3] <= im.height && rect[2] > rect[0] && rect[3] > rect[1]);
    }).length, 0);
  t("R9 every region's image is the frame that was OCR'd",
    [...new Set(regions.map((r) => JSON.stringify(r.source?.image)))],
    [JSON.stringify({ width: 2550, height: 3300, route: "decoded-ccitt-g4", upright: true, rotate_deg: 270,
                      pixels_sha256: IND_UPRIGHT_SHA })]);
  t("R9 R17 every confidence is accepted by the PLANE's checker, and the only basis is the engine's",
    [regions.filter((r) => checkConfidence(r.confidence) != null).length,
     [...new Set(regions.map((r) => (r.confidence === "none" ? "none" : r.confidence.basis)))]], [0, ["engine"]]);
  /* PINS on the known page, not a score: the two strings CPDF-11 measured a generative model minting wrong. */
  const joined = regions.map((r) => r.text).join(" ");
  t("R18 the dollar figure comes back as the page says it, not as the $10,000 a model minted",
    [joined.includes("$50,000"), joined.includes("$10,000")], [true, false]);
  t("R18 and \"lowest responsible\", not the \"least responsible\" a model minted",
    [joined.includes("lowest responsible"), joined.includes("least responsible")], [true, false]);

  const again = await call({ capture_sha: SCAN_SHA, store: "bio", pages: [0] });
  t("R20 R21 the same bytes under the other namespace answer the identical wire answer", JSON.stringify(again.body),
    JSON.stringify(real));
  const floored = await ask("scan", [0], "ocr-floor");
  t("R8 R21 an instance with a floor and a segmentation mode states the floor, and the call goes through",
    [floored.body.ok, floored.body.confidence_floor, floored.body.pages[0].regions.length > 0], [true, 0.5, true]);
}

console.log("\n--- B3 · R6: ONE page per invocation, on the real member ---");
{
  const { body } = await ask("scan", [2, 0, 1, 0]);
  t("R6 asked for three pages, it answers ONE — the lowest — and defers the rest",
    [body.ok, body.pages.map((p) => p.page), body.deferred], [true, [0], [1, 2]]);
  t("R6 the note says why", body.notes.some((n) => /ONE PAGE PER INVOCATION/.test(n) && /UNMEASURED/.test(n)), true);
  const past = await ask("scan", [3, 1, 1]);
  t("R6 R7.2 the lowest is taken even when the document has no such page, and the rest stay deferred",
    [past.body.reason, past.body.page, past.body.deferred, past.body.refusal.render.reason],
    ["PAGE_NOT_RENDERABLE", 1, [3], "NO_SUCH_PAGE"]);

  /* D-606, this member's share (converted from the plane's `d606-perpage-ocr` suite): a document of TWO scanned pages
     (D-460's fixture, pixels only; page 1 is an agenda) is read past its first page by calling once per deferred page.
     Each call is answered alone; the second is the same member answering the page the first deferred. */
  const first = await ask("twopage", [1, 0]);
  t("R6 a two-page scan asked for both: page 0 transcribed, page 1 deferred with the note",
    [first.status, first.body.ok, first.body.pages.map((p) => p.page), first.body.deferred,
     first.body.notes.some((n) => /ONE PAGE PER INVOCATION/.test(n))], [200, true, [0], [1], true]);
  const second = await ask("twopage", first.body.deferred);
  t("R6 R8 R9 the deferred page, asked alone, is transcribed: page 1, nothing deferred, anchored to p1",
    [second.status, second.body.ok, second.body.pages.map((p) => p.page), second.body.deferred,
     second.body.pages[0].regions.length > 0,
     second.body.pages[0].regions.every((r) => r.source.ref === "p1" && r.source.page === 1 && checkAnchor(r.source) == null)],
    [200, true, [1], [], true, true]);
  t("R6 R21 the two calls answer different pages of the one capture: different frames",
    first.body.image.pixels_sha256 !== second.body.image.pixels_sha256, true);
  const again2 = await ask("twopage", [1]);
  t("R21 the deferred page asked again answers the identical wire answer", JSON.stringify(again2.body), JSON.stringify(second.body));
}

console.log("\n--- B4 · R7: the real renderer's refusals pass through verbatim; the real bound; the real controls ---");
{
  for (const [name, page] of [["texty", 0], ["notpdf", 0], ["scan", 5]]) {
    const doc = name === "texty" ? TEXTY : name === "notpdf" ? NOT_PDF : SCAN;
    /* the bundle of the round's start asks for decodeDct alone, the rebuilt one adds allowTextPage (R30): the renderer's
       reason is that of the one that answered, and either way it is forwarded verbatim */
    const direct = await renderPageToPixels(doc, page, { decodeDct: true });
    const direct2 = await renderPageToPixels(doc, page, { decodeDct: true, allowTextPage: true });
    const r = await ask(name, [page]);
    t(`R7.2 ${name} p${page}: 200 PAGE_NOT_RENDERABLE carrying the renderer's own reason (${direct.reason}, or ${direct2.reason} for a page that shows text)`,
      [r.status, r.body.ok, r.body.reason, [direct.reason, direct2.reason].includes(r.body.refusal.render.reason)], [200, false, "PAGE_NOT_RENDERABLE", true]);
  }
  const huge = await ask("huge");
  t("R7.4 a 5000 x 5000 page is refused FRAME_OVER_MEASURED_BOUND, 200, naming its frame",
    [huge.status, huge.body.ok, huge.body.reason, huge.body.refusal.frame_bytes, huge.body.refusal.bound_bytes],
    [200, false, "FRAME_OVER_MEASURED_BOUND", 100_000_000, 61_300_000]);
  /* THE CONTROL EVERY ENGINE MUST PASS: nothing on a page with nothing on it — a blank, and noise. */
  const blank = await ask("blank");
  const noise = await ask("noise");
  t("R7.7 BLANK: 200 NOTHING_TRANSCRIBED", [blank.status, blank.body.ok, blank.body.reason], [200, false, "NOTHING_TRANSCRIBED"]);
  t("R7.7 NOISE: answered exactly the same way — the engine self-refuses",
    [noise.status, noise.body.ok, noise.body.reason], [200, false, "NOTHING_TRANSCRIBED"]);
  t("R7.7 each names how many boxes it found and how many were blank or unanchored",
    [blank.body.refusal, noise.body.refusal].map((x) => [typeof x.boxes, typeof x.blank, typeof x.unanchored]),
    [["number", "number", "number"], ["number", "number", "number"]]);
}

console.log("\n--- B8 · R23: a photograph of a printed sentence, transcribed inside workerd by the real renderer and engine ---");
{
  for (const [name, bytes, format] of [["photojpg", PHOTO_JPG, "jpeg"], ["photopng", PHOTO_PNG, "png"]]) {
    const direct = await renderPictureToPixels(bytes, 0, { maxEdge: PICTURE_MAX_EDGE, grey: true, prepare: true });
    const { status, body } = await ask(name);
    t(`R23 ${format}: 200 ok:true, with the fields R8 names and R25's legibility`, [status, body.ok, keys(body)],
      [200, true, ["cap", "confidence_floor", "deferred", "engine", "grain", "image", "legibility", "measured_by", "model", "notes", "ok", "pages", "version"]]);
    t(`R25 ${format}: the legibility the real engine rated, in the real bundle (words, their confident share, the engine's own ratings)`,
      [body.legibility?.words > 0, body.legibility?.confident_words <= body.legibility?.words,
       body.legibility?.share === Math.round((body.legibility?.confident_words / body.legibility?.words) * 100) / 100], [true, true, true]);
    t(`R23 ${format}: R8's constants hold for a picture as for a page`,
      [body.engine, body.version, body.model, body.cap, body.grain, body.deferred, body.measured_by === MEASURED_BY],
      ["tesseract-wasm", "0.11.0", "tessdata_fast/eng", "C", "line", [], true]);
    t(`R23 ${format}: the image is the picture renderer's own frame, by the renderer's digest`,
      settled(body.image), { width: direct.width, height: direct.height, frame_bytes: direct.width * direct.height * 4,
                    route: "decoded-picture", upright: true, rotate_deg: null, dpi: null,
                    pixels_sha256: direct.pixels_sha256 });
    const regions = body.pages[0].regions;
    const text = regions.map((r) => r.text).join("\n");
    console.log(`        ${regions.length} region(s): ${JSON.stringify(text)}`);
    t(`R23 ${format}: page 0 answers the sentence's words`, PHOTO_WORDS.filter((w) => !text.includes(w)), []);
    t(`R23 ${format}: every region is anchored in the frame that was read, to p0, with the engine's own confidence or 'none'`,
      regions.filter((r) => {
        const s = r.source, rect = s.rect;
        return !(checkAnchor(s) == null && s.ref === "p0" && s.page === 0 && s.space === "image-px"
                 && s.image.pixels_sha256 === direct.pixels_sha256 && rect[0] >= 0 && rect[1] >= 0
                 && rect[2] <= direct.width && rect[3] <= direct.height && rect[2] > rect[0] && rect[3] > rect[1]
                 && checkConfidence(r.confidence) == null);
      }).length, 0);
    const p1 = await ask(name, [1]);
    t(`R23 ${format}: page 1 is 200 NO_SUCH_PAGE naming it`,
      [p1.status, p1.body.ok, p1.body.reason, p1.body.page], [200, false, "NO_SUCH_PAGE", 1]);
    const both = await ask(name, [0, 2]);
    t(`R23 ${format}: pages [0, 2] transcribes page 0 and defers 2 (R6)`, [both.body.ok, both.body.pages[0].page, both.body.deferred], [true, 0, [2]]);
    const again = await ask(name);
    t(`R23 R21 ${format}: asked again, the identical wire answer`, JSON.stringify(again.body), JSON.stringify(body));
  }
  /* controls */
  const pdfPage = await ask("scan");
  t("R23 control: a PDF page is transcribed as before (same frame, route and digest)",
    [pdfPage.body.ok, pdfPage.body.image.route, pdfPage.body.image.pixels_sha256], [true, "decoded-ccitt-g4", IND_UPRIGHT_SHA]);
  const junk = await ask("notpdf");
  t("R23 control: bytes that are neither a picture nor a PDF are refused as today",
    [junk.status, junk.body.reason, junk.body.refusal.render.reason], [200, "PAGE_NOT_RENDERABLE", "NOT_A_PDF"]);
}

console.log("\n--- B5 · R1–R5 and R14 on the committed bundle ---");
{
  t("R1 a bad sha", [(await call({ capture_sha: "nope", store: STORE, pages: [0] })).status], [400]);
  t("R2 an absent store", (await call({ capture_sha: SCAN_SHA, pages: [0] })).body.reason, "BAD_STORE");
  const unknown = await call({ capture_sha: SCAN_SHA, store: "biosmoke", pages: [0] });
  t("R3 R16 an unknown namespace, though the page's bytes sit under it",
    [unknown.status, unknown.body.reason, unknown.body.asked, unknown.body.namespaces],
    [400, "NAMESPACE_UNKNOWN", "biosmoke", ["bio", "scratch"]]);
  t("R4 pages naming no page", [(await call({ capture_sha: SCAN_SHA, store: STORE, pages: ["0"] })).status], [400]);
  const missing = await call({ capture_sha: "0".repeat(64), store: STORE, pages: [0] });
  t("R5 a capture that is not there: 404 NOT_FOUND — distinguishable from the 400 NAMESPACE_UNKNOWN",
    [missing.status, missing.body.reason, unknown.status], [404, "NOT_FOUND", 400]);
  const noR2 = new Miniflare({ workers: [ocrWorkerDef({ r2: false })] });
  const r = await noR2.dispatchFetch("http://ocr-worker/transcribe", { method: "POST", body: "{" });
  t("R5 a member with no CAPTURES binding: 503 R2_NOT_CONFIGURED", [r.status, (await r.json()).reason], [503, "R2_NOT_CONFIGURED"]);
  await noR2.dispose();
  t("R14 an unknown route", [(await workerCall("ocr-worker", "/whatever")).status], [404]);
}

console.log("\n--- B6 · R15: it wrote nothing, and cannot ---");
{
  t("R15 the whole bucket, every object, is byte-identical after every call above", await snapshot(), BEFORE);
  t("R15 and that bucket was not empty — an equality over nothing is not evidence", BEFORE.length >= 8, true);

  /* The deployment config is where a binding is granted. */
  const cfg = readFileSync(fileURLToPath(new URL("../wrangler.jsonc", import.meta.url)), "utf8");
  t("R15 the config grants CAPTURES and no other binding: no durable_objects (STORE), no PUBLISHED",
    [[...cfg.matchAll(/"binding":\s*"([A-Z_]+)"/g)].map((m) => m[1]), /durable_objects/.test(cfg), /PUBLISHED/.test(cfg.replace(/\/\/[^\n]*/g, ""))],
    [["CAPTURES"], false, false]);
  /* R15's own clause is about the SOURCES: no write call appears in them. Read with comments removed. */
  const SRC = fileURLToPath(new URL("../src/", import.meta.url));
  const own = readdirSync(SRC).filter((f) => f.endsWith(".mjs") && f !== "tesslib.mjs");
  const code = own.map((f) => readFileSync(SRC + f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1")).join("\n");
  t("R15 the sources read are this member's own (six modules, not an empty corpus)",
    [own.sort(), code.length > 10000], [["contract.mjs", "frame.mjs", "index.mjs", "member.mjs", "pngsamples.mjs", "tessengine.mjs"], true]);
  t("R15 no .put, .delete, .createMultipartUpload or .resumeMultipartUpload call in them",
    [...code.matchAll(/\.(put|delete|createMultipartUpload|resumeMultipartUpload)\s*\(/g)].map((m) => m[1]), []);
  /* The generated vendor glue is the vendor's code, accounted for rather than waved past: its only write-shaped
     calls are emscripten destructors on the engine's own handles and a JS Set, and it reaches no binding. */
  const glue = readFileSync(SRC + "tesslib.mjs", "utf8");
  t("R15 the vendor glue's only write-shaped calls are an emscripten destructor pair and a JS Set",
    [...glue.matchAll(/([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\.delete\s*\(/g)].map((m) => m[1]).sort(),
    ["engineImage", "listeners", "this._engine"]);
  t("R15 and it has no .put and reaches no Workers binding",
    [/\.put\s*\(/.test(glue), /\benv\s*\.\s*(CAPTURES|STORE|PUBLISHED)\b/.test(glue)], [false, false]);
}

console.log("\n--- B7 · R20: no place is named in behaviour ---");
{
  /* The one place-name the member may carry is the citation of the measurement `measured_by` rests on. Every wire
     answer this suite saw, in both parts, is searched with that citation removed — and with the transcribed text
     removed, which is the DOCUMENT's words (the real page is a council resolution), not the member's. */
  const text = WIRE.map((b) => JSON.stringify({ ...b, measured_by: undefined, pages: undefined })).join("\n");
  t("R20 the answers read were many", WIRE.length > 100, true);
  t("R20 no wire answer names a place outside the measurement citation", /oakland|alameda|legistar|california/i.test(text), false);
  t("R20 and the citation is provenance, the same string in every answer",
    [...new Set(WIRE.filter((b) => b.measured_by).map((b) => b.measured_by))], [MEASURED_BY]);
}

console.log("\n--- B8 · the words rule: each refusal read through localize under its own id (K874, K3949) ---");
{
  /* Each id the words check assigned to a refusal text, named here so every id has a test. The text itself is
     never held by the suite (K3810): the check is that the refusal is a sentence the id reads, present and
     non-blank, and that the wire answer carries it (the refusal tests above). Whether the word table holds a row
     for the id is the words check's, not this suite's. */
  const READ_BY_ID = [
    ["ocr-worker.contract.store_must_be_named_this", REFUSALS.BAD_STORE],
    ["ocr-worker.contract.no_namespace_by_that_name", REFUSALS.NAMESPACE_UNKNOWN],
    ["ocr-worker.contract.pages_must_be_a_non", REFUSALS.BAD_PAGES],
    ["ocr-worker.contract.no_capture_with_that", REFUSALS.NOT_FOUND],
    ["ocr-worker.contract.the_page_could_not", REFUSALS.PAGE_NOT_RENDERABLE],
    ["ocr-worker.contract.this_page_s_frame_is", REFUSALS.FRAME_OVER_MEASURED_BOUND],
    ["ocr-worker.contract.the_rendered_container_could_not", REFUSALS.PIXELS_UNREADABLE],
    ["ocr-worker.contract.the_engine_refused_or_failed", REFUSALS.ENGINE_FAILED],
    ["ocr-worker.contract.the_engine_returned_no_anchorable", REFUSALS.NOTHING_TRANSCRIBED],
    ["ocr-worker.contract.a_picture_is_a_one", REFUSALS.NO_SUCH_PAGE],
    ["ocr-worker.pngsamples.a_scanline_uses_a_filter", PNG_REFUSALS.PNG_FILTER_UNSUPPORTED],
    ["ocr-worker.pngsamples.the_inflated_raster_is_shorter", PNG_REFUSALS.PNG_SHORT_RASTER],
  ];
  for (const [id, text] of READ_BY_ID)
    t(`${id} names a non-blank refusal sentence`, typeof text === "string" && text.trim().length > 0, true);
}

footReached = true;
await mf.dispose();
} finally {
  globalThis.fetch = realFetch;
}

console.log(`\nocr-worker: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
