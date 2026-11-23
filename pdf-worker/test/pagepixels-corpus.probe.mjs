#!/usr/bin/env node
/* CPDF-12 — IS A PAGE OF PIXELS REACHABLE IN WORKERD, AND IS THE PICTURE REAL?
 *
 * NOT a test: a `.probe.mjs` is run by hand, and neither `npm test` in
 * `pdf-worker` nor any `node --test` glob reaches it. It reaches the network
 * and, with `--ocr`, installs an OCR engine into an OS temp directory. The
 * hermetic half of this work is `pdf-worker/test/pagepixels.test.mjs`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE GATE THAT WOULD CATCH THIS INSTRUMENT LYING
 * ─────────────────────────────────────────────────────────────────────────────
 * The subject here is a DECODER, and a decoder is the one kind of subject whose
 * failure looks exactly like success: it returns an image of the right size,
 * with ink in roughly the right places, and every summary statistic a probe
 * would naturally print — dimensions, byte count, ink fraction, "it decoded all
 * 2550 rows" — is satisfied by a picture that is subtly and permanently WRONG.
 * FL-1's self-timed arm read 0 ms where the platform billed 498.57 ms; a decoder
 * that drops one run per row reads as a clean decode of a page nobody checked.
 *
 * So no fidelity figure in this probe is produced by this probe's own code.
 * `recordFidelity()` THROWS unless the reading's provenance is an INDEPENDENT
 * decoder — a decoder that shares no line of source with `pagepixels.mjs` —
 * whose identity and version were captured in this run. The independent decoder
 * is Pillow (libtiff's CCITT G4) reached through pypdf, and its version string
 * is printed beside every figure. If it is absent, the probe reports NO NUMBER
 * and says so; it does not fall back to a self-check.
 *
 * The arm that exists to be refused is `--arm-selfcheck`: it offers a fidelity
 * reading whose provenance is `pagepixels.mjs` comparing its own output to
 * itself. It MUST be refused by the gate. Run it.
 *
 * ARMS
 *   (default)          corpus census + fidelity verification
 *   --corpus-only      census only, no rendering
 *   --ocr              END-TO-END: render with pagepixels, OCR the pixels, score
 *                      against CPDF-9's committed ground truth for page 2
 *   --workerd          run the renderer inside miniflare (workerd), the runtime
 *                      the placement question is actually about
 *   --arm-selfcheck    the refused-provenance control (must FAIL)
 *   --arm-blank        the blank-page control (a blank page must not read as ink)
 *
 * usage: node pdf-worker/test/pagepixels-corpus.probe.mjs [--ocr] [--workerd] …
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { renderPageToPixels, loadPdf, analyzePage, REFUSALS } from "../src/pagepixels.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const UA = "CivicOS/0.55.0 (+https://github.com/believeinoakland/bio; instance biosmoke7; acquire)";
const CACHE = join(tmpdir(), "cpdf12-corpus");
const WORK = mkdtempSync(join(tmpdir(), "cpdf12-"));
const sha = (b) => createHash("sha256").update(b).digest("hex");
const argv = new Set(process.argv.slice(2));

/* ── the provenance gate ──────────────────────────────────────────────────── */

/** The ONLY provenances a fidelity figure may carry. A reading produced by the
 *  subject about itself is not on this list, and cannot be added by a flag. */
const INDEPENDENT_DECODERS = new Set(["pillow+pypdf"]);
const FIDELITY = [];

function recordFidelity({ label, provenance, tool, verdict, detail }) {
  if (!INDEPENDENT_DECODERS.has(provenance)) {
    throw new Error(
      `REFUSED: fidelity reading "${label}" carries provenance "${provenance}", which is not an ` +
      `independent decoder. A decoder checked against itself agrees for free, and an outcome ` +
      `that costs nothing to produce is not evidence.`);
  }
  if (!tool || !/\d/.test(tool)) {
    throw new Error(`REFUSED: fidelity reading "${label}" names no VERSIONED tool (got ${JSON.stringify(tool)}).`);
  }
  FIDELITY.push({ label, provenance, tool, verdict, detail });
  return verdict;
}

