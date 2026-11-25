/* JPXDecode: R25 (JPX), with R19, R20, R21, R26, R39 and R40 as they apply to
 * it, and R31/R32 for a cropped JPX image. build/requirements/pdf-pixels.md.
 *
 * INDEPENDENT EXPECTATIONS (R25, R40). Every expected picture is opj_decompress's
 * (OpenJPEG 2.5.0) decode of the same bytes, each checked against PyMuPDF's
 * reading before it was kept, written by `fixtures/make-jpx-fixtures.py` into
 * `fixtures/jpx-variants.json` on 2026-09-26. Neither shares a line with
 * `jpxdecode.mjs`. The irreversible (9/7) fixtures matter most: JPEG 2000 does
 * not define that path to the bit, so they pin this decoder to OpenJPEG's own
 * float arithmetic. If a fixture changes, re-run the script; never copy a
 * failing run's output.
 *
 * FIXTURE `jpx-scan-page.pdf`: a page of an enacted ordinance (from the committed
 * JBIG2 fixture, through jbig2dec), softened to grey and stored as one 1280x1680
 * irreversible JPEG 2000 image, the size class a scanner writes. */
import "../../bio-plane/test/sandbox.mjs";

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { deflateSync } from "node:zlib";
import { renderPageToPixels, REFUSALS } from "../src/pagepixels.mjs";
import { JPX_REFUSES, JpxRefusal, decodeJpx, MEMORY_FEATURE } from "../src/jpxdecode.mjs";
import { cropImage } from "../src/imagecrop.mjs";
import { onePage, readPng, turn, hex, runner } from "./make-pdf.mjs";

const { Miniflare } = await (async () => {
  try { return await import("miniflare"); } catch { /* fall through */ }
  const planePkg = fileURLToPath(new URL("../../bio-plane/package.json", import.meta.url));
  return await import(pathToFileURL(createRequire(planePkg).resolve("miniflare")).href);
})();

const F = (p) => new Uint8Array(readFileSync(fileURLToPath(new URL(p, import.meta.url))));
const { t, finish } = runner("jpx");
const answers = [];
const render = async (...a) => { const r = await renderPageToPixels(...a); answers.push(r); return r; };
const fields = (r, ...k) => k.map((x) => r[x]);

const FIX = JSON.parse(Buffer.from(F("fixtures/jpx-variants.json")).toString("utf8"));
const V = FIX.variants;
const bytesOf = (v) => new Uint8Array(Buffer.from(v.data_b64, "base64"));
const variant = (name) => V.find((v) => v.name === name);
const SCAN = F("fixtures/jpx-scan-page.pdf");
const SCAN_SHA = "d0b7e92ec2cf66468fe13996e64b8a667ab0f3bc886b13e670c0be55d5b81ebd";   // opj_decompress, by the script

/** A one-page document painting one JPX image across its box. */
function jpxPage(data, w, h, { cs = null, extra = "", filter = "/JPXDecode", pageExtra = "", more = [] } = {}) {
  return onePage({
    box: [0, 0, w, h], res: "/XObject << /Im 5 0 R >>", pageExtra, ops: `q ${w} 0 0 ${h} 0 0 cm /Im Do Q`,
    more: [{ dict: `<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} ${cs ? `/ColorSpace ${cs}` : ""} /Filter ${filter} ${extra} >>`, data }, ...more],
  });
}
const pageOf = (v, opts) => jpxPage(bytesOf(v), v.width, v.height, opts);

console.log(`\n--- R25: the fixture corpus (${FIX.provenance}) ---`);
{
  const ok = V.filter((v) => v.expect === "ok"), no = V.filter((v) => v.expect !== "ok");
  t("R25 (the corpus: 114 decodable, 13 refused or cut short)", [ok.length, no.length], [114, 13]);
  const names = ok.map((v) => v.name).join(" ");
  for (const f of ["5-3-levels-0", "9-7-levels-5", "9-7-lossy-layers", "cblk-4x4", "precincts", "progression-LRCP",
    "progression-RLCP", "progression-RPCL", "progression-PCRL", "progression-CPRL", "offsets-tiles", "mode-bypass",
    "mode-reset", "mode-termall", "mode-vsc", "mode-pterm", "mode-segsym", "mode-all-9-7", "sop-eph", "tile-parts",
    "image-offset", "poc", "roi-9-7", "plt-tlm", "no-colour-transform", "tiny-1x1", "tiny-1x9", "pillow-lossy-rgb", "derived-quantisation"]) {
    t(`R25 (the corpus exercises: ${f})`, names.includes(f), true);
  }
  t("R25 (both containers: JP2 and a bare codestream)", [...new Set(ok.map((v) => v.container))].sort(), ["j2k", "jp2"]);
}

