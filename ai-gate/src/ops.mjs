/* ai-gate — F1 (op-grades R57; surface-declarations R15): this module's own ops, declared with the grades R57 states,
 * so op-grades and op-declarations read them from their owner (`registerDeclaredOps`, op-grades R49, op-declarations
 * R80). The gate's test (`aitestsetup` ground credential; `aitestrun`, `aiconnecttest` ground observational), the
 * team's consent to send (`airesultsend` irreversible: a sent bundle cannot be recalled; `airesultsdecline`
 * reversible) and the results it publishes (`airesultsread`, `airesultown`, reads). Every one is refused to a machine.
 * The monthly re-test switch (`airetestset`) is `ai-use`'s (its R28), which serves it. */
import { localize } from "../../bio-plane/src/setup-words/index.mjs";
import { deepFreeze } from "./params.mjs";

const row = (classes, mutating, weight, description) => ({ classes, machineClasses: [], mutating, weight, description });
const ADMIN = ["admin"];
const EVERY = ["admin", "member"];

export const DECLARED_OPS = deepFreeze({
  aitestsetup: row(ADMIN, true, "credential", localize("gate.declared.aitestsetup", "an administrator saves the endpoint and key an AI that is not listed is tested with; the key is sealed and never shown again")),
  aiconnecttest: row(ADMIN, true, "observational", localize("gate.declared.aiconnecttest", "a harmless test message to the chosen AI, holding none of the team's material, that reports whether the connection works")),
  aitestrun: row(ADMIN, true, "observational", localize("gate.declared.aitestrun", "Civicsmith's standard test run against an AI, part by part, stopping before it passes the spending ceiling")),
  airesultsend: row(ADMIN, true, "irreversible", localize("gate.declared.airesultsend", "the team sends its sealed results bundle to the library of results; a sent bundle cannot be recalled")),
  airesultsdecline: row(ADMIN, true, "reversible", localize("gate.declared.airesultsdecline", "the team keeps its results here and sends nothing")),
  airesultsread: row(EVERY, false, "read", localize("gate.declared.airesultsread", "read the results other teams sent for one AI, or for every AI")),
  airesultown: row(EVERY, false, "read", localize("gate.declared.airesultown", "read the result the team just sent, with the preliminary figures from its test")),
});
