/* Fixtures wizard-scripts publishes (K4990, K5046): each is made by the real code when it is called, never stored. */
import { seeded, V } from "./fixture.mjs";

/** The real NO_SUCH_WIZARD refusal of `wizardRead` for an id no script holds. */
export const noSuchWizard = () => seeded().wz.wizardRead({ script: "WIZ-0000000000000000", viewer: V("alice") });

/* K5207 (fix round 10): the two `writinghelp` answers screens-publish takes. Each is the real `writingHelp` over a world this
   module builds when called (never stored). The assistant is reachable: the door resolves an own account for the viewer
   (`assistant.account`, never the key; B4). A draft held in the field is refused before any model turn (R24, R27), so no
   binding is called. The assistant unreachable: the door refuses with the binding unbound (`AGENT_WORKER_UNBOUND`), and
   `writingHelp` answers that refusal as the door gave it (R27; `screens-inquiry` WITHHELD). */
const ASSISTANT_ON = { on: true, account: { kind: "own", level: "member" } };
const ASSISTANT_UNREACHABLE = { on: false, account: null, refusal: { ok: false, code: "AGENT_WORKER_UNBOUND" } };
const HELP_ASK = { op: "casenote", field: "text", told: "The gate was locked on Tuesday.", by: "member:frank", viewer: "member:frank" };

/** R24, R27: `writinghelp` with a draft held in the field and the assistant reachable: `WRITING_HELP_DRAFT_HELD`, writing nothing. */
export const writingHelpDraftHeld = () => seeded().wz.writingHelp({ ...HELP_ASK, draftHeld: true, assistant: ASSISTANT_ON });

/** R27: `writinghelp` with the assistant unreachable (the binding unbound at the door): the door's `AGENT_WORKER_UNBOUND`, as given,
 *  with the op it was asked for. */
export const writingHelpUnreachable = () => seeded().wz.writingHelp({ ...HELP_ASK, assistant: ASSISTANT_UNREACHABLE });