console.log("\n--- R25, R26, R40: every decodable fixture through the renderer, against OpenJPEG ---");
{
  for (const v of V.filter((x) => x.expect === "ok")) {
    const r = await render(pageOf(v), 0);
    t(`R25 R40 ${v.name}: decoded-jpx, OpenJPEG's picture`, [r.ok ? r.route : r.reason, r.width, r.height, r.upright, r.pixels_sha256],
      ["decoded-jpx", v.width, v.height, true, v.opj_sha256]);
  }
}

console.log("\n--- R20, R25, R26, R40: the scanned page ---");
{
  const r = await render(SCAN, 0);
  t("R20 the success shape", Object.keys(r).sort(), ["bytes", "height", "jpx", "mediaType", "ok", "page", "page_geometry",
    "page_marks", "pixels_sha256", "rotate_deg", "route", "source", "turned_deg", "upright", "width"]);
  t("R20 R25 route, media type, size", fields(r, "ok", "route", "mediaType", "width", "height", "upright"),
    [true, "decoded-jpx", "image/png", 1280, 1680, true]);
  t("R25 R40 the pixels are OpenJPEG's", r.pixels_sha256, SCAN_SHA);
  const png = readPng(r.bytes);
  t("R25 an 8-bit grey PNG", [png.width, png.height, png.bitDepth, png.colorType], [1280, 1680, 8, 0]);
  t("R26 pixels_sha256 is the digest of the PNG's samples", hex(png.samples), r.pixels_sha256);
  t("R25 the decoder names what it decoded", fields(r.jpx, "container", "transform", "levels", "comps"), ["jp2", "9/7", 5, 1]);
}

console.log("\n--- R21, R25: the page's /Rotate ---");
{
  const v = variant("9-7-levels-2-rgb");
  const up = readPng((await render(pageOf(v), 0)).bytes);
  const px = (x, y) => [...up.samples.subarray((y * v.width + x) * 3, (y * v.width + x) * 3 + 3)];
  for (const deg of [90, 180, 270]) {
    const r = await render(pageOf(v, { pageExtra: `/Rotate ${deg}` }), 0);
    const png = readPng(r.bytes);
    const tr = turn(px, v.width, v.height, deg);
    const want = [];
    for (let Y = 0; Y < tr.H; Y++) for (let X = 0; X < tr.W; X++) want.push(...tr.at(X, Y));
    t(`R21 R25 /Rotate ${deg}: the picture turned, upright`, [r.route, r.upright, r.rotate_deg, png.width, png.height, hex(png.samples)],
      ["decoded-jpx", true, deg, tr.W, tr.H, hex(Uint8Array.from(want))]);
    t(`R26 /Rotate ${deg}: pixels_sha256 over the turned samples`, r.pixels_sha256, hex(png.samples));
  }
}

