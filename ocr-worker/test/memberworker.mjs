/* THE MEMBER, BOOTED FROM A FRESH BUILD OF ITS SOURCE, IN ONE PLACE.
 *
 * Deliberately NOT a `*.test.mjs`: it is a helper, not a suite, so a runner
 * handed the `*.test.mjs` files never runs it alone; the suites share it —
 * this member's own and the plane's OCR suites one tree over
 * (`bio-plane/test/d606-perpage-ocr.test.mjs`,
 * `bio-plane/test/m/reading-pipeline/convert-ocr.test.mjs`). Two copies of a
 * boot recipe is how the two come to differ in the one detail that matters.
 *
 * WHAT IT KNOWS THAT A ONE-PART MEMBER'S BOOT DOES NOT: this member is THREE
 * upload parts, and the two that are not JavaScript are the ones its stated
 * fidelity is a measurement of. `modules:true` cannot express that, so the
 * modules array is built by hand — an `ESModule` for the bundle, a
 * `CompiledWasm` for the engine core (Workers forbid runtime wasm compilation;
 * the platform compiles it at upload, and miniflare does the same at boot), and
 * a `Data` part for the language model. The module NAMES are the specifiers the
 * bundle imports, which is why `modulesRoot` is the member directory and the
 * parts sit under `assets/`.
 *
 * R32: A BUNDLE IS NEVER READ FROM THE CHECKOUT. It is built here, once for each
 * process that imports this file, by the one recipe `scripts/build.mjs` uses
 * (`bundler`'s `buildMember`), and booted from the bytes in memory under the
 * path `scripts/build.mjs` writes it to. Nothing is written, so suites run side
 * by side never read each other's half-written file.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { discoverMembers, buildMember } from "../../bio-plane/scripts/fleet-bundle.mjs";

/** @type {string} the member's folder, the boot's modulesRoot */
export const MEMBER_DIR = fileURLToPath(new URL("..", import.meta.url));
/** @type {string} the path `scripts/build.mjs` writes the bundle to, the name it boots under */
export const BUNDLE = fileURLToPath(new URL("../dist/ocr-worker.bundled.mjs", import.meta.url));
/** @type {string} the path of the engine core */
export const WASM = fileURLToPath(new URL("../assets/tesseract-core.wasm", import.meta.url));
/** @type {string} the path of the language model */
export const MODEL = fileURLToPath(new URL("../assets/eng.traineddata", import.meta.url));

const member = discoverMembers().find((m) => m.name === "ocr-worker");
if (!member || !member.bundle) throw new Error("ocr-worker: fleet-member.json declares no bundle, so the member cannot be built");
/** @type {string} the bundle, built from this checkout's source when this file is first imported (R32) */
export const BUNDLE_TEXT = (await buildMember(member)).bytes.toString("utf8");

/** The miniflare worker definition for this member. `extra` folds in bindings a
 *  caller wants (a confidence floor, a version string) without a second recipe.
 *  @param {{name?: string, bindings?: Record<string, string>, r2?: boolean}} [opts] absent name is "ocr-worker", r2 true
 *  @returns {{name: string, modulesRoot: string, modules: {type: string, path: string, contents: string | Buffer}[], compatibilityDate: string, r2Buckets?: string[], bindings: Record<string, string>}} */
export function ocrWorkerDef({ name = "ocr-worker", bindings = {}, r2 = true } = {}) {
  return {
    name,
    modulesRoot: MEMBER_DIR,
    modules: [
      { type: "ESModule", path: BUNDLE, contents: BUNDLE_TEXT },
      { type: "CompiledWasm", path: WASM, contents: readFileSync(WASM) },
      { type: "Data", path: MODEL, contents: readFileSync(MODEL) },
    ],
    compatibilityDate: "2026-07-01",
    ...(r2 ? { r2Buckets: ["CAPTURES"] } : {}),
    bindings: { VERSION: "test", ...bindings },
  };
}
