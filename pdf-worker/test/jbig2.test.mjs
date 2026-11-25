/* JBIG2Decode: R25 (JBIG2), with R19, R20, R24's 1-bit rule, R26, R39 and R40 as
 * they apply to it, and R31/R32 for a cropped JBIG2 image. build/requirements/
 * pdf-pixels.md.
 *
 * INDEPENDENT EXPECTATIONS (R25, R40). Every expected picture is jbig2dec 0.20's
 * decode of the same stream, written by `fixtures/make-jbig2-fixtures.py` into
 * `fixtures/jbig2-variants.json` on 2026-09-26; jbig2dec shares no line with
 * `jbig2decode.mjs`. The streams come from a production scanner (the seven pages
 * of an enacted ordinance, byte for byte), from jbig2enc, and from the fixture
 * script's own encoder written from T.88; the script keeps a stream only when
 * jbig2dec decodes it without error to exactly the picture encoded. Two
 * fixtures are marked `construction_sha256`: jbig2dec cannot decode one
 * (an intermediate generic region, its "NYI") and departs from T.88 on the
 * other (a refinement region away from the page's origin); their expected
 * picture is the one encoded, and jbig2dec's answer is recorded beside it.
 * If a fixture changes, re-run the script; never copy a failing run's output.
 *
 * FIXTURE `jbig2-scan-page.pdf` wraps the exact image and /JBIG2Globals streams
 * of the ordinance's page 2 (2560x3360, a symbol dictionary and one text region)
 * with its own MediaBox and content stream. */
import "../../bio-plane/test/sandbox.mjs";

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { deflateSync } from "node:zlib";
import { renderPageToPixels, REFUSALS } from "../src/pagepixels.mjs";
import { JBIG2_REFUSES } from "../src/jbig2decode.mjs";
import { cropImage } from "../src/imagecrop.mjs";
import { onePage, readPng, turn, hex, runner } from "./make-pdf.mjs";

const { Miniflare } = await (async () => {
  try { return await import("miniflare"); } catch { /* fall through */ }
  const planePkg = fileURLToPath(new URL("../../bio-plane/package.json", import.meta.url));
  return await import(pathToFileURL(createRequire(planePkg).resolve("miniflare")).href);
})();

const F = (p) => new Uint8Array(readFileSync(fileURLToPath(new URL(p, import.meta.url))));
const { t, finish } = runner("jbig2");
const answers = [];
const render = async (...a) => { const r = await renderPageToPixels(...a); answers.push(r); return r; };
const fields = (r, ...k) => k.map((x) => r[x]);

const FIX = JSON.parse(Buffer.from(F("fixtures/jbig2-variants.json")).toString("utf8"));
const V = FIX.variants;
const b64 = (s) => (s == null ? null : new Uint8Array(Buffer.from(s, "base64")));
const variant = (name) => V.find((v) => v.name === name);
const SCAN = F("fixtures/jbig2-scan-page.pdf");

/** A one-page document painting one JBIG2 image across its box, with its
 *  globals (when given) as object 6. */
function jbig2Page(stream, globals, w, h, { extra = "", filter = "/JBIG2Decode", pageExtra = "", parms } = {}) {
  const dp = parms ?? (globals ? "/DecodeParms << /JBIG2Globals 6 0 R >>" : "");
  return onePage({
    box: [0, 0, w, h], res: "/XObject << /Im 5 0 R >>", pageExtra, ops: `q ${w} 0 0 ${h} 0 0 cm /Im Do Q`,
    more: [
      { dict: `<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceGray /BitsPerComponent 1 /Filter ${filter} ${dp} ${extra} >>`, data: stream },
      ...(globals ? [{ dict: "<< >>", data: globals }] : []),
    ],
  });
}
const pageOf = (v, opts) => jbig2Page(b64(v.stream_b64), b64(v.globals_b64), v.width, v.height, opts);

console.log(`\n--- R25: the fixture corpus (${FIX.provenance}) ---`);
{
  const ok = V.filter((v) => v.expect === "ok"), no = V.filter((v) => v.expect !== "ok");
  t("R25 (the corpus: 94 decodable, 14 refused or cut short)", [ok.length, no.length], [94, 14]);
  const features = new Set(ok.flatMap((v) => v.features));
  for (const f of ["generic region, arithmetic, template 0", "generic region, arithmetic, template 1",
    "generic region, arithmetic, template 2", "generic region, arithmetic, template 3", "TPGDON", "AT moved",
    "generic region, MMR", "generic refinement region, template 0", "generic refinement region, template 1", "TPGRON",
    "symbol dictionary, arithmetic, template 0", "symbol dictionary, arithmetic, template 3", "symbol dictionary, refinement/aggregate",
    "symbol dictionary, Huffman", "text region, Huffman", "text region, arithmetic, refinement", "TRANSPOSED",
    "custom Huffman table", "pattern dictionary", "halftone region", "HENABLESKIP", "intermediate text region",
    "intermediate generic region", "page of unknown height", "end of stripe", "data length unknown (7.2.7)",
    "a production scanner's symbol dictionary and text region", "globals"]) {
    t(`R25 (the corpus exercises: ${f})`, features.has(f), true);
  }
}

