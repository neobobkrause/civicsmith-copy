// ai-gate requirements not yet met by this first slice (attempt 1), named here per K208. Each needs the stub plane
// run through the real harness and agent-model's fake provider (R8, R9, R14, R19, the group scorers' plane checks,
// R42, R46, R66) or a setup-words table edit outside this module's paths (R65).
import { test } from "node:test";
for (const [id, why] of [
  ["R8", "a run through agent-model's turn with a fake provider; the src scan"],
  ["R9", "the stub plane over the real harness and worker loop"],
  ["R14", "T0 Connect run against a fake provider"],
  ["R19", "connectCheck running T0 in a team's copy"],
  ["R21", "G0 scored with agent-model's own checks over a run"],
  ["R22", "G1 with agent-worker's allow-list and agent-harness end step"],
  ["R23", "G2 with checkCondition, ANSWER_FIELDS, plan option and draft endings"],
  ["R24", "G3 with agent-steps citation resolution and the ask answer check"],
  ["R26", "G4 as agent-worker R62's four assertions over a run"],
  ["R27", "G5 needle depths and character error rate against fixtures"],
  ["R28", "G6 with planDedup and agent-steps duplicate signals"],
  ["R29", "G7 compose-time read and levelEmptyHolds; G8 bounds consumed"],
  ["R30", "G9 over synthetic civic records through the stub plane"],
  ["R42", "session start cold and warm on a stub provider"],
  ["R46", "all-in cost of each role's standard task through the harness"],
  ["R65", "the gate.* keys in setup-words' table"],
  ["R66", "the table of known-good and known-bad stub models"],
]) test.todo(`${id}: not yet met (ai-gate attempt 1) — needs ${why}`);
