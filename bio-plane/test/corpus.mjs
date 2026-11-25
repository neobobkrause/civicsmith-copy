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

/* ---- the generators by kind ---- */

/** The generator of each kind. */
export const kinds = () => Object.fromEntries([pdfgen, imggen, sheetgen, docgen].flatMap((g) => g.KINDS.map((k) => [k, g])));

function generatorOf(recipe) {
  if (!recipe || typeof recipe !== "object") throw new Error("corpus: a recipe must be an object");
  const all = kinds(), g = all[recipe.kind];
  if (!g) throw new Error(`corpus: recipe.kind ${JSON.stringify(recipe.kind)} is not one of ${Object.keys(all).join(", ")}`);
  return g;
}

/** The file of a recipe, from its generator: `{kind, ext, type, size, truth, chunks(), bytes()}` (R19). */
export const generate = (recipe) => generatorOf(recipe).generate(recipe);

/** The truth of a recipe without building its file (R24). */
export const truthOf = (recipe) => generatorOf(recipe).truthOf(recipe);

/** Collects an async iterable of chunks into one Uint8Array. */
export async function collect(chunks) {
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
export function fixtureDir() {
  const dir = process.env.BIO_FIXTURE_CACHE || join(tmpdir(), "bio-fixture-cache");
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Builds a recipe's file into the cache once, keyed by the recipe, streaming its chunks to disk so a large
 *  file is never held; a later call finds it there. Answers `{path, size, truth, built}`. */
export async function buildFixture(recipe) {
  const file = generate(recipe);
  const path = join(fixtureDir(), `${recipe.kind}-${recipeKey(recipe)}.${file.ext}`);
  if (existsSync(path) && (file.size == null || statSync(path).size === file.size)) return { path, size: statSync(path).size, truth: file.truth, built: false };
  const part = `${path}.part-${process.pid}`;
  const out = createWriteStream(part);
  let size = 0;
  for await (const c of file.chunks()) {
    size += c.length;
    if (!out.write(c)) await new Promise((r) => out.once("drain", r));
  }
  await new Promise((resolve, reject) => out.end((e) => (e ? reject(e) : resolve())));
  renameSync(part, path);
  return { path, size, truth: file.truth, built: true };
}

/* ---- the loopback origin (R25) ---- */

const LOOPBACK = /^(127\.\d+\.\d+\.\d+|localhost|\[::1\])$/;
const ENCODERS = { gzip: gzipSync, deflate: deflateSync, br: brotliCompressSync };

/**
 * An HTTP origin on 127.0.0.1 serving `routes`: `{"/path": {status = 200, headers = {}, body, encoding, redirect,
 * delayMs, hang}}`. `body` is bytes, a string, a recipe (served from its generator, its chunks streamed) or a
 * function answering one of those. `encoding` ("gzip", "deflate", "br") compresses the body for real and sets
 * `Content-Encoding`; `redirect` answers 302 to another path of this origin (a relative path, or an absolute URL on
 * the loopback); `delayMs` waits before answering; `hang: true` sends the headers and part of the body and never
 * ends it. Answers `{origin, url(path), requests, close()}`; it closes when the process exits (the sandbox's end,
 * R2), keeps no process alive and makes no request of its own.
 */
export async function loopbackOrigin(routes = {}) {
  for (const [path, r] of Object.entries(routes)) {
    if (!path.startsWith("/")) throw new Error(`loopbackOrigin: route ${path} must start with /`);
    if (r?.redirect && /^[a-z]+:/i.test(r.redirect) && !LOOPBACK.test(new URL(r.redirect).hostname)) {
      throw new Error(`loopbackOrigin: route ${path} redirects off the loopback`);
    }
    if (r?.encoding && !ENCODERS[r.encoding]) throw new Error(`loopbackOrigin: route ${path} encoding must be gzip, deflate or br`);
  }
  const requests = [];
  const open = new Set();
  const server = createServer(async (req, res) => {
    const path = new URL(req.url, "http://127.0.0.1").pathname;
    requests.push({ method: req.method, path, headers: { ...req.headers } });
    const r = routes[path];
    if (!r) { res.writeHead(404, { "content-type": "text/plain" }); res.end("404"); return; }
    if (r.delayMs) await new Promise((w) => setTimeout(w, r.delayMs).unref());
    if (r.redirect) { res.writeHead(r.status ?? 302, { location: r.redirect, ...r.headers }); res.end(); return; }
    let body = typeof r.body === "function" ? await r.body(req) : r.body;
    let type = r.headers?.["content-type"];
    let stream = null;
    if (body && typeof body === "object" && !(body instanceof Uint8Array) && body.kind) {
      const f = generate(body);
      type ??= f.type;
      if (r.encoding || r.hang) body = await f.bytes(); else stream = f;
    } else if (typeof body === "string") body = new TextEncoder().encode(body);
    body ??= new Uint8Array(0);
    const headers = { ...(type ? { "content-type": type } : {}), ...r.headers };
    if (r.encoding) { body = new Uint8Array(ENCODERS[r.encoding](body)); headers["content-encoding"] = r.encoding; }
    if (r.hang) {
      res.writeHead(r.status ?? 200, headers);
      res.write(body.subarray(0, Math.max(1, Math.floor(body.length / 2))));
      return;
    }
    if (stream) {
      if (stream.size != null) headers["content-length"] = String(stream.size);
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
  const close = () => {
    if (closed) return Promise.resolve();
    closed = true;
    process.off("exit", close);
    for (const s of open) s.destroy();
    return new Promise((resolve) => server.close(() => resolve()));
  };
  process.on("exit", close);
  return { origin, url: (path) => `${origin}${path}`, requests, close };
}

/* ---- the independent readers (R24) ----
   Each answers `{skip}` naming the missing tool when the host lacks it, so a test skips by name rather than passes. */

const has = (cmd) => spawnSync("sh", ["-c", `command -v ${cmd}`], { encoding: "utf8" }).status === 0;
const scratch = (label) => mkdtempSync(join(tmpdir(), `oracle-${label}-`));

/** Info-ZIP `unzip -t` over a file: `{ok, output}`. */
export function unzipTest(path) {
  if (!has("unzip")) return { skip: "unzip is not installed" };
  const r = spawnSync("unzip", ["-t", path], { encoding: "utf8", maxBuffer: 64 << 20 });
  return { ok: r.status === 0, output: r.stdout + r.stderr };
}

/** Python's `zipfile` over a file: `{ok, members: [{name, size, sha256}]}`, or `{ok:false, error}`. */
export function pyZipfile(path) {
  if (!has("python3")) return { skip: "python3 is not installed" };
  const code = "import sys,zipfile,hashlib,json\ntry:\n z=zipfile.ZipFile(sys.argv[1])\n print(json.dumps({'ok':True,'members':[{'name':i.filename,'size':i.file_size,'sha256':hashlib.sha256(z.read(i)).hexdigest()} for i in z.infolist()]}))\nexcept Exception as e:\n print(json.dumps({'ok':False,'error':type(e).__name__+': '+str(e)}))";
  const r = spawnSync("python3", ["-I", "-c", code, path], { encoding: "utf8", maxBuffer: 64 << 20 });
  return JSON.parse(r.stdout);
}

/** Pillow over a picture: `{format, frames: [{width, height, mode, sha256}]}`; each frame's pixels as Pillow decodes them,
 *  as bytes in its mode (`L`, `LA`, `RGB`, `RGBA`, `1` read as `L`, `I;16` as big-endian 16-bit). */
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
  return JSON.parse(r.stdout);
}

/** pdf.js (the library the committed pdf-worker bundle carries, from bio-plane's own `pdfjs-dist`) over PDF bytes:
 *  `{pages, texts: [each page's text, its items joined in logical order, a line break where pdf.js marks one]}`, or `{error}`. */
export async function pdfjsText(bytes, { password } = {}) {
  let lib;
  try { lib = await import("pdfjs-dist/legacy/build/pdf.mjs"); } catch { return { skip: "pdfjs-dist is not installed" }; }
  try {
    const doc = await lib.getDocument({ data: new Uint8Array(bytes), password, isEvalSupported: false, verbosity: 0, useWorkerFetch: false, disableFontFace: true }).promise;
    const texts = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      /* pdf.js gives a right-to-left run in visual order; it is turned back to the logical order the truth holds */
      texts.push(tc.items.map((it) => (it.dir === "rtl" ? [...it.str].reverse().join("") : it.str) + (it.hasEOL ? "\n" : "")).join(""));
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
export function pdftotext(path, pages) {
  if (!has("pdftotext")) return { skip: "pdftotext is not installed" };
  const texts = [];
  for (let p = 1; p <= pages; p++) {
    const r = spawnSync("pdftotext", ["-layout", "-f", String(p), "-l", String(p), "-enc", "UTF-8", path, "-"], { encoding: "utf8", maxBuffer: 64 << 20 });
    texts.push(r.status === 0 ? r.stdout : null);
  }
  return { texts };
}

/** LibreOffice headless: converts a file to `to` ("txt", "csv", "html", "pdf") in a private profile and answers the
 *  converted file's text (for "pdf", its bytes). `{text}` or `{bytes}`, or `{error}`. */
export function soffice(path, to) {
  const bin = has("soffice") ? "soffice" : has("libreoffice") ? "libreoffice" : null;
  if (!bin) return { skip: "LibreOffice is not installed" };
  const dir = scratch("soffice");
  const filter = { txt: "txt:Text (encoded):UTF8", csv: "csv:Text - txt - csv (StarCalc):44,34,76,1", html: "html", pdf: "pdf" }[to];
  if (!filter) throw new Error(`soffice: to must be txt, csv, html or pdf, got ${to}`);
  const r = spawnSync(bin, [`-env:UserInstallation=file://${dir}/profile`, "--headless", "--norestore", "--convert-to", filter, "--outdir", dir, path], { encoding: "utf8", timeout: 180000 });
  const base = path.split("/").pop().replace(/\.[^.]*$/, "");
  const out = join(dir, `${base}.${to}`);
  if (!existsSync(out)) { rmSync(dir, { recursive: true, force: true }); return { error: (r.stderr || r.stdout || `exit ${r.status}`).trim() }; }
  const data = readFileSync(out);
  rmSync(dir, { recursive: true, force: true });
  return to === "pdf" ? { bytes: new Uint8Array(data) } : { text: data.toString("utf8").replace(/^\ufeff/, "") };
}

/** Chromium (Playwright's) over an HTML page's bytes: the body's visible text, as a visitor sees it. `{text}` or `{skip}`. */
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
export function scratchFile(bytes, name) {
  const path = join(scratch("file"), name);
  writeFileSync(path, bytes);
  return path;
}
