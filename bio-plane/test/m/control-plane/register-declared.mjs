/* control-plane R113 (T51; K4213; K4222; K3268; R81): the plane registers every owner's declared ops before its first read, and
   this file does that for the whole tree: `registerDeclared` collects each module's `DECLARED_OPS` from `build/modules.json`, so no
   owner is listed here by hand. A test that imports it before the harness (which reads the op tables when it loads) gets the
   registration as the first read of that process. The two registrations are the plane's own (`src/plane/declarations.mjs`):
   op-declarations and op-grades each take every owner's rows, so the tables the harness reads are the plane's tables. */
import { fileURLToPath } from "node:url";
import { registerDeclared } from "../../declared-ops.mjs";
import { registerDeclaredOps } from "../../../src/op-declarations/index.mjs";
import { registerDeclaredOps as registerOpGrades } from "../../../src/op-grades/index.mjs";

/* A test that loads the plane's store world first has had every owner's declarations registered by the plane itself (plane R68) at
   its load: the second registration is then refused by op-declarations R81 ("registered after the first read" or "a second
   registration"), and the tables read are already the plane's. Only that refusal is let pass; any other stops the file. */
try {
  await registerDeclared(fileURLToPath(new URL("../../../../", import.meta.url)), registerDeclaredOps, registerOpGrades);
} catch (e) {
  if (!(e instanceof TypeError && /\(R81\)/.test(e.message) && /registered after the first read|a second registration/.test(e.message))) throw e;
}
