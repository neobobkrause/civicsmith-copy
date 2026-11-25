/* THE MEMBER, BOOTED FROM ITS COMMITTED BYTES, IN ONE PLACE.
 *
 * Deliberately NOT a `*.test.mjs`: it is a helper, not a suite, so a runner
 * handed the `*.test.mjs` files never runs it alone; the suites share it —
 * this member's own and the plane's OCR suites one tree over
 * (`bio-plane/test/d606-perpage-ocr.test.mjs`,
 * `bio-plane/test/m/extraction/convert-ocr.test.mjs`). Two copies of a
 * boot recipe is how the two come to differ in the one detail that matters.
 *
 * WHAT IT KNOWS THAT A ONE-PART MEMBER'S BOOT DOES NOT: this member is THREE
 * upload parts, and the two that are not JavaScript are the ones its stated
 * fidelity is a measurement of. `modules:true` cannot express that, so the
 * modules array is built by hand — an `ESModule` for the bundle, a
 * `CompiledWasm` for the engine core (Workers forbid runtime wasm compilation;
 * the platform compiles it at upload, and miniflare does the same at boot), and
 * a `Data` part for the language model. The module NAMES are the specifiers the
 * committed bundle imports, which is why `modulesRoot` is the member directory
 * and the parts sit under `assets/`.
 *
 * THE BUILT ARTIFACT IS WHAT BOOTS, never the source. It is not committed (R32):
 * the first boot in a process builds it into `dist/` with `scripts/build.mjs`,
 * the member's own build, and every boot after reads that build. Builds run
 * under a lock folder in `dist/`, so suites running side by side never read a
 * bundle another one is half way through writing.
 */
import { readFileSync, mkdirSync, rmSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const MEMBER_DIR = fileURLToPath(new URL("..", import.meta.url));
export const BUNDLE = fileURLToPath(new URL("../dist/ocr-worker.bundled.mjs", import.meta.url));
export const WASM = fileURLToPath(new URL("../assets/tesseract-core.wasm", import.meta.url));
export const MODEL = fileURLToPath(new URL("../assets/eng.traineddata", import.meta.url));
const BUILD = fileURLToPath(new URL("../scripts/build.mjs", import.meta.url));
const DIST = fileURLToPath(new URL("../dist/", import.meta.url));
const LOCK = fileURLToPath(new URL("../dist/.build-lock", import.meta.url));
let builtHere = false;

/* Runs `read` over the built bundle's text while holding the build lock, building the member first
   once in this process (R32). A lock left by a process that died is taken after five minutes. */
export function withBuiltBundle(read = (text) => text) {
  mkdirSync(DIST, { recursive: true });
  const pause = new Int32Array(new SharedArrayBuffer(4));
  for (const giveUp = Date.now() + 600_000; ;) {
    try { mkdirSync(LOCK); break; } catch (e) {
      if (e.code !== "EEXIST") throw e;
      try { if (Date.now() - statSync(LOCK).mtimeMs > 300_000) rmSync(LOCK, { recursive: true, force: true }); } catch { /* gone already */ }
      if (Date.now() > giveUp) throw new Error(`ocr-worker: the build lock ${LOCK} was held for ten minutes`);
      Atomics.wait(pause, 0, 0, 200);
    }
  }
  try {
    if (!builtHere) {
      execFileSync(process.execPath, [BUILD], { cwd: MEMBER_DIR, stdio: "pipe" });
      builtHere = true;
    }
    return read(readFileSync(BUNDLE, "utf8"));
  } finally {
    rmSync(LOCK, { recursive: true, force: true });
  }
}

/** The miniflare worker definition for this member. `extra` folds in bindings a
 *  caller wants (a confidence floor, a version string) without a second recipe. */
export function ocrWorkerDef({ name = "ocr-worker", bindings = {}, r2 = true } = {}) {
  return {
    name,
    modulesRoot: MEMBER_DIR,
    modules: [
      { type: "ESModule", path: BUNDLE, contents: withBuiltBundle() },
      { type: "CompiledWasm", path: WASM, contents: readFileSync(WASM) },
      { type: "Data", path: MODEL, contents: readFileSync(MODEL) },
    ],
    compatibilityDate: "2026-07-01",
    ...(r2 ? { r2Buckets: ["CAPTURES"] } : {}),
    bindings: { VERSION: "test", ...bindings },
  };
}