/* ── the independent decoder ──────────────────────────────────────────────── */

function pythonProbe() {
  try {
    const out = execFileSync("python3", ["-c",
      "import pypdf,PIL,sys;print(pypdf.__version__+'/'+PIL.__version__)"],
      { encoding: "utf8" }).trim();
    return { ok: true, tool: `pypdf ${out.split("/")[0]} + Pillow ${out.split("/")[1]}` };
  } catch (e) {
    return { ok: false, why: String(e && e.message || e).split("\n")[0] };
  }
}

const VERIFY_PY = String.raw`
import sys, json, io, hashlib
from pypdf import PdfReader
from PIL import Image

pdf_path, page_idx, mine_path, kind = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]
reader = PdfReader(pdf_path)
page = reader.pages[page_idx]
res = page.get("/Resources")
xo = res.get("/XObject") if res is not None else None
names = list(xo.keys()) if xo is not None else []
out = {"names": names}
if not names:
    print(json.dumps({"verdict": "NO_IMAGE", **out})); raise SystemExit
obj = xo[names[0]].get_object()
mine = open(mine_path, "rb").read()
if kind == "dct":
    raw = obj._data                      # the encoded stream, untouched by pypdf
    out["ref_bytes"], out["mine_bytes"] = len(raw), len(mine)
    out["ref_sha"], out["mine_sha"] = hashlib.sha256(raw).hexdigest(), hashlib.sha256(mine).hexdigest()
    out["verdict"] = "BYTE_IDENTICAL" if raw == mine else "BYTES_DIFFER"
else:
    ref = list(page.images)[0].image.convert("1")
    # The renderer returns the page as a READER sees it, so the reference is
    # turned by the page's own /Rotate before comparison. transpose(), not
    # rotate(): a quarter turn must land a bit on a bit, and a resampling
    # rotation would introduce differences that are the harness's own.
    deg = int(page.get("/Rotate", 0) or 0) % 360
    if deg == 90:  ref = ref.transpose(Image.Transpose.ROTATE_270)
    elif deg == 180: ref = ref.transpose(Image.Transpose.ROTATE_180)
    elif deg == 270: ref = ref.transpose(Image.Transpose.ROTATE_90)
    out["page_rotate"] = deg
    got = Image.open(io.BytesIO(mine)).convert("1")
    out["ref_size"], out["mine_size"] = list(ref.size), list(got.size)
    if ref.size != got.size:
        out["verdict"] = "SIZE_MISMATCH"
    else:
        rb, gb = ref.tobytes(), got.tobytes()
        if rb == gb:
            out["verdict"] = "PIXEL_EXACT"
            out["sha"] = hashlib.sha256(rb).hexdigest()
        else:
            d = sum(bin(a ^ b).count("1") for a, b in zip(rb, gb))
            out["verdict"] = "PIXELS_DIFFER"
            out["differing_pixels"] = d
            out["total_pixels"] = ref.size[0] * ref.size[1]
print(json.dumps(out))
`;

