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
  /* ai-accounts (R68; N996, K3101; `extraction/credentials-split.md` §2, doubt 4): the 24 ops whose routes moved from
     `credentials`, with the kinds and stamps they had there: a member's own account reference (setting and clearing it,
     reading it), the group's API key (an administrator's acts, a session's state and notice), a member's own
     subscription disconnected, the keep-away (an administrator's act, every active member's state), the one switch act
     `accountusesset` with the uses and history it reads, and a project's account (an owner's own acts, the state, the
     notice and the keep-away, `projectkeyset`'s key the body's only). `aigrantmint` stays `credentials`'. */
  Object.freeze({ owner: "ai-accounts", cite: "ai-accounts R1–R33; R68; credentials R20, R22–R27, R33, R36, R41; K1544, K1755, K2373, K2435",
    actor: QUERY("by"),
    extra: Object.freeze({ accountreferenceset: Object.freeze(["member"]), accountreferenceremove: Object.freeze(["member"]),
                           accountreference: Object.freeze(["member"]) }), ops: Object.freeze({
    accountreferenceset: "own", accountreferenceremove: "own", accountreference: "ownread",
    groupkeyset: "admin", groupkeyremove: "admin", groupkeyswitch: "admin",
    groupkeystate: "ownread", groupkeynotice: "ownread", groupkeynoticeseen: "own",
    subscriptiondisconnect: "own", aikeepaway: "admin", aikeepawaystate: "settingread",
    projectkeyset: "own", projectsigninset: "own", projectaccountremove: "own", projectaccountswitch: "own",
    projectaccountstate: "ownread", projectkeynotice: "ownread", projectkeynoticeseen: "own", projectaikeepaway: "own",
    projectaikeepawaystate: "ownread", accountusesset: "own", accountuses: "ownread", accounthistory: "ownread" }) }),
]);

export { T48_SHARES, T48_FAMILIES };
