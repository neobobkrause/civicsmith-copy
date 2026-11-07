/* op-declarations R77, R78, R79 (T51; DEC-330 owed, U348, K3810; K3826, K3829, K3839, K3843, K3852, K3853; N858, N1046,
   N1088, K3935, K3976, K4059): T51'S READS IN THE OWNERS' FAMILIES, held apart from `index.mjs` for size, as `t45.mjs` to
   `t50.mjs` hold the earlier tranches'. Each op is named under its owner with the kind `index.mjs`' `OP_KINDS` gives it,
   read from the owner's merged requirement and its ops map's arm. `index.mjs`' `family()` merges each share into its
   owner's family and builds each of `T51_FAMILIES` as it builds `T45_FAMILIES`. The kinds:
   - `read` (admin, member, probe; `NEEDS` `null`, `viewer` stamped): `bundlehistory` (promotion R58), `entityidonly`,
     `subjectsnamed`, `entitysimilar` (entities R57, R59, R60), `projectinvitations` (project-roster R35), `versioncompare`
     (basis-versions R55), `approvedunsent` (filings R53) and `checkpointsdue` (action-plans R17), the last two with no
     owner arm: the control plane's route serves them (screens-action R30; K3867); `heldat` (capture R96) is `readfenced` (classes admin, member, probe; machine classes
     admin and probe, so admission refuses an `ai` credential, K4098) and is also stamped `by`, set from the session only (its R86 fence,
     `MEMBER_SESSION_REQUIRED`);
   - `sessionread` (a member's session only, `machineClasses: []`; classes admin, member, probe; `NEEDS` `null`, `viewer`
     stamped): `holdsdue` (action-holds R19), `holdsplaced` (action-holds R22), `templatebyhandle` (filing-templates R34), `rulefields` (local-facts R18)
     and `clocksrunning` (action-clocks R24);
   - `ownread` (a read for a session only, an administrator's, NOT_AN_ADMIN otherwise): `adminremovalsopen`
     (member-roster R75, served through membership's map, its R154), `by` stamped;
   - `publicread` (`classes: null`, nothing stamped, in no session set, a present null `NEEDS` row, which `op-grades` names a
     non-act: affordances R12, K4098): `publishedfrozen` (public-read R38).
   `projectlist`'s `after` (project-roster R36) and the `scope` parameter of `searchfields`, `search` and `meaningrows`
   (retrieval R87) are request fields the door passes as given: they declare nothing, and R77's test pins that their
   specs are unchanged. `BROWSER_ACTS` (R76), the acts done in the browser alone, is the one table here that is no op's.
   This file is data only (R5, R7). */
const T51_SHARES = Object.freeze({
  /* capture R96 (R77; K3826, K3852): whether the record already holds a source and whether it has changed; `by` set from
     the session only and the member's own, so `check: true` with no session reaches capture without one. */
  capture: Object.freeze({ cite: "capture R96; R77", extra: Object.freeze({ heldat: Object.freeze(["by"]) }),
    ops: Object.freeze({ heldat: "readfenced" }) }),
  /* entities R57, R59, R60 (R77; K3839): the identifier-only counts, Find's subjects route and the near-match check. */
  entities: Object.freeze({ cite: "entities R57, R59, R60; R77", ops: Object.freeze({
    entityidonly: "read", subjectsnamed: "read", entitysimilar: "read" }) }),
  /* project-roster R35 (R77; K3843): the invitations the viewer may see, `limit` and `after` the query's. */
  "project-roster": Object.freeze({ cite: "project-roster R35; R77", ops: Object.freeze({ projectinvitations: "read" }) }),
  /* public-read R38 (R77; K3853): a frozen published case, the same for every caller, `id` the query's. */
  "public-read": Object.freeze({ cite: "public-read R38; R77", ops: Object.freeze({ publishedfrozen: "publicread" }) }),
  /* basis-versions R55 (K3861, N1215): how two readings of one question differ. */
  "basis-versions": Object.freeze({ cite: "basis-versions R55; R77", ops: Object.freeze({ versioncompare: "read" }) }),
  /* filings R53, action-plans R17 (K3867; screens-action R30): the two reads "whose move it is" needs, served by the
     control plane's route (no owner map arm). */
  filings: Object.freeze({ cite: "filings R53; R77", ops: Object.freeze({ approvedunsent: "read" }) }),
  "action-plans": Object.freeze({ cite: "action-plans R17; R77", ops: Object.freeze({ checkpointsdue: "read" }) }),
  /* action-holds R19, local-facts R18, action-clocks R24 (R78, R79; N858, N1046, N1088, K3935, K4059): reads a member's
     session draws from. */
  "action-holds": Object.freeze({ cite: "action-holds R19, R22; R78", ops: Object.freeze({ holdsdue: "sessionread", holdsplaced: "sessionread" }) }),
  "local-facts": Object.freeze({ cite: "local-facts R18; R78", ops: Object.freeze({ rulefields: "sessionread" }) }),
  "action-clocks": Object.freeze({ cite: "action-clocks R24; R79", ops: Object.freeze({ clocksrunning: "sessionread" }) }),
  /* member-roster R75 (CR-4; K3976): the administrator removals under way, an administrator's read from a session, `by`
     the stamp; served through membership's map (its R154). */
  membership: Object.freeze({ cite: "member-roster R75; membership R154; R77", extra: Object.freeze({
    adminremovalsopen: Object.freeze(["by"]) }), ops: Object.freeze({ adminremovalsopen: "ownread" }) }),
});

