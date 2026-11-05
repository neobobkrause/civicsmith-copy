/* screens-ai's requirements, none met yet: each waits on ops, registry rows or reads other modules own
   (docs/requirements-notes/screens-ai.md lists them by requirement). Each id is named here as a todo (K208), never a red test. */
import test from "node:test";

const OWED = {
  R1: "aiproviders: accounts in order; waits on aioptinset in the registry row, assistantreadiness, a catalogue read (sends, keeps, listing word) and a health read",
  R2: "aiproviders: limits and alerts; waits on aibudgetset (ai-use)",
  R3: "aiproviders: the checks and Add an AI; waits on a catalogue read (plans, check answers with grade, source and date)",
  R4: "aiproviders: an account stopped; waits on flagged_at in accountsof and a stale-catalogue read",
  R5: "aiconnect: six steps; waits on aisignin, aikeyreference (ai-accounts) and aiconnecttest (ai-gate)",
  R6: "aimine: waits on aioptinset in the registry row, a checksInForce read and the team's checks readable by a member",
  R7: "aiproject: waits on aiprojectbudget (ai-use) and the team's checks readable by an owner",
  R8: "aimoments: waits on aiwaitswitch and the run's choices (ai-runs)",
  R9: "aitest: waits on aitestsetup, aitestrun, airesultsend, airesultsdecline (ai-gate)",
  R10: "airesults: waits on airesultsread (ai-catalogue) and airesultown (ai-gate)",
  R11: "which AI did the work: waits on airunparts (ai-runs) and assistantreadiness (instance-setup)",
  R12: "words by key: held over the screens as built",
  R13: "re-read after an act; Worker-only ops in no act list: held over the screens as built",
  R14: "no secret kept or drawn again: waits on the five ways of R5",
  R15: "use over time drawer: waits on the uses edge screens-ai to screens-settings (aiUsageBars)",
  R16: "aiproject to a non-participant: waits on projectrequest and projectjoin in aiproject's registry row",
};
for (const [id, why] of Object.entries(OWED)) test.todo(`${id} ${why}`);
