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
 * THE COMMITTED ARTIFACT IS WHAT BOOTS, never the source. That is the property
 * `newgroup` needs and the one FL-9's guard exists to keep true.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const MEMBER_DIR = fileURLToPath(new URL("..", import.meta.url));
export const BUNDLE = fileURLToPath(new URL("../dist/ocr-worker.bundled.mjs", import.meta.url));
export const WASM = fileURLToPath(new URL("../assets/tesseract-core.wasm", import.meta.url));
export const MODEL = fileURLToPath(new URL("../assets/eng.traineddata", import.meta.url));

/** The miniflare worker definition for this member. `extra` folds in bindings a
 *  caller wants (a confidence floor, a version string) without a second recipe. */
export function ocrWorkerDef({ name = "ocr-worker", bindings = {}, r2 = true } = {}) {
  return {
    name,
    modulesRoot: MEMBER_DIR,
    modules: [
      { type: "ESModule", path: BUNDLE, contents: readFileSync(BUNDLE, "utf8") },
      { type: "CompiledWasm", path: WASM, contents: readFileSync(WASM) },
      { type: "Data", path: MODEL, contents: readFileSync(MODEL) },
    ],
    compatibilityDate: "2026-07-01",
    ...(r2 ? { r2Buckets: ["CAPTURES"] } : {}),
    bindings: { VERSION: "test", ...bindings },
  };
}