const T51_FAMILIES = Object.freeze([
  /* promotion R58 (R77; K3829): the bundle's own record of how it came to be what it is. */
  Object.freeze({ owner: "promotion", cite: "promotion R58; R77", ops: Object.freeze({ bundlehistory: "read" }) }),
  /* filing-templates R34 (R78; N1046): the text of a template by its handle, a member session's read. */
  Object.freeze({ owner: "filing-templates", cite: "filing-templates R34; R78",
    ops: Object.freeze({ templatebyhandle: "sessionread" }) }),
]);

/* R76 (T51; DEC-330 owed; U348; K3810): THE BROWSER ACTS, a class of their own. Each is done in the browser alone: it has
   no spec in `OPS`, no row in `NEEDS`, no place in either session set, `ACT_GATE`, `REAUTH_ACTS` or an act list, no route
   and no stamp, and is never sent to the op door. `registry` is the row each takes the place of in the screen registry.
   The rows are `{screen, census, registry}`. */
const BROWSER_ACT_ROWS = Object.freeze([
  ["revisioncompare", "document", "A27"], ["hashcopy", "document", "A26"], ["linkopen", "document", "A30"],
  ["pubfloorset", "published", "A77"], ["pubfloorclear", "published", "A77"], ["pubprint", "published", "A79"],
  ["reviewexport", "review-copy", "A81"],
]);

/* surface-declarations R12, R15, R16, R17, R18 (T53; K4354, K5438, K5571 (3); PL1–PL4 of `time-budgets-draft.md`): THE
   BUDGET CLASSES the ops declare, by name, where a requirement states one. The keys are `runtime-limits`' time classes (its
   R41, `budgetOf`) and no others. An op named nowhere here takes its kind's class (`declared.mjs`' `defaultBudgetClass`): a
   write the write act's, a read the read act's. A row is a class name or `{class, ceiling_ms}`, the ceiling an override
   downward only (R12; `runtime-limits` R42). A name here that `OPS` does not hold yet is kept for the op its owner will
   declare (R15's and R16's ops that no owner serves today) and is no spec. */
const SHELL_ACTS = Object.freeze([
  /* R15, reversible: */ "aiorderset", "aiaccountswitch", "aimemberallow", "aiprojectuse", "aiprojectorder", "aimineuse",
  "aibudgetset", "aiprojectbudget", "aitermsaccept", "aipersonalchoose", "aicontinue", "aistop", "aisend", "aisendrefuse",
  "aiwait", "aiwithout", "aiswitchaccount", "aimodelchoose", "aichooseother", "aiaccountpick", "aiaskadmin",
  "airesultsdecline", "aiwaitswitch", "airetestset", "aihealthset", "aioptinset", "aitermswithdraw", "aicreditsclear",
  /* R15, reasoned: */ "aicheckset", "aiprojectcheckset", "aimycheckset"]);
