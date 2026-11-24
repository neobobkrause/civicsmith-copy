/* THE MEMBER'S CONTRACT AND ITS THREE MEASURED NUMBERS, in a module that
 * imports NO ENGINE — and that is the point of the file rather than tidiness.
 *
 * `tessengine.mjs` imports the wasm core and the language model as WORKERS
 * MODULE TYPES (`CompiledWasm` and `Data`). Node cannot resolve either, so any
 * module that reaches the engine is a module a node-side suite cannot import at
 * all. Putting the constants and the chunk rule here means the SUITE DRIVES THE
 * SAME EXPRESSION THE WORKER RUNS, rather than a copy of it written out again in
 * a test — which is the shape that eventually disagrees, measured six times in
 * this estate (one of them recorded by the fleet-coverage instrument, since
 * retired, on the fleet `control` flag: the arm written to prove a fix came back
 * GREEN because nothing read the flag any more).
 */

/* ===================================================================== *
 * THE MEASURED NUMBERS. There are three and that is all; every other
 * figure this member reports is observed at run time. A measured number
 * with no pointer to its measurement is the failure CLAUDE.md records as
 * this project's most-repeated, so none is written here without one.
 * ===================================================================== */

/** The transcription-fidelity letter this member's answer may support, and the
 *  ONE thing the plane will not accept a default for.
 *
 *  `C`, and the reasoning is the record's own rather than a preference: the
 *  strongest capture grade this system earns without a member's attestation is
 *  `B` (`EARNED_CAPTURE_CEILING`), an OCR pass is a machine transcription of a
 *  picture of text with nobody having looked, and CPDF-10's doctrine is that OCR
 *  NEVER RAISES A CAPTURE GRADE. `C` is the letter `textchain.mjs`'s own D-252
 *  note already uses for an OCR pass, so this member reports the letter this
 *  estate already means rather than minting a second convention. */
import { localize } from "../../bio-plane/src/setup-words/index.mjs";
import { boundOf } from "../../bio-plane/src/read-bounds.mjs";

export const CAP = "C";

/** Where that letter's measurement lives. A free string a HUMAN follows — the
 *  machine-followable half is CPDF-13's calibration reference, which the PLANE
 *  joins on `engine`+`version` and this member deliberately does not hold (a
 *  measurement must not acquire a second home; extraction's
 *  `bio-plane/src/extraction/pipeline.mjs` says so at the join). */
export const MEASURED_BY =
  localize("ocr-worker.contract.measurements_md_2026_09_10", "MEASUREMENTS.md 2026-09-10 (CPDF-15) — tesseract-wasm@0.11.0 SIMD + tessdata_fast eng on the deployed Workers runtime: 99.89% characters and 89/90 digits with ZERO minted on the one human-ground-truthed page (Oakland Legistar attachment 15721260 p2, 300 dpi), reproducible over identical bytes (9 images x 3 runs, no image gave more than one distinct text), the invention band EMPTY at every rung of CPDF-11's ladder. REACH, STATED: ONE ground-truthed page, ONE engine version, ONE model. Every other corpus figure in that row is agreement-with-the-local-floor and NOT accuracy — and D-314/CPDF-16 measured that NEITHER local model passes the noise control, so no agreement figure may be read as accuracy at all.");

/** The largest RGBA frame CPDF-15 measured COMPLETING on the deployed runtime,
 *  in bytes. **A WORKLOAD SIZE, NEVER A SHARE OF 128 MB** — D-312 exists because
 *  the platform's `memoryUsageBytes` reads 132–240 MB on invocations the platform
 *  itself marks `success`, so any percentage computed from it is a wrong answer
 *  carrying full confidence. The ceiling was located the way this project locates
 *  every ceiling, BY BEING REFUSED: 33.7 / 48.5 / 61.3 MB frames complete, a
 *  75.7 MB frame is KILLED (`exceededMemory`, reproduced), and 134.6 MB is
 *  refused in-isolate as a catchable `RangeError`. */
export const MAX_FRAME_BYTES = boundOf("ocr", "frame_bytes");

/** The frame a page of these pixel dimensions costs. `loadImage` refuses
 *  anything shorter than width*height*4, so this is not avoidable by sending
 *  less (CPDF-15 measured that refusal). */