function independentVerify(pdfPath, pageIdx, minePath, kind) {
  const script = join(WORK, "verify.py");
  writeFileSync(script, VERIFY_PY);
  const out = execFileSync("python3", [script, pdfPath, String(pageIdx), minePath, kind],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(out);
}

/* ── the corpus ───────────────────────────────────────────────────────────── */

async function fetchBytes(url) {
  const r = await fetch(url, { headers: { "user-agent": UA }, redirect: "follow" });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return new Uint8Array(await r.arrayBuffer());
}

/** Real Oakland PDFs: the attachments of the most recently modified Legistar
 *  matters, which is where the scanned class actually lives, plus the two
 *  image-only documents CPDF-5 already identified by name so the census can be
 *  compared with a measurement that exists. */
async function buildCorpus(limit) {
  mkdirSync(CACHE, { recursive: true });
  const wanted = [
    { id: "legistar-attach-15721260", url: "https://oakland.legistar.com/View.ashx?M=F&ID=15721260&GUID=8F04A287-4A49-44DC-83B7-29FAD97140C2" },
    { id: "budget-2pager", url: "https://cao-94612.s3.us-west-2.amazonaws.com/documents/v1-fy25-27-2-pager-oakland-budget-basics-fy-3.pdf" },
    { id: "legistar-agenda-1425405", url: "https://oakland.legistar.com/View.ashx?M=A&ID=1425405&GUID=86B6D25C-4D38-4101-BD37-13DF930A7950" },
  ];
  try {
    const matters = await (await fetch(
      "https://webapi.legistar.com/v1/oakland/matters?%24top=40&%24orderby=MatterLastModifiedUtc%20desc",
      { headers: { "user-agent": UA } })).json();
    for (const m of matters) {
      if (wanted.length >= limit) break;
      let atts = [];
      try {
        atts = await (await fetch(`https://webapi.legistar.com/v1/oakland/matters/${m.MatterId}/attachments`,
          { headers: { "user-agent": UA } })).json();
      } catch { continue; }
      for (const a of atts) {
        if (wanted.length >= limit) break;
        if (!a.MatterAttachmentHyperlink) continue;
        wanted.push({ id: `legistar-${a.MatterAttachmentId}`, url: a.MatterAttachmentHyperlink });
      }
    }
  } catch (e) {
    console.log(`  ! Legistar matter listing unavailable (${e.message}); census runs on the named documents only`);
  }

  const docs = [];
  for (const w of wanted) {
    const path = join(CACHE, `${w.id}.pdf`);
    try {
      if (!existsSync(path)) writeFileSync(path, await fetchBytes(w.url));
      const bytes = new Uint8Array(readFileSync(path));
      if (bytes[0] !== 0x25 || bytes[1] !== 0x50) continue;   // not a %PDF
      docs.push({ ...w, path, bytes, size: bytes.length });
    } catch { /* a document that will not fetch is not a finding about pages */ }
  }
  return docs;
}

/* ── the census ───────────────────────────────────────────────────────────── */

async function census(docs) {
  const rows = [];
  for (const d of docs) {
    let doc;
    try { doc = await loadPdf(d.bytes); } catch { doc = null; }
    if (!doc) { rows.push({ id: d.id, pages: 0, unreadable: true }); continue; }
    const enc = doc.isEncrypted();
    const pages = doc.pageCount;
    const per = [];
    for (let p = 0; p < pages; p++) {
      const a = await analyzePage(doc, p);
      if (!a) { per.push({ page: p, unreadable: true }); continue; }
      per.push({
        page: p,
        hasText: a.hasTextOps,
        hasVector: a.hasVectorOps,
        images: a.imageCount,
        filters: a.images.map((i) => i.filters.join("+")),
        rotate: ((a.rotate || 0) % 360 + 360) % 360,
        full: a.imageCount === 1 && !a.hasTextOps && !a.hasVectorOps,
      });
    }
    rows.push({ id: d.id, size: d.size, pages, encrypted: enc, per });
  }
  return rows;
}

function reportCensus(rows) {
  let pages = 0, imageOnly = 0, singleImage = 0, multi = 0, textPages = 0, vectorOnly = 0;
  const filterTally = new Map();
  const rotTally = new Map();
  for (const r of rows) {
    for (const p of r.per || []) {
      if (p.unreadable) continue;
      pages++;
      if (p.hasText) { textPages++; continue; }
      if (p.images === 0) { vectorOnly++; continue; }
      imageOnly++;
      if (p.images === 1) singleImage++; else multi++;
      for (const f of p.filters) {
        filterTally.set(f, (filterTally.get(f) || 0) + 1);
        const k = `${f} @ /Rotate ${p.rotate}`;
        rotTally.set(k, (rotTally.get(k) || 0) + 1);
      }
    }
  }
  console.log(`\nCENSUS — ${rows.length} real Oakland PDFs, ${pages} pages`);
  console.log(`  pages carrying a TEXT layer            ${textPages}`);
  console.log(`  pages with NO text and NO image        ${vectorOnly}   (vector marks or empty)`);
  console.log(`  pages that are IMAGE ONLY              ${imageOnly}`);
  console.log(`    of those, exactly ONE image          ${singleImage}` +
    (imageOnly ? `   (${(100 * singleImage / imageOnly).toFixed(1)}% of the image-only class)` : ""));
  console.log(`    of those, SEVERAL images             ${multi}`);
  if (filterTally.size) {
    console.log(`  filter chains on image-only pages:`);
    for (const [f, n] of [...filterTally].sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(5)}  ${f}`);
  }
  if (rotTally.size) {
    console.log(`  filter x page /Rotate — this is what sizes the un-rotatable class:`);
    for (const [k, n] of [...rotTally].sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(5)}  ${k}`);
  }
  return { pages, imageOnly, singleImage, multi, textPages, vectorOnly, filterTally, rotTally };
}

