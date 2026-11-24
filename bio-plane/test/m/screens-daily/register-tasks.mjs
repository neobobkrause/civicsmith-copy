/* screens-daily R75 (T51; K4213, K4222, K4248): the plane registers each owner's declared ops before its first read, and this file
   does that through test-support's `registerDeclared` (R17), so `OPS` holds `taskdecide` and the authority form is drawn. A test file
   imports it before `page.mjs`, which reads the op tables when it loads, so this registration is the first read of that process. */
import { registerDeclared } from "../../declared-ops.mjs";
import { registerDeclaredOps } from "../../../src/op-declarations/index.mjs";

await registerDeclared(new URL("../../../../", import.meta.url).pathname, registerDeclaredOps);