console.log("\n--- R25: the PDF's colour space, /Decode and the filter chain ---");
{
  const g = variant("5-3-levels-2-grey"), c = variant("5-3-levels-2-rgb");
  const icc = (n) => ({ dict: `<< /N ${n} >>`, data: new Uint8Array(8) });
  for (const [label, v, cs, more, ok] of [
    ["no /ColorSpace: the file's own", g, null, [], true],
    ["/DeviceGray on a grey image", g, "/DeviceGray", [], true],
    ["/DeviceRGB on a colour image", c, "/DeviceRGB", [], true],
    ["an ICCBased /N 3 on a colour image", c, "[/ICCBased 6 0 R]", [icc(3)], true],
    ["an ICCBased /N 1 on a grey image", g, "[/ICCBased 6 0 R]", [icc(1)], true],
  ]) {
    const r = await render(pageOf(v, { cs, more }), 0);
    t(`R25 ${label}: decoded`, [r.ok, r.pixels_sha256], [ok, v.opj_sha256]);
  }
  for (const [label, v, cs, more] of [
    ["/DeviceRGB on a grey image", g, "/DeviceRGB", []],
    ["/DeviceGray on a colour image", c, "/DeviceGray", []],
    ["/DeviceCMYK", c, "/DeviceCMYK", []],
    ["an /Indexed colour space", g, "[/Indexed /DeviceRGB 1 <000000ffffff>]", []],
    ["an ICCBased /N 4", c, "[/ICCBased 6 0 R]", [icc(4)]],
  ]) {
    const r = await render(pageOf(v, { cs, more }), 0);
    t(`R25 ${label}: UNSUPPORTED_SAMPLES`, fields(r, "ok", "reason", "bytes"), [false, "UNSUPPORTED_SAMPLES", undefined]);
  }
  const dec = await render(pageOf(g, { extra: "/Decode [1 0]" }), 0);
  t("R25 a /Decode array: UNSUPPORTED_SAMPLES, not silently ignored", fields(dec, "ok", "reason"), [false, "UNSUPPORTED_SAMPLES"]);
  const mask = await render(pageOf(g, { extra: "/ImageMask true" }), 0);
  t("R25 a JPX /ImageMask: UNSUPPORTED_SAMPLES", fields(mask, "ok", "reason"), [false, "UNSUPPORTED_SAMPLES"]);
  const fl = await render(jpxPage(deflateSync(bytesOf(g)), g.width, g.height, { filter: "[/FlateDecode /JPXDecode]" }), 0);
  t("R25 FlateDecode before JPXDecode is decoded first: the same picture", [fl.ok, fl.pixels_sha256], [true, g.opj_sha256]);
  const ah = await render(jpxPage(new TextEncoder().encode(Buffer.from(bytesOf(g)).toString("hex") + ">"), g.width, g.height,
    { filter: "[/ASCIIHexDecode /JPXDecode]" }), 0);
  t("R25 any other predecessor: UNSUPPORTED_FILTER", fields(ah, "ok", "reason", "filter"), [false, "UNSUPPORTED_FILTER", "JPXDecode"]);
  const wide = await render(jpxPage(bytesOf(g), g.width + 1, g.height), 0);
  t("R25 an image the PDF declares a different size: DECODE_FAILED", fields(wide, "ok", "reason"), [false, "DECODE_FAILED"]);
}

