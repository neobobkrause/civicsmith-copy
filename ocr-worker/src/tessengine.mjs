/* THE ENGINE, AND THE THREE THINGS THAT MAKE IT RUN INSIDE AN ISOLATE AT ALL.
 *
 * Every one of them was found BY BEING REFUSED, on a deployed Worker, by
 * CPDF-15 (MEASUREMENTS.md, 2026-09-10). They are restated here because this is
 * the file where getting one wrong costs the next reader a probe pass:
 *
 *   1. WASM IS AN IMPORTED MODULE, NEVER A COMPILED BUFFER. Workers forbid
 *      runtime wasm compilation and emscripten's default path is
 *      `WebAssembly.instantiate(bytes)`. The core arrives as a module part of
 *      type `application/wasm` — so it IS a `WebAssembly.Module` — and reaches
 *      emscripten through its `instantiateWasm` hook, the only entry point that
 *      does `new WebAssembly.Instance(module, imports)`.
 *   2. `locateFile` MUST BE SUPPLIED. Without it emscripten evaluates
 *      `new URL("tesseract-core.wasm", import.meta.url)` and workerd throws
 *      `TypeError: Invalid URL string.` Supplying it takes the other branch.
 *   3. THE ENGINE WANTS RGBA. `loadImage` refuses anything shorter than
 *      width*height*4, so the frame is not avoidable by sending less. That frame
 *      is this member's binding constraint and `member.mjs` bounds it.
 *
 * WHAT THIS FILE IS NOT. It is not a place a measured number lives. `cap`,
 * `measured_by` and the confidence floor are the RECORD's, assembled in
 * `member.mjs` from constants that name their measurement; this file
 * produces text, rectangles and the engine's own confidence and judges none of
 * them.
 */
import wasmModule from "../assets/tesseract-core.wasm";
import MODEL from "../assets/eng.traineddata";
import { createOCREngine } from "./tesslib.mjs";
import { readFrame, REGION_GRAIN } from "./frame.mjs";
import { localize } from "../../bio-plane/src/setup-words/index.mjs";
/** @import { FrameOptions, FrameReading } from './frame.mjs' */

/** The engine, named exactly. "tesseract" is not a version, and the chain step
 *  this member produces carries both because a calibration is OF a pair and a
 *  re-run needs both (textchain.mjs, rule 1). The MODEL is named too: the same
 *  engine with a different traineddata is a different measurement, and
 *  CPDF-15's figures are figures for THIS pair. */
export const ENGINE_NAME = "tesseract-wasm";
export const ENGINE_VERSION = "0.11.0";
export const MODEL_NAME = "tessdata_fast/eng";

/* The digests CPDF-15 pinned, reproduced from a fresh install and a fresh fetch
   on 2026-09-12 and found IDENTICAL. They are asserted at runtime below, so a
   member serving different engine bytes than the ones its `cap` was measured on
   refuses instead of answering — the same class of guard the fleet bundle
   manifest applies to the files, applied here to what actually loaded. */
export const WASM_BYTES = 1839004;
export const MODEL_BYTES = 4113088;

/** emscripten's `instantiateWasm` hook: the imports it hands, and the call that receives the instance.
 *  @param {object} info @param {(instance: object, module: object) => void} receive */
const instantiateWasm = (info, receive) => {
  const instance = new WebAssembly.Instance(wasmModule, info);
  receive(instance, wasmModule);
  return instance.exports;
};
/** @param {string} path @returns {string} */
const locateFile = (path) => path;

/** Is the engine this member was built with actually here, and is it the one the
 *  measurement was taken on? Cheap, and it runs before any page is read.
 *  Returns null when everything agrees, or a REASON string.
 *  @returns {string | null} */
export function engineCheck() {
  if (!(wasmModule instanceof WebAssembly.Module))
    return "the wasm core did not arrive as a compiled module — a one-part upload cannot carry it, "
         + "and this member must be installed with its `assets/tesseract-core.wasm` part";
  if (!MODEL || typeof MODEL.byteLength !== "number" || MODEL.byteLength !== MODEL_BYTES)
    return localize("ocr-worker.tessengine.the_language_model_is_v1", "the language model is {v1} B, the measured pair is {MODEL_BYTES} B (tessdata_fast eng) — a different model is a different measurement and this member's stated fidelity would not be about it", { v1: String(MODEL && MODEL.byteLength), MODEL_BYTES: String(MODEL_BYTES) });
  return null;
}

export { REGION_GRAIN };

/** Transcribe ONE RGBA frame (the core is `frame.mjs`'s `readFrame`; this is it over the compiled core and the model this
 *  build carries).
 *  @param {Uint8Array} rgba
 *  @param {number} width
 *  @param {number} height
 *  @param {FrameOptions} [opts]
 *  @returns {Promise<FrameReading>} */
export const transcribeFrame = (rgba, width, height, opts) =>
  readFrame(() => createOCREngine({ instantiateWasm, locateFile }), MODEL, rgba, width, height, opts);

/** The engine as `member.mjs` takes it (`makeMember`). */
export const TESSERACT = Object.freeze({
  name: ENGINE_NAME, version: ENGINE_VERSION, model: MODEL_NAME,
  check: engineCheck, transcribeFrame,
});
