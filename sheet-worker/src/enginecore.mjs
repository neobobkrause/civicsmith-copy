/* The engine over a compiled wasm module, in a module that imports no wasm, so a node-side suite drives this same code
 * with a module it compiled from `assets/sheet-engine.wasm` and the worker with the one the platform compiled at
 * upload (`engine.mjs`). Workers forbid compiling wasm at run time, so the module always arrives compiled.
 *
 * Every request opens a FRESH instance (R12: no state is kept between calls, and a trap in one workbook cannot leave
 * a broken heap for the next): `open()` drops the previous instance and instantiates the module again.
 */
import { initSync, resetEngine, inspect as wasmInspect, Book, engine_commit } from "./enginelib.mjs";
import { ENGINE_NAME, ENGINE_VERSION, ENGINE_SECTION, ENGINE_EXPORTS, WASM_BYTES, WASM_SHA256 } from "./contract.mjs";
import { localize } from "../../bio-plane/src/setup-words/index.mjs";

/**
 * @typedef {Object} InspectRefused what the engine's container reader answers for bytes that are not a workbook
 * @property {boolean} zip whether the bytes opened as a zip container
 * @property {false} workbook
 * @property {string} why
 */
/**
 * @typedef {Object} InspectRead what the engine's container reader saw of a workbook (R3 checks 2-4), unzipped by it
 * @property {true} zip
 * @property {true} workbook
 * @property {string} main_part
 * @property {number} unzipped_bytes counted as the parts decompressed; a floor when over_unzipped
 * @property {boolean} over_unzipped
 * @property {number} max_unzipped_bytes
 * @property {number | null} cells null when reading stopped over the unzipped bound
 * @property {boolean | null} over_cells null when reading stopped over the unzipped bound
 * @property {number} max_cells
 * @property {number} worksheets
 * @property {{ parts: number, formulas: number, defined_names: number }} external
 * @property {boolean} macros
 */
/** @typedef {InspectRefused | InspectRead} Inspected */
/**
 * @typedef {Object} EngineCell one formula cell as the engine evaluated it (R4-R6)
 * @property {string} sheet
 * @property {string} cell
 * @property {string} formula
 * @property {"number" | "text" | "boolean" | "error"} type
 * @property {number | string | boolean | null} value
 * @property {string} [error] the engine's error code, on an error
 * @property {string} [cause] R5's cause, on an error
 * @property {string} [function] the function the cause names
 * @property {string} [via] the cell the cause was followed to
 * @property {string} [message] the engine's own message
 * @property {boolean} volatile
 */
/**
 * @typedef {Object} Evaluated what the engine answers for an evaluated workbook
 * @property {string[]} sheets
 * @property {{ formula_cells: number, errors: number, volatile: number }} counts
 * @property {number} spill_cells
 * @property {EngineCell[]} cells
 */
/** @typedef {{ maxUnzippedBytes: number, maxCells: number }} InspectBounds */
/**
 * @typedef {Object} Engine the engine as `member.mjs` takes it
 * @property {string} name
 * @property {string} version
 * @property {{ bytes: number, sha256: string }} wasm
 * @property {() => string | null} check
 * @property {() => string | null} open
 * @property {(bytes: Uint8Array, bounds: InspectBounds) => Inspected} inspect
 * @property {(bytes: Uint8Array) => void} load
 * @property {() => Evaluated} evaluate
 * @property {() => number | null} memoryBytes
 * @property {() => void} close
 */
/** @typedef {{ engine: string, commit: string, code_bytes: number }} SectionFacts the `bio-engine` section the build wrote */

/** The section's JSON, written by this member's own build; undefined where it does not parse.
 *  @param {ArrayBuffer} section @returns {SectionFacts | null | undefined} */
const readFacts = (section) => {
  try { return /** @type {SectionFacts | null} */ (JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(section))); }
  catch { return undefined; }
};

/** @param {number} n @returns {number} */
const lebLength = (n) => { let k = 0; do { n >>>= 7; k++; } while (n); return k; };

/** An engine error's message, else the thrown value itself, as text.
 *  @param {unknown} e @returns {string} */
const messageOf = (e) => {
  /* Every value the engine throws is an Error: the glue's own, a wasm trap, or this file's. */
  return String((e instanceof Error && e.message) || e);
};

/** What the module says about itself: null when it is the pinned build, else why not. Reads no bytes (a compiled
 *  module exposes none): the exports the glue calls, and the `bio-engine` section the build appended, whose stated
 *  code length plus the section's own length must be the vendored file's length (R13).
 *  @param {unknown} mod @returns {string | null} */