console.log("\n--- R25, R39: what the decoder refuses, by name, and what is cut short ---");
{
  const want = { UNSUPPORTED: "UNSUPPORTED_FILTER", UNSUPPORTED_SAMPLES: "UNSUPPORTED_SAMPLES", TRUNCATED: "TRUNCATED_IMAGE_DATA", CORRUPT: "DECODE_FAILED" };
  const named = new Set();
  for (const v of V.filter((x) => x.expect !== "ok")) {
    const code = v.name.slice(0, v.name.indexOf(":")), what = v.name.slice(v.name.indexOf(":") + 1);
    const r = await render(jpxPage(bytesOf(v), 97, 61), 0);
    if (code === "UNSUPPORTED") {
      named.add(r.feature);
      t(`R25 ${what}: UNSUPPORTED_FILTER naming the feature`, fields(r, "ok", "reason", "filter", "feature", "bytes"),
        [false, "UNSUPPORTED_FILTER", "JPXDecode", what, undefined]);
    } else {
      t(`R25 ${what}: ${want[code]}`, fields(r, "ok", "reason", "jpx", "bytes"), [false, want[code], code, undefined]);
    }
  }
  /* The memory bound (N34, K116): a bare codestream whose SIZ declares one tile of
     the given size, patched into a small fixture. What the working set counts is
     image-codecs' to state (its R4, N75), so the figures expected are the codec's
     own refusal of the same bytes, never a formula restated here. The sizes are
     those the codec refuses and admits (IMAGE-CODECS #2, J1): 5000x5000 colour
     and 8000x8000 grey past the bound, 5000x5000 grey within it. */
  const patched = (comps, size) => {
    const base = V.find((v) => v.expect === "ok" && v.container === "j2k" && v.name.endsWith(comps === 1 ? "-grey" : "-rgb"));
    const d = Uint8Array.from(bytesOf(base));
    const siz = d.findIndex((b, i) => b === 0xff && d[i + 1] === 0x51);
    const dv = new DataView(d.buffer);
    const found = [siz > 0, dv.getUint16(siz + 38)];
    for (const off of [6, 10, 22, 26]) dv.setUint32(siz + off, size);   // Xsiz, Ysiz, XTsiz, YTsiz
    for (const off of [14, 18, 30, 34]) dv.setUint32(siz + off, 0);     // the offsets
    return { d, found };
  };
  const codecRefusal = (d) => { try { decodeJpx(d); return null; } catch (e) { return e instanceof JpxRefusal ? e : null; } };
  for (const [comps, size, label] of [[3, 5000, "colour"], [1, 8000, "grey"]]) {
    const { d, found } = patched(comps, size);
    t(`R25 (a ${label} codestream with ${comps} component${comps > 1 ? "s" : ""} to patch)`, found, [true, comps]);
    const e = codecRefusal(d);
    t(`R25 (the codec refuses the ${size}x${size} ${label} image for memory, its working set past its bound)`,
      [e?.code, e?.detail.working_set_bytes > e?.detail.bound_bytes], ["IMAGE_TOO_LARGE", true]);
    const r = await render(jpxPage(d, size, size), 0);
    if (r.feature) named.add(r.feature);
    t(`R25 a ${size}x${size} ${label} image past the memory bound: IMAGE_TOO_LARGE with the codec's figures, no bytes`,
      fields(r, "ok", "reason", "filter", "working_set_bytes", "bound_bytes", "width", "height", "components", "bytes"),
      [false, "IMAGE_TOO_LARGE", "JPXDecode", e?.detail.working_set_bytes, e?.detail.bound_bytes, size, size, comps, undefined]);
  }
  {
    const { d, found } = patched(1, 5000);
    t("R25 (a grey codestream with 1 component to patch, 5000x5000)", found, [true, 1]);
    const r = await render(jpxPage(d, 5000, 5000), 0);
    t("R25 a 5000x5000 grey image within the memory bound is not refused for memory",
      [r.reason === "IMAGE_TOO_LARGE", "working_set_bytes" in r], [false, false]);
  }
  t("R25 every refusal JPX_REFUSES declares was driven", [...named].sort(), Object.keys(JPX_REFUSES).sort());
}

console.log("\n--- R31, R32: a JPX image, cropped ---");
{
  const v = variant("9-7-levels-2-rgb");
  const c = await cropImage(pageOf(v), { kind: "image", page: 0, rect: [0, 0, v.width, v.height] });
  t("R31 R32 the crop is the decoded image, not turned", fields(c, "ok", "derived", "route", "width", "height", "upright", "pixels_sha256"),
    [true, true, "decoded-jpx", v.width, v.height, true, v.opj_sha256]);
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
        resolveDir: fileURLToPath(new URL(".", import.meta.url)), sourcefile: "jpx-under-test.mjs",
      },
      bundle: true, write: false, format: "esm", platform: "neutral", external: ["cloudflare:workers", "node:*"],
    });
    bundled = out.outputFiles[0].text;
  } catch (e) { why = String(e && e.message || e).split("\n")[0]; }
  t("R40 (the workerd arm could be built)", why, null);
  if (bundled) {
    const mf = new Miniflare({ modules: true, modulesRoot: "/", script: bundled, scriptPath: "/jpx-under-test.mjs",
      compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"] });
    try {
      const t0 = performance.now();
      const j = await (await mf.dispatchFetch("http://x/", { method: "POST", body: SCAN })).json();
      console.log(`  (workerd: the scanned page in ${(performance.now() - t0).toFixed(0)} ms WALL in the harness — not a Worker CPU figure)`);
      t("R40 workerd: the scanned page, OpenJPEG's pixels", [j.ok, j.route, j.width, j.height, j.pixels_sha256],
        [true, "decoded-jpx", 1280, 1680, SCAN_SHA]);
      for (const name of ["mode-all-9-7-rgb", "progression-PCRL-offsets-tiles-rgb", "roi-9-7-grey"]) {
        const v = variant(name);
        const jv = await (await mf.dispatchFetch("http://x/", { method: "POST", body: pageOf(v) })).json();
        t(`R40 workerd: ${name}, OpenJPEG's pixels`, [jv.ok, jv.pixels_sha256], [true, v.opj_sha256]);
      }
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
