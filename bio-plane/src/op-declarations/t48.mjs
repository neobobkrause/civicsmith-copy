/* op-declarations R64, R66, R67, R68 (T48; N880, N882, N670, N1047, N1026, N1027, N1029, N1030, N1034, N1035, N1038, N1043,
   N996; DEC-226; K3101, K3158, K3189, K3203, K3206, K3207, K3211): T48'S OPS IN THE OWNERS' FAMILIES, held apart from
   `index.mjs` for size (M-T48-1), as `t45.mjs`, `t46.mjs` and `t47.mjs` hold T45's, T46's and T47's. Each op is named
   under its owner with the kind `index.mjs`' `OP_KINDS` gives it, read from the owner's merged requirement and, where
   the owner serves it, its ops map's arm. A body field an existing spec gains (`followregister`'s `proceeding`,
   `exploreverify`'s `chain`, `reviewgrant`'s `until`, R64, R67) is no stamp and no table row: the door passes a body
   as given, so those three specs are unchanged and stay as they were.
   R68 moves 24 ops from `credentials`' family to a family of `ai-accounts`' own; their names, specs, session sets,
   `NEEDS` rows, stamps and act lists are unchanged, so `index.mjs` drops them from `credentials`' `ops` and `extra`
   and this file lists them once, under their new owner.
   This file is data only (R5, R7): `index.mjs`' `family()` merges each share into its owner's family (its `ops` and
   `extra` merged), as it merges the earlier shares, and builds each of `T48_FAMILIES` as it builds `T45_FAMILIES`. */
const QUERY = (key) => Object.freeze({ key, at: "query" });

const T48_SHARES = Object.freeze({
  /* action-replies R10 (R64; N880): whether a reply's claim may be quoted, and in which words, a member's
     (MACHINE_CANNOT_RECORD_BEARING's posture: a session's only, `contribute`), `author` and `viewer` from the query;
     `target`, `ord`, `quotable` and `words` the body's. */
  "action-replies": Object.freeze({ cite: "action-replies R10; R64", ops: Object.freeze({ actionreplyquoting: "member" }) }),
  /* following R30 (R64; N882): the dates a proceeding sets, a read by the viewer's sight; `proceeding`, `from` and
     `to` the query's. */
  following: Object.freeze({ cite: "following R30; R64", ops: Object.freeze({ proceedingdates: "read" }) }),
  /* agent-worker R86 (R64; N670): the reading of a text into another language, the assistant's labelled draft that
     writes nothing, declared as `textcheck` is (R51): a session's read, `by` the query's beside the viewer, `{subject,
     language?}` the body's, no project field. Its handler is the plane's draft door (`draftOnObject`, `plane` R50),
     which sends `POST /draft` with `{op: "readtranslate", …}`; no ops map of this module's uses serves it. */
  "agent-worker": Object.freeze({ cite: "agent-worker R86; R64; N670",
    extra: Object.freeze({ readtranslate: Object.freeze(["by"]) }), ops: Object.freeze({ readtranslate: "ownread" }) }),
  /* instance-setup R89, R90 (R66; N1047; DEC-226): the update notice read by an administrator, and the administrator's
     choice on it: each a session's only, no working capability, the owner answering NOT_AN_ADMIN first, `by` the
     query's; `version` (and `reason` of `updateskip`) the body's. */
  "instance-setup": Object.freeze({ cite: "instance-setup R89, R90; R66; N1047", ops: Object.freeze({
    updatenotice: "ownread", updatestart: "admin", updatelater: "admin", updateskip: "admin" }) }),
  /* ai-use R14 (R67; N1026, K3206): one account's use over time, declared beside `ailimits` and as it is (a session's
     read), `owner` a query field. */
  "ai-use": Object.freeze({ cite: "ai-use R14; R67; N1026", ops: Object.freeze({ aiuseovertime: "ownread" }) }),
  /* explore R21 (R67; N1027): the neighbourhood of a centre, a read as explore's others are (its arm spreads the body
     and takes the viewer from the query alone); `centre`, `at`, `rings`, `kinds` and `scope` the body's. */
  explore: Object.freeze({ cite: "explore R21; R67; N1027", ops: Object.freeze({ exploregraph: "read" }) }),
  /* standards R57 (R67; N1029): the proposals made for a project, a read; `project`, `state`, `after` and `limit` the
     query's. */
  standards: Object.freeze({ cite: "standards R57; R67; N1029", ops: Object.freeze({ standardproposals: "read" }) }),
  /* filings R59 (R67; N1030): one filing, read by the viewer's sight; `filing` the body's or the query's. */
  filings: Object.freeze({ cite: "filings R59; R67; N1030", ops: Object.freeze({ filingread: "read" }) }),
  /* action-holds R16 (R67; N1035, K3145): the pressure marks and records of a project or an action, a read; `project`,
     `action`, `after` and `limit` the query's. */
  "action-holds": Object.freeze({ cite: "action-holds R16; R67; N1035", ops: Object.freeze({ pressurefor: "read" }) }),
  /* action-plans R51 (R67; N1038, K3278): the assistant asked for options on a plan, a joined member's act
     (MACHINE_CANNOT_PLAN), `author` and `viewer` from the query, `plan` the body's. */
  "action-plans": Object.freeze({ cite: "action-plans R51; R67; N1038", ops: Object.freeze({ planask: "member" }) }),
  /* membership R143 (R67; N1036, K3211): a member's own mark of when they last looked, an act that records the call's
     instant, `by` the query's and never a body value; a session's only, no working capability. */
  membership: Object.freeze({ cite: "membership R143; R67; N1036", ops: Object.freeze({ lookedsince: "own" }) }),
});

