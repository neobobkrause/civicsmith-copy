/* sheet-worker's contract and its fixed numbers, in a module that imports NO ENGINE, so a node-side suite and the
 * build script read the same constants the worker runs on (the ocr-worker precedent: `engine.mjs` imports the wasm
 * as a Workers module type, which node cannot resolve).
 */

/* ---- the engine (R13) --------------------------------------------------------------------------------------- */

import { boundOf } from "../../bio-plane/src/read-bounds.mjs";
import { localize, word } from "../../bio-plane/src/setup-words/index.mjs";

export const ENGINE_NAME = "ironcalc";
/** The IronCalc commit the engine is built from (`engine/Cargo.toml`), with the `xlsx` feature's reader: npm's
 *  `@ironcalc/wasm` reads no XLSX (courts-workbooks.md §3(c)). */
export const ENGINE_VERSION = "4deab8f6e6a858744f8966f67f70f4ed8d29c78d";
/** The vendored `assets/sheet-engine.wasm`: its byte length and SHA-256, as `scripts/build-engine.mjs` printed them. */
export const WASM_BYTES = 1866957;
export const WASM_SHA256 = "6cb03bcc9e5cf23e189b45fd88373b44576ec297b76db1675a430ee1254ced3d";
/** The custom section the build appends, naming the commit and the code it was appended to. */
export const ENGINE_SECTION = "bio-engine";
/** The calls the glue makes into the wasm; a module without every one of them is not this engine. */
export const ENGINE_EXPORTS = Object.freeze(["memory", "book_load", "book_evaluate", "inspect", "engine_commit",
  "__wbg_book_free"]);

/* ---- the bounds (R3, R14) ------------------------------------------------------------------------------------ *
 * Measured by SHEET-WORKER #1 (T33, 2026-10-05) running this engine build over the 288 corpus workbooks
 * (courts-workbooks.md §3) in V8 (node), the engine Workers run, against the platform's limits: 128 MB per isolate and
 * the 300,000 ms CPU ceiling the configuration declares. Memory binds first: the instance's linear memory runs at
 * 3 to 7 times a workbook's unzipped size. Under these bounds the largest memory measured was 59.2 MB (8.85 MB
 * unzipped, 17,823 formulas; the largest frame ocr-worker measured completing in an isolate is 61.3 MB) and the
 * longest load plus evaluation 13.3 s. Above them sit the 10.3 MB Annual Progress Reports (74-75 MB, about 57 s) and
 * five workbooks of 14-30 MB that did not finish in 600 s. The job's record holds the full figures. The three values are
 * the `sheet_worker` rows of runtime-limits' `READ_BOUNDS` (R14), read through `boundOf` and typed nowhere else. */

/** Unzipped bytes of every part of the package, counted as they decompress. */
export const MAX_UNZIPPED_BYTES = boundOf("sheet_worker", "bytes");
/** `<c>` elements across the worksheets. */
export const MAX_CELLS = boundOf("sheet_worker", "cells");
/** Milliseconds the engine may spend loading before evaluation is not started: a backstop, since every load under the
 *  bounds took at most 6.3 s, and evaluation took at most 1.1 times its load, so a load within this leaves evaluation
 *  inside the CPU ceiling. Read after a turn boundary (workerd advances its clock only between turns). */
export const TIME_BUDGET_MS = boundOf("sheet_worker", "ms");

/* ---- the switch (R2) ------------------------------------------------------------------------------------------ */

/** The instance setting that enables recompute; any value but exactly "on" leaves the member answering NOT_ENABLED. */
export const SETTING = "SHEET_RECOMPUTE";
export const enabledIn = (env) => (env && env[SETTING]) === "on";

/* ---- namespaces and plane ops (R11) --------------------------------------------------------------------------- */

/** Exactly the two namespaces the plane's gate holds, a copy because a fleet member cannot import the plane;
 *  control-plane pins this export equal to its own gate (as `ocr-worker` R16). */
export const NAMESPACES = Object.freeze(["bio", "scratch"]);
/** The plane ops this member calls: none. It is called by the plane and reads only `CAPTURES.get`. */
export const PLANE_OPS = Object.freeze({});

/* ---- answers --------------------------------------------------------------------------------------------------- */

export const NOT_RECOMPUTED = word("workbooks.recomputed");

/** The volatile functions R6 names. The engine marks a formula cell volatile when it calls one of them. */
export const VOLATILE_FUNCTIONS = Object.freeze(["NOW", "TODAY", "RAND", "RANDBETWEEN", "OFFSET", "INDIRECT", "CELL",
  "INFO"]);

/** The causes R5 names for a cell whose result is an error value. */
export const CAUSES = Object.freeze(["unsupported_function", "implicit_intersection", "circular", "not_implemented",
  "undetermined"]);

/** R3's refusals, in the order they are checked; the first that applies is the one reported. */
export const WORKBOOK_REFUSALS = Object.freeze(["ENGINE_ABSENT", "NOT_A_WORKBOOK", "OVER_BOUND", "EXTERNAL_LINKS",
  "ENGINE_FAILED", "TIME_LIMIT"]);

export const REFUSALS = Object.freeze({
  BAD_SHA: "capture_sha must be 64 hex characters",
  BAD_STORE: localize("sheet-worker.contract.store_must_be_named_this", "store must be named: this member reads a capture from one namespace and guesses none"),
  NAMESPACE_UNKNOWN: "no namespace by that name exists, so nothing was read; the two that exist are listed beside "
    + "this message. This is not NOT_FOUND, which says the namespace exists and holds no such capture",
  R2_NOT_CONFIGURED: "this member holds no CAPTURES binding, so it cannot read the bytes",
  NOT_FOUND: localize("sheet-worker.contract.no_capture_with_that_sha_in", "no capture with that sha in that store"),
  NOT_ENABLED: localize("sheet-worker.contract.recompute_is_not_enabled_here", "workbook recompute is not enabled on this instance; an administrator enables it after the release deploys this member"),
  ENGINE_ABSENT: localize("sheet-worker.contract.the_engine_did_not_load", "the engine did not load as the pinned build, so no workbook is recomputed"),
  NOT_A_WORKBOOK: "the bytes are not an OOXML spreadsheet",
  OVER_BOUND: localize("sheet-worker.contract.the_workbook_is_larger_than", "the workbook is larger than this member recomputes; nothing of it was recomputed"),
  EXTERNAL_LINKS: localize("sheet-worker.contract.the_workbook_refers_to_other", "the workbook refers to other workbooks, whose values are not here"),
  ENGINE_FAILED: localize("sheet-worker.contract.the_engine_refused_or_failed", "the engine refused or failed on this workbook"),
  TIME_LIMIT: localize("sheet-worker.contract.loading_the_workbook_took_longer", "loading the workbook took longer than the time budget, so evaluation was not started"),
  UNKNOWN: "POST /recompute or GET /version only",
});
