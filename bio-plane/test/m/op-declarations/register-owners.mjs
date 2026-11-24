/* The owners' declarations this module's tests register before any table is read (R80; K4168). Every owner that exports a
   `DECLARED_OPS` is registered, found from `build/modules.json` by test-support's `declaredOpsOf` (R16) and registered as the
   plane registers them at start-up, so an op an owner declares is served by its declaration and never by a hand list
   (K3268). Registration happens once per process, at this file's evaluation, before any table is read. */
import { fileURLToPath } from "node:url";
import { declaredOpsOf } from "../../declared-ops.mjs";
import { registerDeclaredOps } from "../../../src/op-declarations/index.mjs";

const { ops, owners, duplicates } = await declaredOpsOf(fileURLToPath(new URL("../../../../", import.meta.url)));
if (duplicates.length) throw new Error(`an op declared by two owners: ${duplicates.map((d) => `${d.op} (${d.owners.join(", ")})`).join("; ")}`);

/** The declarations registered, `{owner: {op: row}}`. */
export const REGISTERED = {};
for (const [op, row] of Object.entries(ops)) (REGISTERED[owners[op]] ??= {})[op] = row;
registerDeclaredOps(REGISTERED);