const T48_FAMILIES = Object.freeze([
  /* connections R68 (R67; N1043, K3207): a passage of a held capture attached to a declared step by a member, and the
     attachment withdrawn by the member who made it: each a member's act its owner refuses a machine by name
     (STEP_SOURCE_NOT_A_MEMBER), `contribute`, a session's only, stamped `member` and `viewer` from the query (the
     owner reads the session's own member, never a body value); `relation`, `captureSha`, `extent`, `basis` (and `id`,
     `reason` of the withdrawal) the body's. */
  Object.freeze({ owner: "connections", cite: "connections R68; R67; N1043", actor: QUERY("member"), ops: Object.freeze({
    stepsource: "member", stepsourcewithdraw: "member" }) }),
  /* ai-accounts (R68; N996, K3101; `extraction/credentials-split.md` §2, doubt 4), restated for T53 (ai-accounts R35, BOB
     4 Nov): ai-accounts R35 retires the old door ops (the member's own account reference, the group's API key, the
     subscription's disconnection, a project's key and sign-in, and their states and notices) with no aliases, so they
     are declared nowhere; their place is ai-accounts' current map (`aiAccountsOps`). Kept from T48: the keep-away (an
     administrator's act, every active member's state; a project's, its owner's), the one switch act `accountusesset`
     with the uses and history it reads. New in T53: an account's state and an owner's accounts (ai-accounts R2), the
     checks (R52, R53), the offered AIs (R46) and the personal choice (R47), each a read by its owners, `viewer` the
     query's; and the three plane ops the agent Worker sends (R65–R67: `aicredential` a read stamped `by` alone, `aigatewayserved` and
     `aicredentialfailed` acts that record), any credential's at admission, the owner refusing every principal but the
     Worker's (AI_CREDENTIAL_NOT_SERVED), `by` the query's. The acts the screens send (`aiaccountadd` and the rest, R61,
     R71) are ai-accounts' own `DECLARED_OPS`, and named here too, so the family stamps their `by`. `aigrantmint` stays
     `credentials`'. */
  Object.freeze({ owner: "ai-accounts", cite: "ai-accounts R2, R14–R17, R20–R22, R35, R46, R47, R52, R53, R65–R67; R20, R24, R30, R41; R68; K1544, K1755, K2373, K2435",
    actor: QUERY("by"),
    extra: Object.freeze({ aicredential: Object.freeze(["by"]) }), ops: Object.freeze({
    aikeepaway: "admin", aikeepawaystate: "settingread",
    projectaikeepaway: "own", projectaikeepawaystate: "ownread",
    accountusesset: "own", accountuses: "ownread", accounthistory: "ownread",
    accountstate: "ownread", accountsof: "ownread", aichecks: "ownread", aioffered: "ownread", personalchoice: "ownread",
    aicredential: "settingread", aigatewayserved: "tally", aicredentialfailed: "tally",
    /* the acts the screens send (R61, R71), each a session's own act as ai-accounts declares it, named here so the
       family stamps the `by` each arm reads from the query (a declaration with no `stamps` is stamped the viewer alone) */
    aiaccountadd: "own", aiownadd: "own", aiaccountremove: "own", aiaccountswitch: "own", aiorderset: "own",
    aiprojectorder: "own", aimemberallow: "own", aiprojectuse: "own", aimineuse: "own", aicheckset: "own",
    aiprojectcheckset: "own", aimycheckset: "own", aikeyenter: "own", aikeycloudflare: "own", aikeyseal: "own",
    aitermsaccept: "own", aitermswithdraw: "own", aipersonalchoose: "own", aicreditsclear: "own", aioptinset: "own",
    aisend: "own" }) }),
]);

export { T48_SHARES, T48_FAMILIES };
