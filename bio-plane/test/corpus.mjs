/* The corpus library's shared parts (requirements/test-support.md R19, R24, R25, R28; fix round 9, G123d; S9):
 * the seeded draw every generator uses, the vocabulary its units carry, the fixture cache, `truthOf`, the
 * loopback origin and the independent readers (oracles) a test checks a generator's truth against.
 * Not product code. Importing it has no side effect: nothing is created until a test calls a function.
 *
 * A recipe is `{kind, seed, size, ...options}`. `kind` picks the generator (pdfgen, imggen, sheetgen,
 * docgen); `seed` is a number or a string (a corpus case with no seed takes its case id, K4842 (5)); the
 * same recipe gives the same bytes and the same truth on every call. */
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { gzipSync, deflateSync, brotliCompressSync } from "node:zlib";
import { createWriteStream, existsSync, mkdirSync, mkdtempSync, renameSync, statSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as pdfgen from "./pdfgen.mjs";
import * as imggen from "./imggen.mjs";
import * as sheetgen from "./sheetgen.mjs";
import * as docgen from "./docgen.mjs";

export { hash32, rng, drawAt, VOCAB, LATIN_VOCAB, ASCII_VOCAB, canonical, recipeKey } from "./seeded.mjs";
import { canonical, recipeKey } from "./seeded.mjs";
/** @import { PdfRecipe, PdfFile, PdfTruth } from "./pdfgen.mjs" */
/** @import { Recipe as ImgRecipe, Picture, Truth as ImgTruth } from "./imggen.mjs" */
/** @import { SheetRecipe, SheetFile, SheetTruth } from "./sheetgen.mjs" */
/** @import { DocRecipe, DocFile, DocTruth } from "./docgen.mjs" */

/** A recipe of any generator's kind; each generator's recipe with the kinds its KINDS names, by which `generate` and
 *  `truthOf` hand it to its generator.
 *  @typedef {(PdfRecipe & {kind: "pdf"}) | (ImgRecipe & {kind: "png"|"bmp"|"gif"|"tiff"}) | SheetRecipe | DocRecipe} CorpusRecipe */
/** @typedef {PdfFile | Picture | SheetFile | DocFile} CorpusFile a generated file: `{kind, ext, type, size, truth, chunks(), bytes()}` */
/** @typedef {PdfTruth | ImgTruth | SheetTruth | DocTruth} CorpusTruth */
/** @typedef {typeof pdfgen | typeof imggen | typeof sheetgen | typeof docgen} Generator */

/* ---- the generators by kind ---- */

/** The generator of each kind.
 *  @returns {{[kind: string]: Generator}} */
export const kinds = () => {
  /** @type {{[kind: string]: Generator}} */
  const all = {};
  for (const g of [pdfgen, imggen, sheetgen, docgen]) for (const k of g.KINDS) all[k] = g;
  return all;
};

/** @param {CorpusRecipe} recipe @returns {Generator} */
function generatorOf(recipe) {
  if (!recipe || typeof recipe !== "object") throw new Error("corpus: a recipe must be an object");
  const all = kinds(), g = all[recipe.kind];
  if (!g) throw new Error(`corpus: recipe.kind ${JSON.stringify(recipe.kind)} is not one of ${Object.keys(all).join(", ")}`);
  return g;
}

/** The file of a recipe, from its generator: `{kind, ext, type, size, truth, chunks(), bytes()}` (R19).
 *  @param {CorpusRecipe} recipe @returns {CorpusFile} */
export const generate = (recipe) => {
  generatorOf(recipe);
  /* the generator generatorOf finds, called by its kinds so that it is handed a recipe of its own kind */
  switch (recipe.kind) {
    case "pdf": return pdfgen.generate(recipe);
    case "png": case "bmp": case "gif": case "tiff": return imggen.generate(recipe);
    case "csv": case "tsv": case "xlsx": case "ods": return sheetgen.generate(recipe);
    default: return docgen.generate(recipe);
  }
};

/** The truth of a recipe without building its file (R24).
 *  @param {CorpusRecipe} recipe @returns {CorpusTruth} */
export const truthOf = (recipe) => {
  generatorOf(recipe);
  switch (recipe.kind) {
    case "pdf": return pdfgen.truthOf(recipe);
    case "png": case "bmp": case "gif": case "tiff": return imggen.truthOf(recipe);
    case "csv": case "tsv": case "xlsx": case "ods": return sheetgen.truthOf(recipe);
    default: return docgen.truthOf(recipe);
  }
};

/** Collects an async iterable of chunks into one Uint8Array.
 *  @param {AsyncIterable<Uint8Array, void, undefined> | Iterable<Uint8Array, void, undefined>} chunks @returns {Promise<Uint8Array>} */
export async function collect(chunks) {
  /** @type {Uint8Array[]} */
  const parts = [];
  let n = 0;
  for await (const c of chunks) { parts.push(c); n += c.length; }
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/* ---- the fixture cache (R19, R9) ---- */

/** The directory generated files are built into: `BIO_FIXTURE_CACHE`, or, when it is unset, a directory in the
 *  process's temporary directory (the sandbox, for a test that imports it). Created on first use, never removed. */
/** @returns {string} */
export function fixtureDir() {
  const dir = process.env.BIO_FIXTURE_CACHE || join(tmpdir(), "bio-fixture-cache");
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Builds a recipe's file into the cache once, keyed by the recipe, streaming its chunks to disk so a large
 *  file is never held; a later call finds it there. Answers `{path, size, truth, built}`. */
/** @typedef {{path: string, size: number, truth: CorpusTruth, built: boolean}} Fixture */
/** @param {CorpusRecipe} recipe @returns {Promise<Fixture>} */
export async function buildFixture(recipe) {
  const file = generate(recipe);
  const path = join(fixtureDir(), `${recipe.kind}-${recipeKey(recipe)}.${file.ext}`);
  const expected = file.size;
  if (existsSync(path) && (expected == null || statSync(path).size === expected)) return { path, size: statSync(path).size, truth: file.truth, built: false };
  const part = `${path}.part-${process.pid}`;
  const out = createWriteStream(part);
  let size = 0;
  for await (const c of file.chunks()) {
    size += c.length;
    if (!out.write(c)) await new Promise((r) => out.once("drain", r));
  }
  /** @type {Promise<void>} */
  const ended = new Promise((resolve, reject) => out.end((/** @type {Error | null | undefined} */ e) => (e ? reject(e) : resolve())));
  await ended;
  renameSync(part, path);
  return { path, size, truth: file.truth, built: true };
}

/* ---- the loopback origin (R25) ---- */

const LOOPBACK = /^(127\.\d+\.\d+\.\d+|localhost|\[::1\])$/;
const ENCODERS = { gzip: gzipSync, deflate: deflateSync, br: brotliCompressSync };

/** @typedef {Uint8Array | string | CorpusRecipe} RouteBody bytes, a string, or a recipe served from its generator */
/**
 * @typedef {Object} Route
 * @property {number} [status] absent is 200 (302 for a redirect)
 * @property {{[name: string]: string}} [headers]
 * @property {RouteBody | ((req: unknown) => RouteBody | Promise<RouteBody>)} [body] a function is handed the request (Node's,
 *  which the tool's description of the host does not hold)
 * @property {"gzip"|"deflate"|"br"} [encoding]
 * @property {string} [redirect]
 * @property {number} [delayMs]
 * @property {boolean} [hang]
 */
/** @typedef {{method: string, path: string, headers: {[name: string]: string | string[] | undefined}}} OriginRequest */
/** @typedef {{origin: string, url: (path: string) => string, requests: OriginRequest[], close: () => Promise<void>}} Origin */
/** @typedef {{type: string|undefined, stream: CorpusFile|null, body: Uint8Array}} Answer */

/** What a route's body answers: a recipe's file, streamed, or its bytes when `whole` (it is compressed, or hangs);
 *  a string's UTF-8; or the bytes given (none for no body). A streamed answer's body is not read.
 *  @param {RouteBody|undefined} got @param {string|undefined} named the route's own content-type
 *  @param {boolean} whole @returns {Promise<Answer>} */
async function answerOf(got, named, whole) {
  if (got && typeof got === "object" && !(got instanceof Uint8Array) && got.kind) {
    const f = generate(got);
    const type = named ?? f.type;
    if (whole) return { type, stream: null, body: await f.bytes() };
    return { type, stream: f, body: new Uint8Array(0) };
  }
  if (typeof got === "string") return { type: named, stream: null, body: new TextEncoder().encode(got) };
  return { type: named, stream: null, body: got ?? new Uint8Array(0) };
}

/**
 * An HTTP origin on 127.0.0.1 serving `routes`: `{"/path": {status = 200, headers = {}, body, encoding, redirect,
 * delayMs, hang}}`. `body` is bytes, a string, a recipe (served from its generator, its chunks streamed) or a
 * function answering one of those. `encoding` ("gzip", "deflate", "br") compresses the body for real and sets
 * `Content-Encoding`; `redirect` answers 302 to another path of this origin (a relative path, or an absolute URL on
 * the loopback); `delayMs` waits before answering; `hang: true` sends the headers and part of the body and never
 * ends it. Answers `{origin, url(path), requests, close()}`; it closes when the process exits (the sandbox's end,
 * R2), keeps no process alive and makes no request of its own.
 */
/** @param {{[path: string]: Route}} [routes] @returns {Promise<Origin>} */
export async function loopbackOrigin(routes = {}) {
  for (const [path, r] of Object.entries(routes)) {
    if (!path.startsWith("/")) throw new Error(`loopbackOrigin: route ${path} must start with /`);
    const redirect = r?.redirect;
    if (redirect && /^[a-z]+:/i.test(redirect) && !LOOPBACK.test(new URL(redirect).hostname)) {
      throw new Error(`loopbackOrigin: route ${path} redirects off the loopback`);
    }
    const encoding = r?.encoding;
    if (encoding && !ENCODERS[encoding]) throw new Error(`loopbackOrigin: route ${path} encoding must be gzip, deflate or br`);
  }
  /** @type {OriginRequest[]} */
  const requests = [];
  const open = new Set();
  const server = createServer(async (req, res) => {
    const path = new URL(req.url, "http://127.0.0.1").pathname;
    requests.push({ method: req.method, path, headers: { ...req.headers } });
    const r = routes[path];
    if (!r) { res.writeHead(404, { "content-type": "text/plain" }); res.end("404"); return; }
    if (r.delayMs) await new Promise((w) => setTimeout(w, r.delayMs).unref());
    const redirect = r.redirect;
    if (redirect) { res.writeHead(r.status ?? 302, { location: redirect, ...r.headers }); res.end(); return; }
    const given = r.body;
    const got = typeof given === "function" ? await given(req) : given;
    const answer = await answerOf(got, r.headers?.["content-type"], !!(r.encoding || r.hang));
    const type = answer.type, stream = answer.stream;
    /** @type {{[name: string]: string}} */
    const headers = {};
    if (type) headers["content-type"] = type;
    for (const [name, value] of Object.entries(r.headers ?? {})) headers[name] = value;
    /* a streamed answer has neither an encoding nor a hang (answerOf), so the two steps below pass it by */
    const encoding = r.encoding;
    const body = encoding ? new Uint8Array(ENCODERS[encoding](answer.body)) : answer.body;
    if (encoding) headers["content-encoding"] = encoding;
    if (r.hang) {
      res.writeHead(r.status ?? 200, headers);
      res.write(body.subarray(0, Math.max(1, Math.floor(body.length / 2))));
      return;
    }
    if (stream) {
      const size = stream.size;
      if (size != null) headers["content-length"] = String(size);
      res.writeHead(r.status ?? 200, headers);
      for await (const c of stream.chunks()) if (!res.write(c)) await new Promise((w) => res.once("drain", w));
      res.end();
      return;
    }
    headers["content-length"] = String(body.length);
    res.writeHead(r.status ?? 200, headers);
    res.end(body);
  });
  server.on("connection", (s) => { open.add(s); s.on("close", () => open.delete(s)); });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  server.unref();
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;
  let closed = false;
  /** @returns {Promise<void>} */
  const close = () => {
    if (closed) return Promise.resolve();
    closed = true;
    process.off("exit", close);
    for (const s of open) s.destroy();
    return new Promise((resolve) => server.close(() => resolve()));
  };
  process.on("exit", close);
  return { origin, url: (/** @type {string} */ path) => `${origin}${path}`, requests, close };
}

/* ---- the independent readers (R24) ----
   Each answers `{skip}` naming the missing tool when the host lacks it, so a test skips by name rather than passes. */

/** @param {string} cmd @returns {boolean} */
const has = (cmd) => spawnSync("sh", ["-c", `command -v ${cmd}`], { encoding: "utf8" }).status === 0;
/** @param {string} label @returns {string} */
const scratch = (label) => mkdtempSync(join(tmpdir(), `oracle-${label}-`));

/** @typedef {{skip: string}} Skip a reader the host lacks, named */

/** Info-ZIP `unzip -t` over a file: `{ok, output}`.
 *  @param {string} path @returns {Skip | {ok: boolean, output: string}} */
export function unzipTest(path) {
  if (!has("unzip")) return { skip: "unzip is not installed" };
  const r = spawnSync("unzip", ["-t", path], { encoding: "utf8", maxBuffer: 64 << 20 });
  return { ok: r.status === 0, output: r.stdout + r.stderr };
}

/** @typedef {{ok: true, members: {name: string, size: number, sha256: string}[]} | {ok: false, error: string}} ZipfileAnswer */
/** Python's `zipfile` over a file: `{ok, members: [{name, size, sha256}]}`, or `{ok:false, error}`.
 *  @param {string} path @returns {Skip | ZipfileAnswer} */
export function pyZipfile(path) {
  if (!has("python3")) return { skip: "python3 is not installed" };
  const code = "import sys,zipfile,hashlib,json\ntry:\n z=zipfile.ZipFile(sys.argv[1])\n print(json.dumps({'ok':True,'members':[{'name':i.filename,'size':i.file_size,'sha256':hashlib.sha256(z.read(i)).hexdigest()} for i in z.infolist()]}))\nexcept Exception as e:\n print(json.dumps({'ok':False,'error':type(e).__name__+': '+str(e)}))";
  const r = spawnSync("python3", ["-I", "-c", code, path], { encoding: "utf8", maxBuffer: 64 << 20 });
  /* the JSON this module's own script prints */
  return /** @type {ZipfileAnswer} */ (JSON.parse(r.stdout));
}

/** Pillow over a picture: `{format, frames: [{width, height, mode, sha256}]}`; each frame's pixels as Pillow decodes them,
 *  as bytes in its mode (`L`, `LA`, `RGB`, `RGBA`, `1` read as `L`, `I;16` as big-endian 16-bit). */
/** @typedef {{format: string, frames: {width: number, height: number, mode: string, sha256: string}[]}} PillowAnswer */
/** @param {string} path @returns {Skip | {error: string} | PillowAnswer} */
export function pillowPixels(path) {
  if (!has("python3")) return { skip: "python3 is not installed" };
  const code = [
    "import sys,json,hashlib",
    "try:\n from PIL import Image, ImageSequence\nexcept Exception:\n print(json.dumps({'skip':'Pillow is not installed'})); sys.exit()",
    "im=Image.open(sys.argv[1]); out=[]",
    "for f in ImageSequence.Iterator(im):",
    " m=f.mode",
    " if m=='P': g=f.convert('RGBA' if 'transparency' in f.info else 'RGB')",
    " elif m=='1': g=f.convert('L')",
    " elif m in ('I;16','I;16B','I;16L','I'): g=None",
    " else: g=f",
    " if g is None:",
    "  import struct; d=b''.join(struct.pack('>H', v & 0xffff) for v in f.getdata()); mm='I;16'",
    " else:\n  d=g.tobytes(); mm=g.mode",
    " out.append({'width':f.width,'height':f.height,'mode':mm,'sha256':hashlib.sha256(d).hexdigest()})",
    "print(json.dumps({'format':im.format,'frames':out}))",
  ].join("\n");
  const r = spawnSync("python3", ["-I", "-c", code, path], { encoding: "utf8", maxBuffer: 64 << 20 });
  if (r.status !== 0) return { error: r.stderr.trim() };
  /* the JSON this module's own script prints */
  return /** @type {Skip | PillowAnswer} */ (JSON.parse(r.stdout));
}

/** pdf.js (the library the committed pdf-worker bundle carries, from bio-plane's own `pdfjs-dist`) over PDF bytes:
 *  `{pages, texts: [each page's text, its items joined in logical order, a line break where pdf.js marks one]}`, or `{error}`. */
/** @param {Uint8Array} bytes @param {{password?: string}} [options]
 *  @returns {Promise<Skip | {error: string} | {pages: number, texts: string[]}>} */
export async function pdfjsText(bytes, { password } = {}) {
  /** @type {typeof import("pdfjs-dist/legacy/build/pdf.mjs")} */
  let lib;
  try { lib = await import("pdfjs-dist/legacy/build/pdf.mjs"); } catch { return { skip: "pdfjs-dist is not installed" }; }
  try {
    const doc = await lib.getDocument({ data: new Uint8Array(bytes), password, isEvalSupported: false, verbosity: 0, useWorkerFetch: false, disableFontFace: true }).promise;
    /** @type {string[]} */
    const texts = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      /* pdf.js gives a right-to-left run in visual order; it is turned back to the logical order the truth holds */
      /* marked content (not asked for) has no text: it read as "undefined" */
      texts.push(tc.items.map((it) => ("str" in it ? (it.dir === "rtl" ? [...it.str].reverse().join("") : it.str) + (it.hasEOL ? "\n" : "") : "undefined")).join(""));
    }
    const pages = doc.numPages;
    await doc.destroy();
    return { pages, texts };
  } catch (e) {
    return { error: `${e.name}: ${e.message}` };
  }
}

/** poppler's `pdftotext -layout` over a PDF file, page by page: `{texts}`, a second reader for the structure files
 *  (`-layout` keeps a line's marker and its word on one line, where the default reading order takes them as columns). */
/** @param {string} path @param {number} pages @returns {Skip | {texts: (string|null)[]}} */
export function pdftotext(path, pages) {
  if (!has("pdftotext")) return { skip: "pdftotext is not installed" };
  /** @type {(string|null)[]} */
  const texts = [];
  for (let p = 1; p <= pages; p++) {
    const r = spawnSync("pdftotext", ["-layout", "-f", String(p), "-l", String(p), "-enc", "UTF-8", path, "-"], { encoding: "utf8", maxBuffer: 64 << 20 });
    texts.push(r.status === 0 ? r.stdout : null);
  }
  return { texts };
}

/** LibreOffice headless: converts a file to `to` ("txt", "csv", "html", "pdf") in a private profile and answers the
 *  converted file's text (for "pdf", its bytes). `{text}` or `{bytes}`, or `{error}`. */
/** @param {string} path @param {"txt"|"csv"|"html"|"pdf"} to
 *  @returns {Skip | {error: string} | {bytes: Uint8Array} | {text: string}} */
export function soffice(path, to) {
  const bin = has("soffice") ? "soffice" : has("libreoffice") ? "libreoffice" : null;
  if (!bin) return { skip: "LibreOffice is not installed" };
  const dir = scratch("soffice");
  const filter = { txt: "txt:Text (encoded):UTF8", csv: "csv:Text - txt - csv (StarCalc):44,34,76,1", html: "html", pdf: "pdf" }[to];
  if (!filter) throw new Error(`soffice: to must be txt, csv, html or pdf, got ${to}`);
  const r = spawnSync(bin, [`-env:UserInstallation=file://${dir}/profile`, "--headless", "--norestore", "--convert-to", filter, "--outdir", dir, path], { encoding: "utf8", timeout: 180000 });
  /* split answers at least one piece, so pop always has one */
  const base = (path.split("/").pop() ?? "").replace(/\.[^.]*$/, "");
  const out = join(dir, `${base}.${to}`);
  if (!existsSync(out)) { rmSync(dir, { recursive: true, force: true }); return { error: (r.stderr || r.stdout || `exit ${r.status}`).trim() }; }
  const data = readFileSync(out);
  rmSync(dir, { recursive: true, force: true });
  return to === "pdf" ? { bytes: new Uint8Array(data) } : { text: data.toString("utf8").replace(/^\ufeff/, "") };
}

/** Chromium (Playwright's) over an HTML page's bytes: the body's visible text, as a visitor sees it. `{text}` or `{skip}`. */
/** @param {RouteBody} html @param {{contentType?: string}} [options] @returns {Promise<Skip | {text: string}>} */
export async function chromiumText(html, { contentType = "text/html" } = {}) {
  let pw;
  try { pw = await import("playwright"); } catch {
    try { const { createRequire } = await import("node:module"); pw = createRequire(join(process.cwd(), "x.js"))("playwright"); } catch { return { skip: "Playwright is not installed" }; }
  }
  const chromium = pw.chromium ?? pw.default?.chromium;
  let browser;
  try { browser = await chromium.launch(); } catch (e) { return { skip: `Chromium cannot start (${e.message.split("\n")[0]})` }; }
  try {
    const origin = await loopbackOrigin({ "/page": { body: html, headers: { "content-type": contentType } } });
    const page = await browser.newPage();
    await page.goto(origin.url("/page"), { waitUntil: "load" });
    const text = await page.evaluate(() => document.body?.innerText ?? "");
    await origin.close();
    return { text };
  } finally { await browser.close(); }
}

/** Writes bytes to a new file in the process's temporary directory (the sandbox, for a test that imports it). */
/** @param {Uint8Array|string} bytes @param {string} name @returns {string} */
export function scratchFile(bytes, name) {
  const path = join(scratch("file"), name);
  writeFileSync(path, bytes);
  return path;
}
