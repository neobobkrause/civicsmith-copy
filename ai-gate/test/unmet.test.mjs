// ai-gate requirements not yet met (attempt 3), named here per K208. Each rests on another module: a model reached
// only through agent-model's `turn` by entry id, served by agent-model's fake provider (agent-model R25, R44, with
// R5, R30, R34, R45), and the stub plane run through the real harness and worker loop on top of it (R9).
import { test } from "node:test";
for (const [id, why] of [
  ["R8", "agent-model's turn (R25) and fake provider (R44) for a run; the src scan alone is not the requirement"],
  ["R9", "the stub plane over the real harness and worker loop, its model turns served through agent-model R25/R44"],
  ["R14", "T0 Connect against agent-model's fake provider (R44), capabilities (R30) and served-identity check (R45)"],
  ["R19", "connectCheck running T0 through agent-model's turn (R25) and capabilities (R30)"],
  ["R21", "G0 over a run on agent-model's fake provider (R44) stating usage null (R5)"],
  ["R24", "G3's citation resolution as agent-steps' collect step does it, over the stub plane (R9)"],
  ["R42", "session start cold and warm on agent-model's fake provider (R44) with session_key and cache_hints (R31)"],
  ["R46", "each role's standard task through the harness on the stub plane (R9), priced from agent-model's usage (R5)"],
  ["R66", "the stub-model table run on the stub plane (R9) with the cost estimate bracketing the fake provider's figures (R44)"],
]) test.todo(`${id}: not yet met (ai-gate attempt 3) — needs ${why}`);
