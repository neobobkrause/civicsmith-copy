/* op-grades — R17 (was `affordances` R45; K1864): THE OPS T34 DECLARES IN `op-declarations` R22–R24, R26, R28 AND R15,
 * graded by R5 and R3 with `affordances` R12's totality holding over them, each grade read from its owner's requirements
 * as R13 does; and `op-declarations` R21's ALIASES, each taking its op's grade and reason through one frozen table, so an
 * alias never differs from its op. Data only: no op's behaviour is decided here (P6). `./index.mjs` spreads the three
 * tables and applies `aliased` to its own. This file imports only `word` from `setup-words`, so the spread closes no cycle. */

import { word } from "../setup-words/index.mjs";

const R = (s) => `read: ${s}; writes nothing`;
const ROSTER_DOOR = (s) => `roster governance: ${s}; the subject is who may join, not a bundle`;

/* ---- the rungs (R19's backing beside each) ---- */
export const T34_RUNGS = {
  /* tasks R15: a `concern` asks its reason (CHECK_NO_REASON), a `check` none — `triage`'s shape (K212) */
  checkrecord:          "reasoned",   // CHECK_NO_REASON (tasks R15)
};

/* ---- the stated absences ---- */
export const T34_RUNG_ABSENT = {
  /* membership R98–R105: who may join, as memberadd and knock */
  invitewithdraw:       { ground: "credential", is: "an administrator withdraws an unused invitation, the member becoming revoked (membership R98)" },
  websitekeycreate:     { ground: "credential", is: "an administrator creates the one live key the group's website invites members with, its scope, daily cap and expiry (membership R99)" },
  websitekeyset:        { ground: "credential", is: "an administrator changes the live website key's scope, cap or expiry, appended (membership R100)" },
  websitekeyrevoke:     { ground: "credential", is: "an administrator revokes the website key; the invitations it made stay as they are (membership R100)" },
  joinlinkenable:       { ground: "credential", is: "an administrator turns on the one join link, its scope, daily cap and expiry (membership R102)" },
  joinlinkset:          { ground: "credential", is: "an administrator changes the live join link's settings, appended (membership R103)" },
  joinlinkreplace:      { ground: "credential", is: "an administrator replaces the join link, the old one dead at once (membership R103)" },
  joinlinkoff:          { ground: "credential", is: "an administrator switches the join link off (membership R103)" },
  websiteinvite:        { ground: "credential", is: "the group's website, holding the key, invites one person under a cover name (membership R101)" },
  joinlinkinvite:       { ground: "credential", is: "a person holding the join link asks to be invited under a cover name (membership R104)" },
  /* membership R107, R109: the group's settings and its words for itself, as groupnameset */
  courtnoticeset:       { ground: "substrate", is: "an administrator records whether members are told what a court can reach, appended; it moves no document, claim or grade (membership R107)" },
  groupdescriptionset:  { ground: "substrate", is: "an administrator records the group's own description of itself and who may read it, appended; a presentation value in no signed bytes (membership R109)" },
  /* tasks R13, R14, on R3's rule: no reason is asked and no published act takes either back */
  checkrequest:         { ground: "undetermined", is: "a project owner asks a member, or the members declaring an expertise, to check one held object (tasks R13)" },
  checktake:            { ground: "undetermined", is: "a member who may see the object takes a check request, once; another's take is refused (tasks R14)" },
  /* credentials R33, R36: the group's key, as keyedserviceset; its switch, as keyedserviceswitch. (R30; DEC-188 (8))
     `groupswitchset` is retired to `accountusesset` (./t41.mjs). */
  groupkeyset:          { ground: "credential", is: "an administrator sets the group's sealed assistant key, never answered (credentials R33)" },
  groupkeyremove:       { ground: "credential", is: "an administrator removes the group's assistant key (credentials R33)" },
  groupkeyswitch:       { ground: "substrate", is: "an administrator switches the group's assistant key on or off; it moves no document, claim or grade (credentials R33)" },
  groupkeynoticeseen:   { ground: "caller-owned", is: "records that a member saw the notice of the group's key, for that member alone (credentials R36)" },
  /* instance-setup R60, R64: an administrator's setting, as officesseed; a member's own language, as standingset */
  placewanted:          { ground: "substrate", is: "an administrator records the place the group wants its profile for; it moves no document, claim or grade (instance-setup R60)" },
  memberlanguageset:    { ground: "caller-owned", is: "a member sets the language the interface speaks to them (instance-setup R64)" },
};