/* ── the rendering + fidelity arm ─────────────────────────────────────────── */

async function verifyRendering(docs, py) {
  console.log(`\nRENDER + INDEPENDENT VERIFICATION`);
  if (!py.ok) {
    console.log(`  NO NUMBER: the independent decoder is unavailable (${py.why}).`);
    console.log(`  This probe does not fall back to checking its own output against itself.`);
    return { checked: 0 };
  }
  console.log(`  independent decoder: ${py.tool}`);

  let checked = 0, exact = 0, differ = 0, refused = 0;
  const refusalTally = new Map();
  for (const d of docs) {
    const doc = await loadPdf(d.bytes);
    if (!doc) continue;
    const pages = doc.pageCount;
    for (let p = 0; p < pages; p++) {
      const a = await analyzePage(doc, p);
      if (!a || a.hasTextOps || a.imageCount !== 1 || a.hasVectorOps) continue;
      const r = await renderPageToPixels(d.bytes, p);
      if (!r.ok) {
        refused++;
        refusalTally.set(r.reason, (refusalTally.get(r.reason) || 0) + 1);
        continue;
      }
      const ext = r.mediaType === "image/jpeg" ? "jpg" : "png";
      const out = join(WORK, `${d.id}-p${p}.${ext}`);
      writeFileSync(out, r.bytes);
      let v;
      try { v = independentVerify(d.path, p, out, r.route.startsWith("passthrough") ? "dct" : "px"); }
      catch (e) { console.log(`    ${d.id} p${p}: independent decoder ERRORED — ${String(e.message).split("\n")[0]}`); continue; }
      checked++;
      const good = v.verdict === "PIXEL_EXACT" || v.verdict === "BYTE_IDENTICAL";
      if (good) exact++; else differ++;
      recordFidelity({
        label: `${d.id} p${p} (${r.route})`,
        provenance: "pillow+pypdf", tool: py.tool, verdict: v.verdict, detail: v,
      });
      if (!good) console.log(`    MISMATCH ${d.id} p${p} ${r.route}: ${JSON.stringify(v)}`);
    }
  }
  console.log(`  pages rendered and independently checked   ${checked}`);
  console.log(`  agreeing with the independent decoder      ${exact}`);
  console.log(`  DISAGREEING                                ${differ}`);
  console.log(`  pages the renderer REFUSED (stated)        ${refused}`);
  for (const [k, n] of [...refusalTally].sort((a, b) => b[1] - a[1])) console.log(`      ${String(n).padStart(4)}  ${k}`);
  return { checked, exact, differ, refused, refusalTally };
}

/* ── the controls ─────────────────────────────────────────────────────────── */

function armSelfcheck() {
  console.log(`\nCONTROL ARM — refused provenance (declared: MUST THROW)`);
  try {
    recordFidelity({
      label: "self-check", provenance: "pagepixels.mjs", tool: "pagepixels 1", verdict: "PIXEL_EXACT", detail: {},
    });
    console.log(`  *** ARM FAILED: the gate ACCEPTED a self-produced fidelity figure. ***`);
    return false;
  } catch (e) {
    console.log(`  refused as declared: ${String(e.message).slice(0, 140)}…`);
    return true;
  }
}