export const frameBytesOf = (w, h) => w * h * 4;

/* D-478 — THE NAMESPACES THIS MEMBER WILL READ FROM: EXACTLY `bio` OR `scratch`, AND NOTHING ELSE.
 *
 * Before D-478 the store test read `/^[a-z0-9_-]+$/i`, so `biosmoke`, `Scratch` and any well-shaped name was spent
 * as the R2 key prefix and came back 404 NOT_FOUND — the same answer as a capture genuinely absent from a real
 * namespace. *Not found* is not *absent*, and this member's output is GRADED: a page reported unread because the
 * capture "was not there" is a fact about the document, when the truth was a fact about the NAME.
 *
 * The set is the plane's (`namespaceGate` holds `Object.freeze(["bio", SCRATCH])` in code, the same on every
 * instance), kept here as a COPY because a fleet member cannot import the plane (a later module). A copy ages, so it is
 * EXPORTED, and control-plane (layer 11, which may import this module) pins it equal to its own namespace gate —
 * the check that used to parse the plane's source from here, and went empty when that source moved (N402). Exact and case-sensitive: an R2
 * key is an exact string. NOT NAMING ONE is a different condition, BAD_STORE (`store` absent or not a string); an
 * empty `store: ""` is a NAMED value and meets NAMESPACE_UNKNOWN. */
export const NAMESPACES = Object.freeze(["bio", "scratch"]);

/* THE PLANE OPS THIS MEMBER CALLS: NONE. It is called BY the plane (extraction's `OCR_WORKER` binding) and reads
 * only `CAPTURES.get` (R21); it holds no credential and names no op. Declared in the same shape as agent-worker's
 * `PLANE_OPS` (`{op: {mutating, why}}`) so control-plane's pin reads both members the one way: every op a member
 * exports is in the op table with the class and namespace gate the member assumes. An empty set is the claim. */
export const PLANE_OPS = Object.freeze({});

/* ===================================================================== *
 * Refusals. Every one is STATED, carries what it saw, and leaves the
 * document HONESTLY UNREAD rather than half-transcribed.
 * ===================================================================== */
export const REFUSALS = {
  R2_NOT_CONFIGURED: "this member holds no CAPTURES binding, so it cannot read the bytes",
  BAD_SHA: "capture_sha must be 64 lowercase hex",
  BAD_STORE: localize("ocr-worker.contract.store_must_be_named_this", "store must be named: this member reads a capture from one namespace and guesses none"),
  /* D-478. Deliberately says what it is NOT as well as what it is: the answer this replaces was NOT_FOUND, and a
     reader who cannot tell the two apart reads "there is no such capture" where the truth is "there is no such
     namespace" (CLAUDE.md §1 — *not found* is not *absent*). */
  NAMESPACE_UNKNOWN: localize("ocr-worker.contract.no_namespace_by_that_name", "no namespace by that name exists on any instance this member can be bound to, so nothing was read; the two that exist are listed beside this message. This is not NOT_FOUND, which says the namespace exists and holds no such capture"),
  BAD_PAGES: localize("ocr-worker.contract.pages_must_be_a_non", "pages must be a non-empty array of 0-based page numbers"),
  NOT_FOUND: localize("ocr-worker.contract.no_capture_with_that", "no capture with that sha in that store"),
  ENGINE_ABSENT: "the OCR engine did not load; this member cannot transcribe anything",
  PAGE_NOT_RENDERABLE: localize("ocr-worker.contract.the_page_could_not", "the page could not be turned into pixels, and the renderer says why"),
  FRAME_OVER_MEASURED_BOUND: localize("ocr-worker.contract.this_page_s_frame_is", "this page's frame is larger than the largest frame measured to complete"),
  PIXELS_UNREADABLE: localize("ocr-worker.contract.the_rendered_container_could_not", "the rendered container could not be read back to samples"),
  ENGINE_FAILED: localize("ocr-worker.contract.the_engine_refused_or_failed", "the engine refused or failed on this frame"),
  NOTHING_TRANSCRIBED: localize("ocr-worker.contract.the_engine_returned_no_anchorable", "the engine returned no anchorable word for this page"),
  /* R23. A picture is a one-page document; this is not the renderer's refusal (R7 step 2) but the member's own,
     stated before any pixel is made, so the page asked for is named. */
  NO_SUCH_PAGE: localize("ocr-worker.contract.a_picture_is_a_one", "a picture is a one-page document (page 0); the page asked for does not exist"),
  /* R25. The engine read the picture and rated almost none of it: the text is not returned, and the refusal says so. */
  PICTURE_NOT_LEGIBLE: localize("ocr-worker.contract.the_picture_is_too_unclear_to_read", "the picture is too unclear to read: the engine rated almost none of its words as read, so no text is given rather than text that is mostly wrong"),
  /* R25 (fix round 9, G137d). The same finding for a page of a PDF: the rule is one for photographs and pages alike. */
  PAGE_NOT_LEGIBLE: localize("ocr-worker.contract.this_page_is_sideways_or_too_faint_to_read", "this page is sideways or too faint to read: the engine rated almost none of its words as read, so no text is given rather than text that is mostly wrong"),
  /* R28 (fix round 9, G132j). Whatever threw inside a call the request checks had accepted. */
  UNEXPECTED_FAILURE: localize("ocr-worker.contract.something_failed_inside_this_call", "something failed inside this call before the page could be read; the step and the error's name are beside this message, and the page stays unread"),
  /* R29 (fix round 9, G125g). The instance setting `OCR_PSM` is set and names no page-segmentation mode. */
  BAD_PSM: localize("ocr-worker.contract.ocr_psm_is_not_a_page_segmentation_mode", "this member's OCR_PSM setting is not a page-segmentation mode the engine accepts (a whole number from 0 to 13), so no page was read"),
};

