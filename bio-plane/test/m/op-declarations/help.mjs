/* R34 (affordances R48, R62, R64): an op is EXPLAINED when affordances' `ACT_HELP` holds its text, read here from affordances' own
   export (K3268), never a list of ops. (K4254) The fallback of K4070, by which the word was the text of six ops until `affordances`
   merged, is gone: `ACT_HELP` holds them. */
import { ACT_HELP } from "../../../src/affordances.mjs";

export const explained = (op) => Object.hasOwn(ACT_HELP, op) && typeof ACT_HELP[op] === "string" && ACT_HELP[op].length > 0;
