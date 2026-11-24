/* The owners' declarations registered once before any table is read, as the plane registers them at start-up (op-declarations R80, R81;
   K4168), through test-support's `registerDeclared` (R17, K4245) over the collector's own pairs, never by hand (K3268). A test file that
   composes the real `SCREENS` imports it first, so the ops the screens send that no hand row holds are served by their owners'
   declarations (interface-shell R21's check). Per file: a file that registers its own rows (the screen modules' tests) never imports it. */
import { fileURLToPath } from "node:url";
import { registerDeclared } from "../../declared-ops.mjs";
import { registerDeclaredOps } from "../../../src/op-declarations/index.mjs";

await registerDeclared(fileURLToPath(new URL("../../../../", import.meta.url)), registerDeclaredOps);
