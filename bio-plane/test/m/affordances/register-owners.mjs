/* The owners' declarations this module's tests register with op-grades before any table is read (op-grades R49; K4168,
   K4225, K5159). Every owner that exports a `DECLARED_OPS` is registered, found by test-support's bounded `declaredOpsOf`
   (R16) over this module and the modules before it on the order file, with no module listed by hand, as the plane
   registers them at start-up, so an op an owner declares (case-inputs' `casedetailsset`, case-import's `rerunstart`,
   contradiction's `contradictionflag`, and every other owner's) is graded and never unseen. Each owner's rows are read
   from the owner (K3268), never listed here. Import this file before `affordances.mjs`: registration is refused once any
   table has been read, and happens once per process, at this file's evaluation. */
import { fileURLToPath } from "node:url";
import { declaredOpsOf } from "../../declared-ops.mjs";
import { registerDeclaredOps } from "../../../src/op-grades/index.mjs";

const { ops, owners, duplicates } = await declaredOpsOf(fileURLToPath(new URL("../../../../", import.meta.url)), "store-assembly");
if (duplicates.length) throw new Error(`an op declared by two owners: ${duplicates.map((d) => `${d.op} (${d.owners.join(", ")})`).join("; ")}`);

/** The declarations registered, `{owner: {op: row}}`. */
export const REGISTERED = {};
for (const [op, row] of Object.entries(ops)) (REGISTERED[owners[op]] ??= {})[op] = row;
registerDeclaredOps(REGISTERED);
