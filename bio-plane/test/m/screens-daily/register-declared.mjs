/* The owners' declared ops registered before the harness reads the op tables (control-plane R113; the page's table is op-declarations'): a test that boots the real plane imports this first, so the page's op table is the plane's. */
import { fileURLToPath } from "node:url";
import { registerDeclared } from "../../declared-ops.mjs";
import { registerDeclaredOps } from "../../../src/op-declarations/index.mjs";

await registerDeclared(fileURLToPath(new URL("../../../../", import.meta.url)), registerDeclaredOps);
