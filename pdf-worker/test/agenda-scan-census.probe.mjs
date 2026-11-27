#!/usr/bin/env node
/* D-321 — IS THERE A REAL SCANNED AGENDA PAGE IN THE BYTES THIS PROJECT ALREADY HOLDS?
 *
 * NOT a test: a `.probe.mjs` is run by hand, and neither `npm test` in
 * `pdf-worker` nor any `node --test` glob reaches it. It reads only the local git
 * object store and writes nothing.
 *
 * D-321 asks for ONE real image-only page carrying agenda-shaped text, committed
 * to the OCR fixtures, so an end-to-end OCR test can drive the `reading_refs`
 * join over a real page instead of synthetic ink. The page must come from bytes
 * already held (the cloud proxy refuses Legistar, and a refusal is not routed
 * around). This probe is the SEARCH, and its answer is recorded whichever way it
 * comes out: an empty search is an honest outcome, a synthesised page is not.
 *
 * THE POPULATION. Every blob REACHABLE from every ref in this clone
 * (`git rev-list --all --objects` — run `git fetch origin '+refs/heads/*:refs/remotes/origin/*'`
 * first so every pushed branch is a ref), classified by MAGIC BYTES rather than by
 * extension, so a page image committed under any name is seen. Every PDF found is
 * censused page by page with `pagepixels.mjs`'s own `analyzePage` — the SAME
 * predicate the OCR path uses — and a page is IMAGE-ONLY when it paints at least
 * one image and has no text operator. Raster blobs (PNG, JPEG, TIFF) are listed
 * with their path, to be judged by reading them.
 *
 * WHAT IT CANNOT SEE, stated: bytes held OUTSIDE git — an instance's R2 captures,
 * another machine's harvest cache, a scratchpad. Those are a different population
 * and this probe says nothing about them.
 *
 * THE GATE THAT KEEPS AN EMPTY ANSWER FROM BEING FREE (W34). "No image-only page"
 * is also what a broken census prints. So the probe FAILS unless it finds the one
 * image-only page this project is known to hold — `scan-ccitt-g4-page.pdf`, the
 * scanned City Council RESOLUTION (Legistar attachment 15721260, page 2) — as
 * image-only. That page is the positive control: the detector can see the class.
 * Whether that page is agenda-shaped is not measured here.
 *
 *   node pdf-worker/test/agenda-scan-census.probe.mjs          (from the repo root)
 *   node pdf-worker/test/agenda-scan-census.probe.mjs --dir <d> (a directory of files)
 *
 * `--dir` (D-321 part 2) censuses the files in ONE directory instead of the git
 * store — the population an instance holds OUTSIDE git, fetched to a scratchpad by
 * read-only `op=capture` GETs and checked against their sha256 on arrival (M-170).
 * The committed `scan-ccitt-g4-page.pdf` is ADDED to that population so the same
 * positive control gates the answer, and it is excluded from the candidate count.
 *
 * Result and population: `docs/development/measurements/M-170.md`.
 *
 * NEGATIVE CONTROL: RUN 2026-09-25. ONE ARM — the image-only predicate forced false
 * (`&& false` appended, 1 match, armed alone). Declared: MUST exit 1 at the positive-control
 * gate; MUST NOT change the population. Actual: exit 1, "FAIL — the census did not find the
 * known image-only page (591b1615b674…)", PDFs 8 / pages 52 / raster blobs 2 unchanged.
 * Restored by `cp` from a pristine copy, `cmp` identical, sha256 4ecc62d61f754877… before and
 * after, 6,768 B. BASELINE: exit 0, image-only 1, the known resolution found.
 * SECOND ARM, RUN 2026-09-25 by D-321 part 2 — the encrypted-file guard disarmed
 * (`false &&` prefixed, 1 match, armed alone), `--dir` over the instance's 11 PDFs.
 * Declared: MUST report encrypted 0, pages 2,056, image-only 27 (the EBMUD agenda
 * report's p0/p3 back as false positives); MUST NOT fail the positive control.
 * Actual: exactly that, exit 0. Restored by `cp`, `cmp` identical, sha256
 * b5499574db931aba… before and after, 9,597 B; re-run: encrypted 2, pages 1,836,
 * image-only 25.
 */
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import * as require_fs from "node:fs";
import { loadPdf, analyzePage } from "../src/pagepixels.mjs";