/* ---- every gated op's NON_ACTS reason (R5) ---- */
export const T34_NON_ACTS = {
  invitewithdraw: ROSTER_DOOR("an administrator's withdrawal of an invitation"),
  websitekeycreate: ROSTER_DOOR("the website's key, an administrator's"),
  websitekeyset: ROSTER_DOOR("the website's key, an administrator's"),
  websitekeyrevoke: ROSTER_DOOR("the website's key, an administrator's"),
  joinlinkenable: ROSTER_DOOR("the join link, an administrator's"),
  joinlinkset: ROSTER_DOOR("the join link, an administrator's"),
  joinlinkreplace: ROSTER_DOOR("the join link, an administrator's"),
  joinlinkoff: ROSTER_DOOR("the join link, an administrator's"),
  courtnoticeset: "the group's setting: whether members are told what a court can reach; an administrator's, not an act on an object",
  groupdescriptionset: "the group's description of itself — the subject is the group's identity, not a bundle; an administrator's",
  checkrequest: "check-directed: keyed by a held object and its addressees, reached from the object; writes tasks' rows and moves no bundle",
  checktake: "check-directed: keyed by a check request, reached from the member's To do; writes tasks' rows and moves no bundle",
  checkrecord: "check-directed: keyed by a check request its taker holds; a check, or a concern with its reason, appended once",
  checkrequests: R("the check requests the viewer made, each with who took it and its record"),
  checksof: R("the checks recorded on one object the viewer may see"),
  groupkeyset: word("ai-accounts.declared.groupkeyset"),
  groupkeyremove: word("ai-accounts.declared.groupkeyremove"),
  groupkeyswitch: word("ai-accounts.declared.groupkeyswitch"),
  groupkeystate: R("whether the group's assistant key is held and on, the whole state to an administrator"),
  groupkeynotice: R("the notice of the group's key for the session's own member"),
  groupkeynoticeseen: word("ai-accounts.declared.groupkeynoticeseen"),
  placewanted: "the instance's configuration: the place the group wants its profile for; an administrator's",
  placewantedstate: R("the place the group wants its profile for, and whether one is held"),
  memberlanguageset: "personal state, keyed by member: the language the interface speaks to them",
  memberlanguage: R("a member's own interface language"),
  startfrom: word("act.startfrom.does"),
};

/* ---- `op-declarations` R21's aliases (op-declarations R5, R21): each the op its owner serves it as. `expunge` is no
   alias since K1901: `personexpunge` is a declared op (K2054); `claimidentity` none since DEC-182 (2) (K2239): the
   same-person claim is `identityclaim` ---- */
export const OP_ALIASES = Object.freeze({
  signerregisterown: "signerregister", signerrevokeown: "signerrevoke", declaretie: "membertie",
  withdrawtie: "membertiewithdraw", adoptversion: "versionadopt", keepversion: "versionkeep",
  ruleanswer: "rule", standingquestionset: "standingset",
  standingquestionend: "standingend", recordpersonfact: "personfact", withdrawidentityclaim: "identitywithdraw",
  createevent: "eventcreate", addparticipant: "participantadd", relate: "eventrelate", recorddatedfact: "datedfact", recordfact: "moneyrecord",
  createset: "moneysetcreate", include: "moneysetinclude", exclude: "moneysetexclude", reconcile: "moneyreconcile",
  addworkbook: "workbookadd", bind: "workbookbind", recordcheck: "workbooksecondcheck", recordline: "linerecord",
  declare: "dutydeclare", filingrecordsent: "filingsent",
});

/** The alias entries of one table: each alias whose op the table holds, with that op's very value. */
export const aliased = (table) =>
  Object.fromEntries(Object.entries(OP_ALIASES).filter(([, op]) => Object.hasOwn(table, op)).map(([a, op]) => [a, table[op]]));