async function armBlank(py) {
  console.log(`\nCONTROL ARM — a blank page must render as blank, and must be SEEN to be blank`);
  /* A minimal one-page PDF whose only image is an all-white 64x64 bilevel raw
   * sample block. The renderer must return it; the point of the arm is that the
   * probe can TELL a blank page from a page of ink, so a decoder that silently
   * produced white would be visible rather than reported as a clean decode. */
  const w = 64, h = 64, rowBytes = w / 8;
  const white = new Uint8Array(rowBytes * h).fill(0x00);   // 0 = black in DeviceGray
  const ink = new Uint8Array(rowBytes * h).fill(0x00);
  ink.fill(0xff, 0, rowBytes * 8);                          // 8 rows of white on black
  const mk = (samples) => buildTinyPdf(samples, w, h, rowBytes);
  const rBlank = await renderPageToPixels(mk(white), 0);
  const rInk = await renderPageToPixels(mk(ink), 0);
  if (!rBlank.ok || !rInk.ok) {
    console.log(`  *** ARM FAILED: the fixtures did not render (${rBlank.reason || ""} ${rInk.reason || ""}) ***`);
    return false;
  }
  const same = Buffer.compare(Buffer.from(rBlank.bytes), Buffer.from(rInk.bytes)) === 0;
  console.log(`  uniform page ${rBlank.bytes.length}B · page with ink ${rInk.bytes.length}B · distinguishable: ${!same}`);
  if (same) console.log(`  *** ARM FAILED: a page of ink and a blank page produced identical bytes. ***`);
  return !same;
}

/** The smallest PDF that carries one raw-sample bilevel image, written by hand
 *  so the arm depends on no fixture file and no writer library. */
function buildTinyPdf(samples, w, h, rowBytes) {
  const enc = new TextEncoder();
  const head = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >> endobj
4 0 obj << /Length 30 >> stream
q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q
endstream endobj
5 0 obj << /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceGray /BitsPerComponent 1 /Length ${samples.length} >> stream
`;
  const tail = `
endstream endobj
trailer << /Root 1 0 R >>
%%EOF
`;
  const a = enc.encode(head), b = enc.encode(tail);
  const out = new Uint8Array(a.length + samples.length + b.length);
  out.set(a, 0); out.set(samples, a.length); out.set(b, a.length + samples.length);
  return out;
}

/* ── workerd ──────────────────────────────────────────────────────────────── */

async function armWorkerd(docs) {
  console.log(`\nWORKERD — does the renderer run in the runtime the placement question is about?`);
  let Miniflare;
  try { ({ Miniflare } = await import("miniflare")); }
  catch {
    try { ({ Miniflare } = await import(join(HERE, "../../bio-plane/node_modules/miniflare/dist/src/index.js"))); }
    catch (e) { console.log(`  NO NUMBER: miniflare unavailable (${String(e.message).split("\n")[0]})`); return null; }
  }
  const bundle = join(WORK, "pagepixels.bundled.mjs");
  try {
    const { build } = await import("esbuild").catch(() =>
      import(join(HERE, "../../bio-plane/node_modules/esbuild/lib/main.js")));
    await build({
      entryPoints: [join(HERE, "../src/pagepixels-worker.mjs")],
      bundle: true, format: "esm", platform: "neutral",
      external: ["cloudflare:workers", "node:*"], outfile: bundle,
    });
  } catch (e) {
    console.log(`  NO NUMBER: could not bundle (${String(e.message).split("\n").slice(0, 2).join(" | ")})`);
    return null;
  }
  /* `modulesRoot: "/"` with BOTH scriptPath and script was `pdf-worker.test.mjs`'s
   * idiom, copied rather than reinvented: without it workerd refuses to
   * start with `can't use ".." to break out of starting directory`. */
  const mf = new Miniflare({
    modules: true, modulesRoot: "/", scriptPath: bundle, script: readFileSync(bundle, "utf8"),
    compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
  });
  try {
    const results = [];
    const subjects = [
      ...docs.slice(0, 3).map((d) => ({ id: d.id, bytes: d.bytes, page: 0 })),
      /* The CCITT page, decoded in workerd and CROSS-CHECKED against the node
       * run of the same bytes. Same input, same code, two runtimes: if the
       * digests differ, one of the runtimes is doing something to the decode
       * and neither figure elsewhere in this probe can be trusted. */
      { id: "scan-ccitt-g4-page (fixture)", bytes: new Uint8Array(readFileSync(join(HERE, "fixtures/scan-ccitt-g4-page.pdf"))), page: 0 },
    ];
    for (const d of subjects) {
      const t0 = Date.now();
      const res = await mf.dispatchFetch(`http://x/render?page=${d.page}`, { method: "POST", body: d.bytes });
      const wall = Date.now() - t0;
      const j = await res.json();
      results.push({ id: d.id, wall, ...j });
      console.log(`  ${d.id} p${d.page} -> ${j.ok ? `${j.route} ${j.mediaType} ${j.bytes}B sha256 ${String(j.sha256).slice(0, 16)}` : `REFUSED ${j.reason}`}` +
        `   (${wall} ms WALL in the harness — NOT a Worker CPU figure; a Worker cannot time itself, D-56)`);
      if (j.ok) {
        const local = await renderPageToPixels(d.bytes, d.page);
        const lsha = createHash("sha256").update(local.bytes).digest("hex");
        console.log(`      node produced ${local.bytes.length}B sha256 ${lsha.slice(0, 16)} — FILE ` +
          (lsha === j.sha256 ? "IDENTICAL across runtimes" : "DIFFERS ACROSS RUNTIMES (the container, not the picture)"));
        if (local.pixels_sha256 || j.pixels_sha256) {
          console.log(`      PIXELS  node ${String(local.pixels_sha256).slice(0, 16)} · workerd ${String(j.pixels_sha256).slice(0, 16)} — ` +
            (local.pixels_sha256 === j.pixels_sha256 ? "IDENTICAL" : "*** DIFFER — the DECODE is runtime-dependent ***"));
        }
      }
    }
    console.log(`  bundled size: ${statSync(bundle).size.toLocaleString()} B raw` +
      ` — the renderer adds this to a fleet member, against the 10 MB Paid script limit (DEC-42, Cloudflare's figure)`);
    return results;
  } finally { await mf.dispose(); }
}

