/* wizard-scripts' tests: one reading of a value a test expects to be present (R13, R22 and the registry and library
 * requirements that read the carried data). A lookup in the carried registry or library answers `undefined` when the
 * entry is missing; the test then fails here, naming what it looked for, rather than on a later member read. */
/** @import { RegistryScreen, LibraryScript } from "../../../src/wizard-scripts/data.mjs" */
import { SCREEN_REGISTRY } from "../../../src/wizard-scripts/screen-registry.mjs";
import { CIVICSMITH_LIBRARY } from "../../../src/wizard-scripts/civicsmith-library.mjs";

/**
 * @template T
 * @param {T | undefined | null} x
 * @param {string} [what] what the test looked for, named when it is absent
 * @returns {T}
 * @throws {Error} when `x` is absent
 */
export function found(x, what = "a value") {
  if (x === undefined || x === null) throw new Error(`absent: ${what}`);
  return x;
}

/**
 * @param {string} id
 * @param {readonly RegistryScreen[]} [registry]
 * @returns {RegistryScreen}
 * @throws {Error} when no screen has that id
 */
export function screenOf(id, registry = SCREEN_REGISTRY) {
  return found(registry.find((s) => s.id === id), `screen ${id}`);
}

/**
 * @param {(e: LibraryScript) => boolean} which
 * @param {string} [what]
 * @returns {LibraryScript}
 * @throws {Error} when no script of the library matches
 */
export function scriptWhere(which, what = "a library script") {
  return found(CIVICSMITH_LIBRARY.find(which), what);
}
