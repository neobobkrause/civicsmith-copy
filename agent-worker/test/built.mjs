/* The built bundle, for this module's tests that read it (R45, R120).
 *
 * agent-worker/dist/ commits nothing but its .gitignore (R120): the bundle and its manifest are built there by
 * scripts/build.mjs, the member's own build, whenever they are needed. The first read in a process builds them, and
 * every read after reads that build. Builds run under a lock folder in dist/, so suites running side by side never
 * read a bundle another one is half way through writing. A lock left by a process that died is taken after five
 * minutes. */
import { readFileSync, mkdirSync, rmSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const MEMBER_DIR = fileURLToPath(new URL("..", import.meta.url));
export const BUNDLE = fileURLToPath(new URL("../dist/agent-worker.bundled.mjs", import.meta.url));
export const MANIFEST = fileURLToPath(new URL("../dist/agent-worker.bundle.json", import.meta.url));
const BUILD = fileURLToPath(new URL("../scripts/build.mjs", import.meta.url));
const DIST = fileURLToPath(new URL("../dist/", import.meta.url));
const LOCK = fileURLToPath(new URL("../dist/.build-lock", import.meta.url));
let builtHere = false;

/**
 * Runs `read` while holding the build lock, building the member first once in this process (R120).
 * @template T
 * @param {() => T} read
 * @returns {T}
 */
export function withBuiltBundle(read) {
  mkdirSync(DIST, { recursive: true });
  const pause = new Int32Array(new SharedArrayBuffer(4));
  for (const giveUp = Date.now() + 600_000; ;) {
    try { mkdirSync(LOCK); break; } catch (e) {
      if (/** @type {{code?: string}} */ (e).code !== "EEXIST") throw e;
      try { if (Date.now() - statSync(LOCK).mtimeMs > 300_000) rmSync(LOCK, { recursive: true, force: true }); } catch { /* gone already */ }
      if (Date.now() > giveUp) throw new Error(`agent-worker: the build lock ${LOCK} was held for ten minutes`);
      Atomics.wait(pause, 0, 0, 200);
    }
  }
  try {
    if (!builtHere) {
      execFileSync(process.execPath, [BUILD], { cwd: MEMBER_DIR, stdio: "pipe" });
      builtHere = true;
    }
    return read();
  } finally {
    rmSync(LOCK, { recursive: true, force: true });
  }
}

/**
 * The manifest scripts/build.mjs writes beside the bundle, built first when this process has not built it.
 * @returns {{inputs?: Array<{path: string}>}}
 */
export const builtManifest = () => withBuiltBundle(() => JSON.parse(readFileSync(MANIFEST, "utf8")));