/* ── end to end: pixels into OCR ──────────────────────────────────────────── */

async function armOcr(docs) {
  console.log(`\nEND TO END — pagepixels' pixels into an OCR engine, scored against CPDF-9's ground truth`);
  const target = docs.find((d) => d.id === "legistar-attach-15721260");
  if (!target) { console.log(`  NO NUMBER: the ground-truthed exhibit is not in the corpus.`); return null; }
  const r = await renderPageToPixels(target.bytes, 1);       // page index 1 = CPDF-9's "page 2"
  if (!r.ok) { console.log(`  NO NUMBER: the renderer refused the ground-truthed page (${r.reason}).`); return null; }
  const img = join(WORK, "gt-page.png");
  writeFileSync(img, r.bytes);

  const dir = mkdtempSync(join(tmpdir(), "cpdf12-ocr-"));
  try {
    execFileSync("npm", ["init", "-y"], { cwd: dir, stdio: "pipe" });
    execFileSync("npm", ["install", "--no-audit", "--no-fund", "tesseract.js@7.0.0"], { cwd: dir, stdio: "pipe", timeout: 300000 });
  } catch (e) {
    console.log(`  NO NUMBER: could not install the engine (${String(e.message).split("\n")[0]})`);
    return null;
  }
  const runner = join(dir, "run.mjs");
  writeFileSync(runner, `
import { createWorker } from "tesseract.js";
const w = await createWorker("eng");
const { data } = await w.recognize(process.argv[2]);
await w.terminate();
process.stdout.write(JSON.stringify({ text: data.text, confidence: data.confidence }));
`);
  let out;
  try {
    out = JSON.parse(execFileSync(process.execPath, [runner, img], { cwd: dir, encoding: "utf8", maxBuffer: 64e6, timeout: 600000 }));
  } catch (e) {
    console.log(`  NO NUMBER: the engine did not run (${String(e.message).split("\n")[0]})`);
    return null;
  }
  /* COMPARABILITY IS ENFORCED, NOT CLAIMED (CPDF-11's rule). The ground truth is
   * READ OUT OF CPDF-9's committed probe rather than copied here: two copies of
   * a transcription drift, and two accuracy numbers from drifted ground truths
   * are not comparable however alike they look. If that constant moves, this arm
   * reports NO NUMBER instead of scoring against a transcription of its own. */
  const floorSrc = readFileSync(join(HERE, "../../bio-plane/test/ocr-measure-probe.mjs"), "utf8");
  const m = /const GT_PAGE2 = `([\s\S]*?)`;/.exec(floorSrc);
  if (!m) {
    console.log(`  NO NUMBER: CPDF-9's GT_PAGE2 could not be read out of ocr-measure-probe.mjs, so this`);
    console.log(`  arm cannot be compared with the floor and refuses to score against a copy of its own.`);
    return null;
  }
  const gt = m[1];
  const s = score(gt, out.text);
  console.log(`  engine: tesseract.js 7.0.0 (default eng model — NOT tessdata_fast; CPDF-9's 99.96% floor is the FAST model and this is a different model, so the comparable claim is "the pixels are legible", not "this beats the floor")`);
  console.log(`  characters: ${(100 * s.charAcc).toFixed(2)}%   digits: ${s.digitHits}/${s.digitTotal}   minted digits: ${s.minted}`);
  return s;
}