const WRITE_ACTS = Object.freeze([
  /* R15, terminal: */ "aiaccountremove", /* reversible: */ "aiaccountadd", "aiownadd",
  /* ground credential: */ "aikeyenter", "aikeyseal", "aikeycloudflare", "aikeyreference", "aisignin", "aitestsetup",
  /* irreversible: */ "airesultsend"]);
const READ_ACTS = Object.freeze([
  /* R15: */ "airesultsread", "airesultown", "aihealthpreview", "aiusebymember", "airunparts", "assistantreadiness", "aipathready",
  /* R16: */ "interpretationOf", "interpretedFor", "limitsByKind",
  /* R17 (1): the mail door's three reads take the lightest read class */ "mailaddress", "mailwaiting", "mailread"]);
/* R18: the ops that send the member's act to the agent Worker and wait for its answer */
const AI_ACTS = Object.freeze(["ask", "writinghelp", "groupdescriptiondraft", "translationdraft", "textcheck", "infractiondraft",
  "bearingdraft", "airunstart", "aiconnecttest"]);
/* R16: the explore class (2.0 s; a search that reaches it stops and says it stopped): the explore reads a member waits on */
const EXPLORE_OPS = Object.freeze(["explore", "explorepreset", "exploreverify", "exploretimeline", "exploregraph", "exploreall",
  "explorepath", "exploreshorter", "explorecontinue", "proposeParts"]);
const BUDGET_CLASS_ROWS = Object.freeze({
  ...Object.fromEntries(SHELL_ACTS.map((op) => [op, "shell_act"])),
  ...Object.fromEntries(WRITE_ACTS.map((op) => [op, "write_act"])),
  ...Object.fromEntries(READ_ACTS.map((op) => [op, "read_act"])),
  ...Object.fromEntries(AI_ACTS.map((op) => [op, "ai_act"])),
  ...Object.fromEntries(EXPLORE_OPS.map((op) => [op, "explore"])),
  /* R18: the capability suite scored by code for one (entry, part) */
  aitestrun: "gate_run",
  /* R16: one `followfrom` read */
  followfrom: "follow",
  /* R16: `partsOf` is a share of the screen's full load (2.0 s with the screen, derived once per reading version) */
  partsOf: "screen_load",
  /* R17 (1): `mailbringin` is classed as `captureupload` is, the acknowledgement of a file up to its kind's bound */
  captureupload: "file_capture", mailbringin: "file_capture",
  /* R11: the combined read answers a whole screen's first load */
  screenread: "screen_load",
});
/* R15: the screen moves, no ops: each carries the in-app move class and has no spec */
const SCREEN_MOVES = Object.freeze({ aiplanconnect: "screen_move", aitestopen: "screen_move", airesultsopen: "screen_move" });
/* R16: reads never declared in a screen's first wave */
const NOT_FIRST_WAVE = Object.freeze(["proposeParts"]);

/* surface-declarations R11 (T53; K4599, N1264; PL11): `screenread`, the read op that answers a screen's declared reads
   together: its input a screen's name and params; its answer `{reads: {name: {ok, status, body | refusal}}, stamps,
   server_ms}`. A read op: classes `admin`, `member`, `probe`, not mutating, `viewer` stamped, `NEEDS` `null`. */
const SCREENREAD_SPEC = Object.freeze({ op: "screenread", kind: "read", classes: Object.freeze(["admin", "member", "probe"]),
  mutating: false, stamps: Object.freeze(["viewer"]), needs: null, budget_class: "screen_load",
  input: Object.freeze(["screen", "params"]), answer: Object.freeze(["reads", "stamps", "server_ms"]) });

export { T51_SHARES, T51_FAMILIES, BROWSER_ACT_ROWS, BUDGET_CLASS_ROWS, SCREEN_MOVES, NOT_FIRST_WAVE, SCREENREAD_SPEC };
