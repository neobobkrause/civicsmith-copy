/* registers — the public registers a team has imported, whole or in part, by fixed steps with no AI (requirements:
 * `build/requirements/registers.md`). Lists the known, the team's own and the proposed registers; plans an import (prefilled
 * filter, delta, time estimate); runs it in the background as resumable slices on the scheduler's alarm; keeps and searches the
 * rows and the captures they came from; cites a row as a labelled extract; compares two imports; keeps a project's stated
 * interest as a filter for change-watching. It holds no fact, score or judgment about anyone (R36), resolves no name (R37) and
 * calls no AI (R16).
 *
 * REACHED as `registersOf(ctx, deps)`: one instance per host (the Durable Object's storage). The class is `core.mjs`'s; the
 * import (`runner.mjs`), search and removal (`search.mjs`) and watch (`watch.mjs`) methods are installed on it here. */
import { Registers, registersOf } from "./core.mjs";
import { runnerMethods } from "./runner.mjs";
import { searchMethods } from "./search.mjs";
import { watchMethods } from "./watch.mjs";

for (const methods of [runnerMethods, searchMethods, watchMethods])
  for (const [name, fn] of Object.entries(methods)) Object.defineProperty(Registers.prototype, name, { value: fn, writable: true, configurable: true, enumerable: false });

export { Registers, registersOf };
export { REGISTERS_SCHEMA, registersTables, migrateRegisters } from "./schema.mjs";
export { sqliteRowStore, memoryRowStore, contentHashOf, indexRowOf } from "./port.mjs";
export { DECLARED_OPS, REGISTERS_OPS, registersOps } from "./ops.mjs";
export { PRODUCT_PHASE, MAX_ACTIVE_IMPORTS, SLICE_TX_MS, SLICE_MEMORY_MB, THROUGHPUT_DEFAULT, RESULT_CAP } from "./limits.mjs";