/** R29 · The page-segmentation modes the engine accepts: tesseract's own `PageSegMode` set, the whole numbers 0 to 13
 *  (the engine itself accepts any text as the variable's value and ignores a wrong one, which is why this member judges
 *  the setting). A mode is a name, not a ceiling. */
export const PAGE_SEG_MODES = Object.freeze(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"]);

/** R29 · `OCR_PSM` read as the engine's mode: `{set:false}` when it is absent or empty, `{set:true, ok, mode?, value}`
 *  otherwise, `value` the setting as text truncated to 80 characters. */
export function psmFrom(env) {
  const raw = env && env.OCR_PSM;
  if (raw == null || raw === "") return { set: false, ok: true, mode: null };
  const text = typeof raw === "string" || typeof raw === "number" ? String(raw) : null;
  const ok = text != null && PAGE_SEG_MODES.includes(text);
  return { set: true, ok, mode: ok ? text : null, value: (text == null ? JSON.stringify(raw) ?? String(raw) : text).slice(0, 80) };
}

/** R26 · The turns a renderer is asked for and the engine can name. */
export const QUARTER_TURNS = Object.freeze([0, 90, 180, 270]);
/** R26 · The engine says by how many degrees clockwise the frame lies turned from upright; the renderer's `turn`
 *  (pdf-pixels R48) is the degrees clockwise to apply, so upright again is the rest of the way round. */
export const turnToUpright = (rotation) => (QUARTER_TURNS.includes(rotation) ? (360 - rotation) % 360 : null);

/** R25 · A word the engine rated at or over this (its own 0..1 confidence for the word, R9's basis) counts as read.
 *  Not a measurement of accuracy: over the fixtures of `pdf-pixels` R44 and this module's tests, the share of words rated
 *  this high came within 0.1 of the share of the page's words truly read, and under it (0.5 / 0.2 / 0.0 against the true
 *  share 0.6 / 0.0 at the hard pages, 0.97-1.00 for the clean ones), which is what makes the share a statement and not a
 *  guess. A line's own rating is the mean of its words', so one bad word would hide its good ones: the words are rated. */
export const LEGIBLE_CONFIDENCE = 0.6;
/** R25 · A picture whose share of words read is under this has it said in a note. */
export const LEGIBLE_NOTE_BELOW = 0.8;
/** R25 · A picture whose share of words read is under this is refused `PICTURE_NOT_LEGIBLE`. */
export const LEGIBLE_REFUSE_BELOW = 0.2;

/** R23 · THE LONG EDGE A PICTURE IS REDUCED TO, in pixels. Not a measurement: it is `PICTURE_FRAME_MAX`'s own
 *  4096-pixel edge (pdf-pixels R42), so a 12-megapixel camera frame (4032 x 3024, 4000 x 3000) reaches the engine
 *  at its own resolution and a larger one is reduced by a whole factor; a 4:3 frame at this edge is 50.3 MB of
 *  RGBA, under `MAX_FRAME_BYTES`, and a squarer frame that would pass it is refused by R7 step 4, never attempted. */
export const PICTURE_MAX_EDGE = boundOf("ocr", "picture_edge");

/** R23 · Are these bytes a JPEG or a PNG picture, by their signature? The picture renderer re-judges them; this
 *  only decides which renderer is asked, so bytes that are neither are left to the page renderer's refusal as today. */
export function isPicture(bytes) {
  const b = bytes;
  if (!b || b.length < 4) return false;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true;
  return b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
    && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a;
}

/** ONE PAGE PER INVOCATION. The page this call will do, and the ones it will not.
 *
 *  It TAKES THE LOWEST and DEFERS the rest rather than looping, and the bound is
 *  MEMORY: whole-document invocation is UNMEASURED (CPDF-15 says so in its own
 *  row) and an unmeasured loop inside a memory ceiling is how a member starts
 *  returning half a document with no way to tell. The plane already carries the
 *  honest reading of a partial answer — a selected page nobody answered for
 *  KEEPS ITS MARKER and stays unread (`mergeTier3Text`) — so chunking costs
 *  another invocation while assuming costs a document that is silently partial. */
export function chooseChunk(pages) {
  const clean = [];
  for (const p of Array.isArray(pages) ? pages : [])
    if (Number.isInteger(p) && p >= 0 && !clean.includes(p)) clean.push(p);
  clean.sort((a, b) => a - b);
  return { take: clean.length ? clean[0] : null, deferred: clean.slice(1) };
}

/** R7.4 (fix round 9, G125g) · The frame a picture will reach the engine as, judged from its header before anything is
 *  rendered: `source` is `{size, readRange(offset, length)}`; answers `{width, height, frame_bytes}` for the picture as the
 *  renderer reduces it to `maxEdge` (the renderer's own rule: the smallest whole factor that brings the long edge under
 *  it, each side rounded up), or `null` when the header cannot be read here (the rendered frame is judged anyway).
 *  The preparation only turns the lines level and enlarges, never shrinks, so a frame over the bound here is over it
 *  once prepared: a refusal on this figure is certain. */
export async function declaredPictureFrame(source, maxEdge = PICTURE_MAX_EDGE) {
  const dims = await pictureDims(source);
  if (!dims) return null;
  const k = Math.max(1, Math.ceil(Math.max(dims.width, dims.height) / maxEdge));
  const width = Math.ceil(dims.width / k), height = Math.ceil(dims.height / k);
  return { width, height, frame_bytes: frameBytesOf(width, height), declared: dims, reduced_by: k };
}

const SOF = (m) => m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;
/** How much of a picture's start is read to find its header: the PNG's IHDR is in the first 33 bytes, a JPEG's frame
 *  header follows its application segments. A header not found inside it is not judged here (the render is). A read
 *  size, never a limit the file is refused on. */
const HEADER_WINDOW = 65536;
async function pictureDims({ readRange }) {
  const b = await readRange(0, HEADER_WINDOW);
  if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50) {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    return dv.getUint32(8) === 13 ? { width: dv.getUint32(16), height: dv.getUint32(20) } : null;
  }
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let at = 2;
  while (at + 9 <= b.length) {
    if (b[at] !== 0xff) return null;
    const m = b[at + 1];
    if (SOF(m)) return { width: (b[at + 7] << 8) | b[at + 8], height: (b[at + 5] << 8) | b[at + 6] };
    if (m === 0xd9 || m === 0xda) return null;
    at += 2 + ((b[at + 2] << 8) | b[at + 3]);
  }
  return null;
}

/** R27 · A captured object as the renderers take it in place of its bytes (pdf-pixels R47): the object's size and a
 *  ranged read of it. `bytes` is one that is already whole in memory (a caller that holds it, a test). */
export function sourceOfBytes(bytes) {
  return { size: bytes.length, readRange: async (offset, length) => bytes.subarray(offset, offset + length) };
}