export function moduleCheck(mod) {
  if (!(typeof WebAssembly === "object" && mod instanceof WebAssembly.Module))
    return "the engine did not arrive as a compiled WebAssembly.Module; this member must be installed with its "
      + "`assets/sheet-engine.wasm` part";
  const exported = new Set(WebAssembly.Module.exports(mod).map((e) => e.name));
  const missing = ENGINE_EXPORTS.filter((n) => !exported.has(n));
  if (missing.length) return localize("sheet-worker.enginecore.the_wasm_module_lacks_the", "the wasm module lacks the engine's exports ({missing}), so it is not this engine", { missing: String(missing.join(", ")) });
  const sections = WebAssembly.Module.customSections(mod, ENGINE_SECTION);
  if (sections.length !== 1) return localize("sheet-worker.enginecore.the_wasm_module_carries_length", "the wasm module carries {length} `{ENGINE_SECTION}` sections, not one", { length: String(sections.length), ENGINE_SECTION: String(ENGINE_SECTION) });
  const facts = readFacts(sections[0]);
  if (facts === undefined) return localize("sheet-worker.enginecore.the_wasm_modules_engine_section", "the wasm module's `{ENGINE_SECTION}` section does not parse", { ENGINE_SECTION: String(ENGINE_SECTION) });
  if (!facts || facts.engine !== ENGINE_NAME || facts.commit !== ENGINE_VERSION)
    return localize("sheet-worker.enginecore.the_wasm_module_names_v1", "the wasm module names {v1} at {v2}; the pinned build is {ENGINE_NAME} at {ENGINE_VERSION}", { v1: String(facts && facts.engine), v2: String(facts && facts.commit), ENGINE_NAME: String(ENGINE_NAME), ENGINE_VERSION: String(ENGINE_VERSION) });
  const nameBytes = new TextEncoder().encode(ENGINE_SECTION).length;
  const body = lebLength(nameBytes) + nameBytes + sections[0].byteLength;
  const length = facts.code_bytes + 1 + lebLength(body) + body;
  if (!Number.isInteger(facts.code_bytes) || length !== WASM_BYTES)
    return localize("sheet-worker.enginecore.the_wasm_module_is_length", "the wasm module is {length} B; the pinned build is {WASM_BYTES} B", { length: String(length), WASM_BYTES: String(WASM_BYTES) });
  return null;
}

/** The engine as `member.mjs` takes it.
 *  @param {unknown} mod @returns {Engine} */
export function makeEngine(mod) {
  let opened = false;
  /* The loaded workbook, freed by `close()` before the instance is dropped: the glue's finalizer would otherwise
     free its pointer later, in whichever instance is current by then. */
  /** @type {Book | null} */
  let book = null;
  /** @type {{ memory?: { buffer: ArrayBuffer } } | null} the instance's exports */
  let exports = null;

  /** A fresh instance. Answers null, or why the engine is absent (R3's ENGINE_ABSENT).
   *  @returns {string | null} */
  function open() {
    close();
    const why = moduleCheck(mod);
    if (why) return why;
    try {
      resetEngine();
      exports = initSync({ module: mod });
      /** @type {string} */
      const commit = engine_commit();
      if (commit !== ENGINE_VERSION) return localize("sheet-worker.enginecore.the_engine_reports_commit_commit", "the engine reports commit {commit}; the pinned build is {ENGINE_VERSION}", { commit: String(commit), ENGINE_VERSION: String(ENGINE_VERSION) });
    } catch (e) {
      return localize("sheet-worker.enginecore.the_engine_module_did_not", "the engine module did not instantiate: {String}", { String: String(messageOf(e)) });
    }
    opened = true;
    return null;
  }

  function need() {
    if (!opened) throw new Error("the engine is not open");
  }

  return {
    name: ENGINE_NAME,
    version: ENGINE_VERSION,
    wasm: { bytes: WASM_BYTES, sha256: WASM_SHA256 },
    /** Null when the module is the pinned build and instantiates, else why not. Leaves no instance behind. */
    check() { const why = open(); close(); return why; },
    open,
    /** R3 checks 2-4: the container read without the engine loading it. */
    inspect(bytes, { maxUnzippedBytes, maxCells }) {
      need();
      return /** @type {Inspected} the engine's own answer */ (JSON.parse(wasmInspect(bytes, maxUnzippedBytes, maxCells)));
    },
    /** IronCalc's own xlsx import. Throws the engine's error. */
    load(bytes) { need(); book = Book.load(bytes); },
    /** Evaluate the loaded workbook and answer every formula cell. Throws the engine's error. */
    evaluate() {
      need();
      const loaded = book;
      if (!loaded) throw new Error("no workbook is loaded");
      return /** @type {Evaluated} the engine's own answer */ (JSON.parse(loaded.evaluate()));
    },
    /** The instance's linear memory now, in bytes: what the workbook has cost it so far. */
    memoryBytes() {
      const current = exports;
      const memory = current ? current.memory : undefined;
      return memory ? memory.buffer.byteLength : null;
    },
    close,
  };

  /** @returns {void} */
  function close() {
    opened = false;
    const loaded = book;
    if (loaded) { try { loaded.free(); } catch { /* a trapped instance is dropped below either way */ } }
    book = null;
    exports = null;
    resetEngine();
  }
}
