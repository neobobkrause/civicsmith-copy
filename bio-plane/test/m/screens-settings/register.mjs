/* The owners' declarations, registered once before any table is read (op-declarations R80, R81; K4168), as the plane registers them at
   start-up: an op an owner declares and the hand tables do not hold (`expertisewithdraw`, member-roster's) is served by its declaration,
   so the screens' acts that name it pass `interfacePage`'s check. The collection is test-support's `registerDeclared` (R17), bounded to this
   module: it reads the `DECLARED_OPS` of screens-settings and the modules before it on the module order, and reaches no later module; no list
   of owners or ops is kept here (K3268). */
import { fileURLToPath } from "node:url";
import { registerDeclaredOps } from "../../../src/op-declarations/index.mjs";
import { registerDeclared } from "../../declared-ops.mjs";

await registerDeclared(fileURLToPath(new URL("../../../../", import.meta.url)), "screens-settings", registerDeclaredOps);
