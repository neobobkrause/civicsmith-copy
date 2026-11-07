/* screens-ai's requirements not met yet: each waits on a read, an op or a word another module owns
   (`docs/requirements-notes/screens-ai.md` names them by requirement). Each id is named here as a todo (K208), never a red test. */
import test from "node:test";

const OWED = {
  R1: "aiproviders: each row's sends-where and keeps-how-long, its listing word and reason, and its health wait on a catalogue read and a health read per account",
  R3: "aiproviders: Add an AI (providers, plans, check answers with grade, source and date, not offered and held) waits on a catalogue read",
  R4: "aiproviders: an account stopped needs flagged_at in accountsof; a stale catalogue needs a read",
  R5: "aiconnect: aisignin, aikeyreference (ai-accounts) and aiconnecttest (ai-gate) are declared but no store serves them",
  R6: "aimine: the team's locked checks are refused to a member (aichecks level group, NOT_AN_ADMIN), and checksInForce has no op",
  R7: "aiproject: the team's locked checks are refused to an owner who does not administer",
  R8: "aimoments: the run's choices (aicontinue, aistop, aiwait, ...) and the moments' answers wait on ai-runs' served answers",
  R9: "aitest: aitestsetup, aitestrun, airesultsend, airesultsdecline (ai-gate) are declared but no store serves them",
  R10: "airesults: airesultsread (ai-catalogue) and airesultown (ai-gate) are declared but no store serves them",
  R11: "labels name the AI on other modules' screens; the run's parts wait on runs that airunparts answers",
  R12: "every sentence is read by key (r12-r13.test.mjs); still owed: each refusal an owner mints drawn by its ai.refused.<code> word with its fills (the refusals do not carry the fields those words name, e.g. CHECK_LOCKED gives check_id, the word asks {check})",
  R13: "re-read, failed reads, gated acts and the Worker-only ops hold (r12-r13.test.mjs); still owed: a refusal drawn by its owner's key with who can fix it, as R12's",
  R14: "no secret kept: the five ways of R5 wait on aisignin and aikeyreference",
  R15: "the drawer is built (drawer.test.mjs); its heading key is owed by design",
};
for (const [id, why] of Object.entries(OWED)) test.todo(`${id} ${why}`);
