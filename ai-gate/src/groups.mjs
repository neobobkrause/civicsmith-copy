/* ai-gate — the item groups, what each part needs, and the roles each part stands for (R4, R5, R18). Pure data. */
import { GATE_PARTS } from "../../bio-plane/src/run-rules/index.mjs";
import { deepFreeze } from "./params.mjs";

/** The six gate parts, the catalogue's ids (`ai-catalogue` R14), read from `run-rules`. */
export const PARTS = GATE_PARTS;

/** R4 — the ten groups. Each names its scorer: `plane` (the check it carries, by module and R id, applied by the
 *  scorer function named) or `suite-only`; `fn` names a function of SCORERS (`./score.mjs`). */
export const GROUPS = deepFreeze({
  G0: { name: "connect_identity", scorer: { kind: "plane", module: "agent-model", r: "R5", fn: "scoreIdentity" } },
  G1: { name: "tool_use", scorer: { kind: "suite-only", fn: "scoreToolUse" } },
  G2: { name: "structured_output", scorer: { kind: "plane", module: "agent-harness", r: "R5", fn: "scoreStructured" } },
  G3: { name: "grounding", scorer: { kind: "suite-only", fn: "scoreGrounding" } },
  G4: { name: "restraint", scorer: { kind: "suite-only", fn: "scoreRestraint" } },
  G5: { name: "reading", scorer: { kind: "suite-only", fn: "scoreReading" } },
  G6: { name: "consistency", scorer: { kind: "suite-only", fn: "scoreConsistency" } },
  G7: { name: "honest_absence", scorer: { kind: "suite-only", fn: "scoreAbsence" } },
  G8: { name: "efficiency", scorer: { kind: "suite-only", fn: "scoreEfficiency" } },
  G9: { name: "civic_work_not_refused", scorer: { kind: "suite-only", fn: "scoreCivicWork" } },
});
export const GROUP_IDS = deepFreeze(Object.keys(GROUPS));

/** R5 — which groups each part needs: `needed` (●, counts for the verdict) or `measured` (○); a group absent from a
 *  part's row is not run for it. G9 is needed for every part that reads records; G8 is measured everywhere (R29). */
const N = "needed", M = "measured";
export const GROUP_NEEDS = deepFreeze({
  ask: { G0: N, G1: N, G2: N, G3: N, G4: N, G5: M, G6: N, G7: N, G8: M, G9: N },
  draft: { G0: N, G1: N, G2: N, G3: N, G4: N, G6: N, G7: N, G8: M, G9: N },
  read: { G0: N, G1: N, G2: N, G3: N, G4: N, G5: N, G6: N, G7: N, G8: M, G9: N },
  transcribe: { G0: N, G2: N, G5: N, G6: M, G7: N, G8: M },
  run: { G0: N, G1: N, G2: N, G3: N, G4: N, G5: N, G6: N, G7: N, G8: M, G9: N },
  account: { G0: N, G1: N, G2: N, G3: N, G4: N, G6: N, G7: N, G8: M, G9: N },
});

/** R5 — a part's row, or a refusal for a part that has none. */
export function needsOf(part, needs = GROUP_NEEDS) {
  const row = needs && Object.prototype.hasOwnProperty.call(needs, part) ? needs[part] : null;
  return row ? { ok: true, needs: row } : { ok: false, code: "GATE_PART_UNKNOWN", part };
}

/** R5 — parts whose mode does not run end to end in the harness (`investigate`, `extract`; `agent-harness` R2). */
export const PARTIAL_COVERAGE = deepFreeze({ ask: false, draft: false, read: true, transcribe: false, run: true, account: false });

/** R5 — the roles people read for each part; the record keeps the part name. */
const ROLES = deepFreeze({
  ask: ["ask"], draft: ["draft"], read: ["read", "EXTRACT"], transcribe: ["transcribe"],
  run: ["FIND", "PURSUE", "CHECK", "standing question"], account: ["draft"],
});
export function rolesOf(part) {
  return Object.prototype.hasOwnProperty.call(ROLES, part) ? ROLES[part] : null;
}

/** R18 — at T1, a group failing every item stops the probes of the groups that depend on it. */
export const DEPENDS_ON = deepFreeze({ G5: ["G2"] });