console.log("\n--- R25, R26, R40: every decodable fixture through the renderer, against jbig2dec ---");
{
  for (const v of V.filter((x) => x.expect === "ok")) {
    const r = await render(pageOf(v), 0);
    const src = v.construction_sha256 ? "the picture encoded (T.88; see the fixture's note)" : "jbig2dec's picture";
    t(`R25 R40 ${v.name}: decoded-jbig2, ${src}`, [r.ok ? r.route : r.reason, r.width, r.height, r.upright, r.pixels_sha256],
      ["decoded-jbig2", v.width, v.height, true, v.pdf_samples_sha256]);
  }
}

console.log("\n--- R20, R25, R26, R40: the scanned page, a symbol dictionary in /JBIG2Globals ---");
{
  const want = variant("ordinance-page-2");
  const r = await render(SCAN, 0);
  t("R20 the success shape", Object.keys(r).sort(), ["bytes", "height", "jbig2", "mediaType", "ok", "page", "page_geometry",
    "page_marks", "pixels_sha256", "rotate_deg", "route", "source", "turned_deg", "upright", "width"]);
  t("R20 R25 route, media type, size", fields(r, "ok", "route", "mediaType", "width", "height", "upright", "rotate_deg"),
    [true, "decoded-jbig2", "image/png", 2560, 3360, true, 0]);
  t("R20 source", r.source, { filters: ["JBIG2Decode"], colorSpace: "DeviceGray", bitsPerComponent: 1, imageMask: false });
  t("R25 R40 the pixels are jbig2dec's", r.pixels_sha256, want.pdf_samples_sha256);
  const png = readPng(r.bytes);
  t("R25 a 1-bit grey PNG", [png.width, png.height, png.bitDepth, png.colorType], [2560, 3360, 1, 0]);
  t("R26 pixels_sha256 is the digest of the PNG's packed samples", hex(png.samples), r.pixels_sha256);
  let black = 0;
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) black += 1 - ((png.samples[y * png.rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1);
  t("R25 R40 the black-pixel count is jbig2dec's", black, want.black);
  t("R25 the decoder names what it decoded", r.jbig2.decoded,
    ["page information", "symbol dictionary, arithmetic", "text region, arithmetic"]);
  t("R25 and the globals were read", [r.jbig2.global_segments, r.jbig2.globals_bytes > 0], [1, true]);
}

console.log("\n--- R24, R25: 1-bit samples, /Decode and /ImageMask ---");
{
  const v = variant("generic-odd-width");
  const plain = await render(pageOf(v), 0);
  const inv = await render(pageOf(v, { extra: "/Decode [1 0]" }), 0);
  const plainPng = readPng(plain.bytes), invPng = readPng(inv.bytes);
  const pad = (u) => { const rb = Math.ceil(v.width / 8), m = (0xff << (rb * 8 - v.width)) & 0xff; const o = Uint8Array.from(u); for (let y = 0; y < v.height; y++) o[y * rb + rb - 1] &= m; return o; };
  t("R24 R25 /Decode [1 0] gives the complement", hex(invPng.samples), hex(pad(plainPng.samples.map((b) => ~b & 0xff))));
  /* PDF 32000-1 8.9.6.2: an image mask's sample 0 paints. MuPDF 1.28.2 renders a
     /ImageMask of all-0 samples black (checked 2026-09-26), so the mask's PNG is
     its samples, like DeviceGray's. */
  const mask = await render(jbig2Page(b64(v.stream_b64), null, v.width, v.height, { extra: "/ImageMask true" }), 0);
  t("R24 R25 an /ImageMask: the same samples as DeviceGray (0 paints, and is black)", mask.pixels_sha256, plain.pixels_sha256);
}

console.log("\n--- R21, R25: the page's /Rotate ---");
{
  const v = variant("generic-odd-width");
  const up = readPng((await render(pageOf(v), 0)).bytes);
  const bit = (x, y) => (up.samples[y * up.rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1;
  for (const deg of [90, 180, 270]) {
    const r = await render(pageOf(v, { pageExtra: `/Rotate ${deg}` }), 0);
    const png = readPng(r.bytes);
    const tr = turn(bit, v.width, v.height, deg);
    let same = png.width === tr.W && png.height === tr.H;
    for (let Y = 0; same && Y < tr.H; Y++) for (let X = 0; X < tr.W; X++)
      if (((png.samples[Y * png.rowBytes + (X >> 3)] >> (7 - (X & 7))) & 1) !== tr.at(X, Y)) { same = false; break; }
    t(`R21 R25 /Rotate ${deg}: the picture turned, upright`, [r.route, r.upright, r.rotate_deg, same], ["decoded-jbig2", true, deg, true]);
    t(`R26 /Rotate ${deg}: pixels_sha256 over the turned samples`, r.pixels_sha256, hex(png.samples));
  }
}

console.log("\n--- R25: the filter chain, the globals, the declared size ---");
{
  const v = variant("symbols-arith-t0");
  const s = b64(v.stream_b64), g = b64(v.globals_b64);
  const fl = await render(jbig2Page(deflateSync(s), g, v.width, v.height,
    { filter: "[/FlateDecode /JBIG2Decode]", parms: "/DecodeParms [null << /JBIG2Globals 6 0 R >>]" }), 0);
  t("R25 FlateDecode before JBIG2Decode is decoded first: the same picture", [fl.ok, fl.pixels_sha256], [true, v.pdf_samples_sha256]);
  const ah = await render(jbig2Page(new TextEncoder().encode(Buffer.from(s).toString("hex") + ">"), g, v.width, v.height,
    { filter: "[/ASCIIHexDecode /JBIG2Decode]", parms: "/DecodeParms [null << /JBIG2Globals 6 0 R >>]" }), 0);
  t("R25 any other predecessor: UNSUPPORTED_FILTER", fields(ah, "ok", "reason", "filter"), [false, "UNSUPPORTED_FILTER", "JBIG2Decode"]);
  const noG = await render(jbig2Page(s, null, v.width, v.height), 0);
  t("R25 the dictionary the page needs is not there (no globals): DECODE_FAILED", fields(noG, "ok", "reason", "jbig2"), [false, "DECODE_FAILED", "CORRUPT"]);
  const lostG = await render(jbig2Page(s, null, v.width, v.height, { parms: "/DecodeParms << /JBIG2Globals 9 0 R >>" }), 0);
  t("R25 a /JBIG2Globals that cannot be read: IMAGE_UNREADABLE", fields(lostG, "ok", "reason"), [false, "IMAGE_UNREADABLE"]);
  const wide = await render(jbig2Page(s, g, v.width + 1, v.height), 0);
  t("R25 a page wider than the image declares: DECODE_FAILED", fields(wide, "ok", "reason"), [false, "DECODE_FAILED"]);
  const tall = await render(jbig2Page(s, g, v.width, v.height + 5), 0);
  t("R25 a page shorter than the image declares: TRUNCATED_IMAGE_DATA", fields(tall, "ok", "reason", "declaredHeight", "rowsDecoded"),
    [false, "TRUNCATED_IMAGE_DATA", v.height + 5, v.height]);
  const bpc8 = await render(onePage({ box: [0, 0, v.width, v.height], res: "/XObject << /Im 5 0 R >>", ops: `q ${v.width} 0 0 ${v.height} 0 0 cm /Im Do Q`,
    more: [{ dict: `<< /Type /XObject /Subtype /Image /Width ${v.width} /Height ${v.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /JBIG2Decode /DecodeParms << /JBIG2Globals 6 0 R >> >>`, data: s }, { dict: "<< >>", data: g }] }), 0);
  t("R25 a JBIG2 image declared 8 bits per sample: UNSUPPORTED_SAMPLES", fields(bpc8, "ok", "reason"), [false, "UNSUPPORTED_SAMPLES"]);
}

console.log("\n--- R25, R39: what the decoder refuses, by name, and what is cut short ---");
{
  const want = { UNSUPPORTED: "UNSUPPORTED_FILTER", TRUNCATED: "TRUNCATED_IMAGE_DATA", CORRUPT: "DECODE_FAILED" };
  const named = new Set();
  for (const v of V.filter((x) => x.expect !== "ok")) {
    const [code, what] = [v.name.slice(0, v.name.indexOf(":")), v.name.slice(v.name.indexOf(":") + 1)];
    const r = await render(jbig2Page(b64(v.stream_b64), b64(v.globals_b64), 260, 260), 0);
    if (code === "UNSUPPORTED") {
      named.add(r.feature);
      t(`R25 ${what}: UNSUPPORTED_FILTER naming the feature`, fields(r, "ok", "reason", "filter", "feature", "bytes"),
        [false, "UNSUPPORTED_FILTER", "JBIG2Decode", what, undefined]);
      t(`R25 ${what}: and the segment type it arose in (K43)`, Number.isInteger(r.segmentType) && Number.isInteger(r.segment), true);
    } else {
      t(`R25 ${what}: ${want[code]}`, fields(r, "ok", "reason", "jbig2", "bytes"), [false, want[code], code, undefined]);
    }
  }
  t("R25 every refusal JBIG2_REFUSES declares was driven", [...named].sort(), Object.keys(JBIG2_REFUSES).sort());
}

console.log("\n--- R31, R32: a JBIG2 image, cropped ---");
{
  const v = variant("symbols-arith-t0");
  const c = await cropImage(pageOf(v), { kind: "image", page: 0, rect: [0, 0, v.width, v.height] });
  t("R31 R32 the crop is the decoded image, not turned", fields(c, "ok", "derived", "route", "width", "height", "upright", "pixels_sha256"),
    [true, true, "decoded-jbig2", v.width, v.height, true, v.pdf_samples_sha256]);
  t("R32 file_sha256 is the returned bytes' digest", c.file_sha256, hex(c.bytes));
}

console.log("\n--- R40: pure per call, and the same pixels in workerd ---");
{
  const key = (r) => JSON.stringify({ ...r, bytes: r.bytes ? hex(r.bytes) : null });
  const a = await render(SCAN, 0), b = await render(SCAN, 0);
  t("R40 the scanned page: the same answer twice", key(a) === key(b), true);
  let bundled = null, why = null;
  try {
    const esbuild = await (async () => {
      try { return await import("esbuild"); } catch { /* fall through */ }
      const planePkg = fileURLToPath(new URL("../../bio-plane/package.json", import.meta.url));
      return await import(pathToFileURL(createRequire(planePkg).resolve("esbuild")).href);
    })();
    const out = await esbuild.build({
      stdin: {
        contents: `import { renderPageToPixels } from ${JSON.stringify(fileURLToPath(new URL("../src/pagepixels.mjs", import.meta.url)))};
export default { async fetch(req) {
  const r = await renderPageToPixels(new Uint8Array(await req.arrayBuffer()), 0);
  return Response.json(r.ok ? { ok: true, route: r.route, width: r.width, height: r.height, pixels_sha256: r.pixels_sha256 } : r);
} };`,
        resolveDir: fileURLToPath(new URL(".", import.meta.url)), sourcefile: "jbig2-under-test.mjs",
      },
      bundle: true, write: false, format: "esm", platform: "neutral", external: ["cloudflare:workers", "node:*"],
    });
    bundled = out.outputFiles[0].text;
  } catch (e) { why = String(e && e.message || e).split("\n")[0]; }
  t("R40 (the workerd arm could be built)", why, null);
  if (bundled) {
    const mf = new Miniflare({ modules: true, modulesRoot: "/", script: bundled, scriptPath: "/jbig2-under-test.mjs",
      compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"] });
    try {
      const t0 = performance.now();
      const j = await (await mf.dispatchFetch("http://x/", { method: "POST", body: SCAN })).json();
      console.log(`  (workerd: the scanned page in ${(performance.now() - t0).toFixed(0)} ms WALL in the harness — not a Worker CPU figure)`);
      t("R40 workerd: the scanned page, jbig2dec's pixels", [j.ok, j.route, j.width, j.height, j.pixels_sha256],
        [true, "decoded-jbig2", 2560, 3360, variant("ordinance-page-2").pdf_samples_sha256]);
      const hv = variant("halftone-t0-skip");
      const jh = await (await mf.dispatchFetch("http://x/", { method: "POST", body: pageOf(hv) })).json();
      t("R40 workerd: a halftone, jbig2dec's pixels", [jh.ok, jh.pixels_sha256], [true, hv.pdf_samples_sha256]);
    } finally { await mf.dispose(); }
  }
}

console.log("\n--- R39: every refusal is declared, in its own words ---");
{
  const refusals = answers.filter((r) => r && r.ok === false);
  console.log(`  (${refusals.length} refusals over ${new Set(refusals.map((r) => r.reason)).size} reasons)`);
  t("R39 every reason is a key of REFUSALS", refusals.filter((r) => !(r.reason in REFUSALS)).map((r) => r.reason), []);
  t("R39 every why is exactly that key's text", refusals.filter((r) => r.why !== REFUSALS[r.reason]).map((r) => r.reason), []);
  t("R39 no refusal carries bytes", refusals.filter((r) => "bytes" in r).length, 0);
}

finish();