const norm = (x) => x.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();

function score(gtRaw, ocrRaw) {
  const a = norm(gtRaw), b = norm(ocrRaw);
  const n = a.length, m = b.length;
  let prev = new Array(m + 1), cur = new Array(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;
  for (let i = 1; i <= n; i++) {
    cur[0] = i;
    for (let j = 1; j <= m; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0));
    }
    [prev, cur] = [cur, prev];
  }
  const dist = prev[m];
  const gtDigits = (a.match(/\d/g) || []).length;
  const ocrDigits = (b.match(/\d/g) || []).length;
  const gtNums = a.match(/\d[\d,.]*/g) || [];
  const ocrNums = new Set(b.match(/\d[\d,.]*/g) || []);
  const hits = gtNums.filter((t) => ocrNums.has(t)).length;
  return {
    charAcc: 1 - dist / n, dist,
    digitTotal: gtDigits, digitHits: Math.min(gtDigits, ocrDigits),
    numberTokens: gtNums.length, numberTokenHits: hits,
    minted: Math.max(0, ocrDigits - gtDigits),
  };
}

/* ── main ─────────────────────────────────────────────────────────────────── */

console.log(`CPDF-12 · pagepixels — corpus census, fidelity and placement`);
console.log(`workdir ${WORK}`);
console.log(`declared refusals: ${Object.keys(REFUSALS).length} (${Object.keys(REFUSALS).join(", ")})`);

const py = pythonProbe();
const docs = await buildCorpus(argv.has("--quick") ? 6 : 60);
console.log(`corpus: ${docs.length} PDFs, ${(docs.reduce((n, d) => n + d.size, 0) / 1e6).toFixed(1)} MB, cached in ${CACHE}`);
for (const d of docs.slice(0, 4)) console.log(`  ${d.id}  ${d.size.toLocaleString()} B  sha256 ${sha(d.bytes).slice(0, 16)}`);

const rows = await census(docs);
const c = reportCensus(rows);

let verified = null;
if (!argv.has("--corpus-only")) verified = await verifyRendering(docs, py);
if (argv.has("--workerd")) await armWorkerd(docs);
if (argv.has("--ocr")) await armOcr(docs);

let armsOk = true;
if (argv.has("--arm-selfcheck")) armsOk = armSelfcheck() && armsOk;
if (argv.has("--arm-blank")) armsOk = (await armBlank(py)) && armsOk;

console.log(`\nFIDELITY LEDGER — ${FIDELITY.length} reading(s), every one gated on independent provenance`);
const byVerdict = new Map();
for (const f of FIDELITY) byVerdict.set(f.verdict, (byVerdict.get(f.verdict) || 0) + 1);
for (const [v, n] of byVerdict) console.log(`  ${String(n).padStart(5)}  ${v}`);
if (FIDELITY.length === 0) console.log(`  (none — NO FIGURE IS CLAIMED)`);

console.log(`\nFOOT REACHED — this probe ran to its own end (${c.pages} pages censused, ${FIDELITY.length} fidelity readings).`);
if (!armsOk) process.exitCode = 1;