const ROOT = new URL("../../", import.meta.url).pathname;
const KNOWN_SCAN_SHA = "591b1615b674"; /* sha256 prefix of scan-ccitt-g4-page.pdf, the positive control */
/** @param {string[]} args
 *  @returns {string} */
const git = (args) => execFileSync("git", args, { cwd: ROOT, maxBuffer: 1 << 30 }).toString();

const DIR = process.argv.includes("--dir") ? process.argv[process.argv.indexOf("--dir") + 1] : null;
/** @type {[string, string][]} */
const MAGIC = [["%PDF", "pdf"], ["\x89PNG", "png"], ["\xff\xd8\xff", "jpeg"], ["II*\0", "tiff"], ["MM\0*", "tiff"]];
/** One blob or file whose first bytes are a PDF's or a picture's.
 *  @typedef {{ sha: string | null | undefined, kind: string, path: string | undefined, bytes: Uint8Array }} Hit */
/** The population censused: what was read, and the hits among it.
 *  @typedef {{ scanned: number, trees: number, hits: Hit[], label: string }} Population */
const blobs = DIR ? dirPopulation(DIR) : await gitPopulation();

/** @param {string} dir
 *  @returns {Population} */
function dirPopulation(dir) {
  const { readdirSync, readFileSync } = require_fs;
  /** @type {Population} */
  const out = { scanned: 0, trees: 0, hits: [], label: `directory ${dir}` };
  const files = readdirSync(dir).map((f) => ({ path: f, bytes: readFileSync(`${dir}/${f}`) }));
  files.push({ path: "(positive control) pdf-worker/test/fixtures/scan-ccitt-g4-page.pdf",
               bytes: readFileSync(`${ROOT}pdf-worker/test/fixtures/scan-ccitt-g4-page.pdf`) });
  for (const f of files) {
    out.scanned++;
    const head = f.bytes.subarray(0, 8).toString("latin1");
    for (const [m, kind] of MAGIC) if (head.startsWith(m))
      out.hits.push({ sha: null, kind, path: f.path, bytes: new Uint8Array(f.bytes) });
  }
  return out;
}

/** @returns {Promise<Population>} */
async function gitPopulation() {
/* ---- the population: every reachable blob, with a path it was reached by ---- */
const pathOf = new Map();
for (const line of git(["rev-list", "--all", "--objects"]).split("\n")) {
  const sp = line.indexOf(" ");
  if (sp > 0 && !pathOf.has(line.slice(0, sp))) pathOf.set(line.slice(0, sp), line.slice(sp + 1));
}
const refs = git(["for-each-ref", "--format=%(refname)"]).trim().split("\n").length;

return await new Promise((resolve, reject) => {
  const ids = [...pathOf.keys()];
  const p = spawn("git", ["cat-file", "--batch"], { cwd: ROOT });
  /* STREAMED, holding one object at a time: the whole store does not fit in memory
     (measured — the first version of this probe was killed buffering it). */
  /** @type {Population} */
  const out = { scanned: 0, trees: 0, hits: [], label: "" };
  let pend = Buffer.alloc(0);
  /** @type {{ sha: string | undefined, type: string | undefined, n: number } | null} */
  let cur = null;
  p.stdout.on("data", (d) => {
    pend = pend.length ? Buffer.concat([pend, d]) : d;
    for (;;) {
      if (!cur) {
        const nl = pend.indexOf(10);
        if (nl < 0) return;
        const [sha, type, size] = pend.subarray(0, nl).toString().split(" ");
        cur = { sha, type, n: Number(size) };
        pend = pend.subarray(nl + 1);
      }
      if (pend.length < cur.n + 1) return;
      const body = pend.subarray(0, cur.n);
      if (cur.type !== "blob") out.trees++;
      else {
        out.scanned++;
        const head = body.subarray(0, 8).toString("latin1");
        for (const [m, kind] of MAGIC) if (head.startsWith(m))
          out.hits.push({ sha: cur.sha, kind, path: pathOf.get(cur.sha), bytes: new Uint8Array(Buffer.from(body)) });
      }
      pend = Buffer.from(pend.subarray(cur.n + 1)); cur = null;
    }
  });
  p.on("error", reject);
  p.on("close", (code) => (code !== 0 ? reject(new Error(`git cat-file exited ${code}`)) : resolve(out)));
  out.label = `${refs} refs`;
  p.stdin.end(ids.join("\n") + "\n");
});
}

