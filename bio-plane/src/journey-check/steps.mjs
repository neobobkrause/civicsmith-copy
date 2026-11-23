/* journey-check R32: `node bio-plane/src/journey-check/steps.mjs <address> <step file>...` runs the named walk steps
   (files under a module's `walk/internal/` or `walk/external/`, Process4 build text 3, section 3) against the address, one
   after another in the order given, and opens nothing else: one browser, whose profile folder is made outside the
   repository for this run and removed when the run ends.

   A step file begins with its header, one line each, optionally behind `//` or ` *` of a comment:
       requirement: <module> <requirement number>
       follows: screen <page> / <screen> / <part>        (internal)   or   follows: journey <page> / step <number>  (external)
       expects: <the document's own words for what must be so>
   and its default export is `async (step) => saw`, where `step` is `{ page, address, at(path), keep(name, value), kept(name) }`.
   It throws to fail; what it returns, or what it threw, is printed as what it saw. A file without the three header lines is
   reported as not a step and is not run.

   A sign-in a step makes through the copy's own first-use door lives in the browser's profile folder, and any value a step
   keeps with `keep` lives in that same folder: both are read by later steps of the same run, never printed, and gone with
   the folder at the run's end. No sign-in is read from the environment. Exits 0 only when every named file is a step and
   every step passed. */
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/* The header lines a step begins with, in order (build text 3, section 3). */
export const HEADER = Object.freeze(["requirement", "follows", "expects"]);

/**
 * The header of a step file's text: its three lines, or null when it is not a step. Leading comment openers and blank lines
 * are passed over; the header must come before any code.
 * @param {string} text
 * @returns {{requirement: string, follows: string, expects: string} | null}
 */
export function readHeader(text) {
  /** @type {Record<string, string>} */
  const found = {};
  for (const raw of String(text).split("\n")) {
    const line = raw.replace(/^\s*(\/\*+|\/\/+|\*)?\s?/, "").replace(/\s*\*\/\s*$/, "").trimEnd();
    if (!line) continue;
    const m = /^(requirement|follows|expects):\s*(\S.*)$/.exec(line);
    if (!m) break;
    if (Object.hasOwn(found, m[1])) break;
    found[m[1]] = m[2];
    if (HEADER.every((k) => Object.hasOwn(found, k))) break;
  }
  if (!HEADER.every((k) => Object.hasOwn(found, k))) return null;
  if (!/^\S+ R\d+/.test(found.requirement) || !/^(screen|journey) /.test(found.follows)) return null;
  return { requirement: found.requirement, follows: found.follows, expects: found.expects };
}

/* The one line of what a step saw, its text kept exactly (newlines shown as `\n`). */
const sawLine = (v) => String(v ?? "").replace(/\r?\n/g, "\\n");

/* The real browser: Chromium through playwright-core, with its profile in `folder`. Answers `{ page, close }`. */
async function chromiumIn(folder) {
  const { chromium } = await import("playwright-core");
  const { chromiumPath } = await import("./run.mjs");
  const executablePath = chromiumPath({ pinned: chromium.executablePath() });
  const context = await chromium.launchPersistentContext(folder, { ...(executablePath ? { executablePath } : {}) });
  const page = context.pages()[0] || await context.newPage();
  return { page, close: () => context.close() };
}

/**
 * Runs the step files against the address, in order. `launch(folder)` opens the browser (the real one unless given);
 * `write(line)` prints a line. Answers whether every file was a step that passed.
 * @param {{address: string, files: string[], launch?: (folder: string) => Promise<{page: any, close: () => Promise<void>}>, write?: (line: string) => void}} run
 * @returns {Promise<{ok: boolean, passed: number, failed: number, notSteps: number}>}
 */
export async function runSteps({ address, files, launch = chromiumIn, write = (l) => process.stdout.write(l + "\n") }) {
  if (!/^https?:\/\/[^/\s]+/.test(String(address || ""))) throw new Error(`the address must be http(s)://<host>, not ${JSON.stringify(address)}`);
  const base = String(address).replace(/\/+$/, "");
  const steps = files.map((file) => {
    let text = null;
    try { text = readFileSync(file, "utf8"); } catch (e) { return { file, header: null, why: `cannot be read: ${e.message}` }; }
    const header = readHeader(text);
    return { file, header, why: header ? null : "has no requirement, follows and expects lines at its top" };
  });
  let passed = 0, failed = 0, notSteps = 0;
  for (const s of steps) if (!s.header) { notSteps++; write(`${s.file}: not a step (${s.why}); not run`); }
  const runnable = steps.filter((s) => s.header);
  if (runnable.length) {
    const folder = mkdtempSync(join(tmpdir(), "journey-check-steps-"));
    const keptDir = mkdtempSync(join(folder, "kept-"));
    let browser = null;
    try {
      browser = await launch(join(folder, "profile"));
      const step = {
        page: browser.page,
        address: base,
        at: (path = "/") => base + (String(path).startsWith("/") ? path : "/" + path),
        keep: (name, value) => writeFileSync(join(keptDir, encodeURIComponent(name)), JSON.stringify(value)),
        kept: (name) => {
          const f = join(keptDir, encodeURIComponent(name));
          return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : undefined;
        },
      };
      for (const s of runnable) {
        write(`${s.file}`);
        for (const k of HEADER) write(`  ${k}: ${s.header[k]}`);
        try {
          const mod = await import(pathToFileURL(resolve(s.file)).href);
          if (typeof mod.default !== "function") throw new Error("the step exports no default function");
          const saw = await mod.default(step);
          passed++;
          write(`  passed${saw === undefined ? "" : `: ${sawLine(saw)}`}`);
        } catch (e) {
          failed++;
          write(`  failed: ${sawLine(e && e.message !== undefined ? e.message : e)}`);
        }
      }
    } finally {
      if (browser) await browser.close().catch(() => {});
      rmSync(folder, { recursive: true, force: true });
    }
  }
  write(`steps: ${passed} passed, ${failed} failed${notSteps ? `, ${notSteps} not steps` : ""}`);
  return { ok: failed === 0 && notSteps === 0 && passed > 0, passed, failed, notSteps };
}

/* Whether `entry` (the process's `argv[1]`) is this file, through any link (R4's guard, as `journey.mjs` has it). */
const isEntry = (entry) => {
  try { return !!entry && realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
};

if (isEntry(process.argv[1])) {
  const [address, ...files] = process.argv.slice(2);
  if (!address || !files.length) {
    process.stderr.write("usage: node bio-plane/src/journey-check/steps.mjs <address> <step file>...\n");
    process.exit(2);
  }
  try {
    const r = await runSteps({ address, files });
    process.exit(r.ok ? 0 : 1);
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    process.exit(2);
  }
}