console.log(`D-321 census · ${new Date().toISOString()} · HEAD ${git(["rev-parse", "--short", "HEAD"]).trim()}`);
console.log(`population: ${blobs.label} · ${blobs.scanned} ${DIR ? "files" : "reachable blobs"} (${blobs.trees} trees/commits skipped)`);

let pages = 0, pdfs = 0;
/** @type {{ path: string | undefined, sha256: string, page: number }[]} */
const imageOnly = [];
/** @type {Hit[]} */
const rasters = [];
/** @type {(string | undefined)[]} */
const unreadable = [], encrypted = [];
for (const h of blobs.hits) {
  const sha256 = createHash("sha256").update(h.bytes).digest("hex");
  if (h.kind !== "pdf") { rasters.push(h); console.log(`  RASTER ${h.kind.padEnd(4)} ${h.path}  ${h.bytes.length} B  (judge by reading it)`); continue; }
  pdfs++;
  let doc;
  try { doc = await loadPdf(h.bytes); } catch (e) { unreadable.push(h.path); console.log(`  PDF UNREADABLE ${h.path}: ${e instanceof Error ? e.message : undefined}`); continue; }
  /* A file loadPdf does not open (no %PDF-x.y signature) stops the census, as it always did. */
  if (!doc) throw new TypeError(`${h.path}: not opened as a PDF`);
  /* AN ENCRYPTED FILE IS NOT CENSUSED (D-321 part 2, measured): its content streams are
     ciphertext to `analyzePage`, which then sees no text operator and calls a page with a
     full text layer image-only — the EBMUD agenda report's p0/p3 read that way (2,226
     characters on p0 by an independent reader). The OCR path refuses such a file before
     `analyzePage` (`renderPageToPixels`' ENCRYPTED), so it never reaches tier 3 either. */
  if (doc.isEncrypted()) { encrypted.push(h.path); console.log(`  PDF ENCRYPTED ${h.path}  sha256 ${sha256.slice(0, 12)}  pages ${doc.pageCount}  (not censused: streams are ciphertext here)`); continue; }
  const n = doc.pageCount;
  let io = 0;
  for (let i = 0; i < n; i++) {
    pages++;
    const a = await analyzePage(doc, i);
    /* A page analyzePage cannot read stops the census, as it always did. */
    if (!a) throw new TypeError(`${h.path}: page ${i} could not be analysed`);
    if (a.images.length > 0 && !a.hasTextOps) { io++; imageOnly.push({ path: h.path, sha256, page: i }); }
  }
  console.log(`  PDF  ${h.path}  sha256 ${sha256.slice(0, 12)}  pages ${n}  image-only ${io}`);
}
console.log(`\nPDFs ${pdfs} (unreadable ${unreadable.length}, encrypted ${encrypted.length}) · pages censused ${pages} · IMAGE-ONLY pages ${imageOnly.length} · raster blobs ${rasters.length}`);
for (const p of imageOnly) console.log(`  image-only: ${p.path} p${p.page} (${p.sha256.slice(0, 12)})`);

/* THE POSITIVE CONTROL — an empty answer from a census that cannot see the class is worth nothing. */
const control = imageOnly.some((p) => p.sha256.startsWith(KNOWN_SCAN_SHA));
if (!control || pages === 0) {
  console.log(`\nFAIL — the census did not find the known image-only page (${KNOWN_SCAN_SHA}…); its answer is not evidence`);
  process.exit(1);
}
const others = imageOnly.filter((p) => !p.sha256.startsWith(KNOWN_SCAN_SHA));
console.log(`\npositive control: FOUND the known scanned resolution as image-only`);
console.log(`image-only pages OTHER than the known resolution: ${others.length}`);
console.log(others.length ? "CANDIDATES — read each and judge whether it is agenda-shaped" : "ANSWER: no real scanned agenda page is held in this population");
