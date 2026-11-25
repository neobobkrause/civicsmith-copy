/* op-grades — R21, R22 (K1943; T35): THE OPS `op-declarations` R30 DECLARES, AND (K2043) THE OTHER OPS IT DECLARES IN
 * T35 FOR THE OWNERS OF L5 AND L6, graded by R5 and R3 with `affordances` R12's
 * totality holding over them, each grade read from its owner's requirements as R13 and R17 do; and `personexpunge`'s
 * consequence statement (N623, DEC-142), a named exception beside `actionholdrelease` (R8, DEC-113's tier). Data only: no
 * op's behaviour is decided here (P6). `./index.mjs` spreads the four tables into `RUNGS`, `RUNG_ABSENT`, `NON_ACTS` and
 * `CONSEQUENCE_STATEMENTS`, and derives R21's Irreversible weight. This file imports only `word` from `setup-words`, so the spread closes no
 * cycle. None of these ops is in `MACHINE_REFUSALS`, which holds only `affordances`' `ACTS` (R5, `affordances` R20).
 * `subscriptionsignin` had no op in T35 and no grade (`op-declarations` R27); R27 grades it in `./t37.mjs` (T37). */

import { word } from "../setup-words/index.mjs";

const R = (s) => `read: ${s}; writes nothing`;
const NOTE_DIRECTED = "note-directed: a member's own note, keyed by the note and answered to its author alone; never a "
  + "record id, never cited, published or counted; moves no bundle";
const SESSION_DIRECTED = "session-directed: ends the caller's own session, or every session of the caller's role; moves "
  + "no bundle";

/* ---- the rungs (`affordances` R19's backing beside each) ---- */
export const T35_RUNGS = {
  /* acquisition R43: a further set takes it back, and it asks no reason (R3) */
  coarchiveset:         "reversible", // a further coarchiveset sets it again
  /* K2043 (B3): the ops T35's L5 and L6 owners serve that op-declarations declares beside R30's, graded on the same rule */
  /* standards R35, R37, R40, R43: each refuses an absent reason STANDARD_NO_REASON and is corrected forward (a force
     withdrawn and declared again, an adoption or imposition superseded by a later one, a benchmark declared again) */
  standardforce:        "reasoned",   // STANDARD_NO_REASON (standards R35)
  standardforcewithdraw: "reasoned",  // STANDARD_NO_REASON (standards R35: a correction withdraws a force with a reason)
  standardrelease:      "reasoned",   // STANDARD_NO_REASON (standards R37: never undone, recorded with who, when and why)
  standardadoption:     "reasoned",   // STANDARD_NO_REASON (standards R40)
  standardimpose:       "reasoned",   // STANDARD_NO_REASON (standards R43)
  standardbenchmark:    "reasoned",   // STANDARD_NO_REASON (standards R43: recorded with who, when and why)
  /* events R45, duties R27: a recorded use withdrawn, and a use linked or unlinked, each with a reason */
  usewithdraw:          "reasoned",   // NO_REASON (events R45)
  uselink:              "reasoned",   // DUTY_NO_REASON (duties R27); useunlink takes it back with its own reason
  useunlink:            "reasoned",   // DUTY_NO_REASON (duties R27: an unlink keeps the link, shown unlinked)
};

/* ---- the stated absences ---- */
export const T35_RUNG_ABSENT = {
  /* acquisition R38, R40, on R3's rule, as inboxpull and caseimport */
  unpack:               { ground: "undetermined", is: "files a held archive's entries as captures of their own in a member's name, each at the archive's grade and promoted beside it; asks no authored reason, and no published act takes it back (acquisition R38, R40)" },
  /* hypotheses R11, R12 (DEC-144), as notewrite (R15) */
  noterevise:           { ground: "caller-owned", is: "a member revises their own note in place, answered to that member alone; no history is kept (hypotheses R11, R12)" },
  notedelete:           { ground: "caller-owned", is: "a member deletes their own note for good, with no marker, answered to that member alone (hypotheses R11, R12)" },
  /* credentials R39 (F14), a member's own sessions, as reminderset: so by R18 each is a phone act */
  signout:              { ground: "caller-owned", is: "a member ends the session they are using; it moves nothing in the record (credentials R39)" },
  signouteverywhere:    { ground: "caller-owned", is: "a member ends every session of their own role; it moves nothing in the record (credentials R39)" },
  /* credentials R46, R47 (K1888), as signeradd and knockerconsent */
  recoverycodesissue:   { ground: "credential", is: "an administrator issues their own ten one-time recovery codes, shown once and stored as digests (credentials R46)" },
  recover:              { ground: "credential", is: "a recovery code and a new password, reached with no session, set the password and spend the code (credentials R47)" },
  /* K2043 (B3). events R43, R44: created as eventcreate creates an event; the stated reason is the record's, never the
     member's account, so on R3's rule neither asks one and no published act takes either back (usewithdraw sets a use
     aside as withdrawn, the event kept) */
  discretionrecord:     { ground: "undetermined", is: "a member records one use of a power — an act of discretion or a waiver — as an event with its decider, subject, provision, the reason as the record states it and its outcome (events R43)" },
  assessmentrecord:     { ground: "undetermined", is: "a member records one accreditation or certification assessment as an event, with the standards it found unmet, each cited (events R44)" },
  /* calculations R32: freezes the held uses a filter answers at this instant, as recordset freezes a query's ids */
  usesfreeze:           { ground: "observational", is: "freezes the held uses of powers a member may see, under a filter, as a table input at this instant; a later freeze is another set (calculations R32)" },
  /* standards R35, duties R28: a proposal stored apart and labelled, as lawpropose and dutypropose */
  standardforcepropose: { ground: "undetermined", is: "a machine or a member PROPOSES the force of one provision with its citation, stored apart and labeled; a force only when a member confirms it (standards R35)" },
  reviewpropose:        { ground: "undetermined", is: "a machine or a member PROPOSES a policy's own review date as the body's commitment, stored apart and labeled; never tracked until a member adopts it (duties R28)" },
  /* capture-requests R51, R52: a member's act on the record that asks no reason; an answer is recorded once and never
     replaced, and no published act takes either back */
  recordsrequestopen:   { ground: "undetermined", is: "a member records that the group is asking the issuer of a policy held only by citation for its text; one open request per standard (capture-requests R51)" },
  recordsrequestanswer: { ground: "undetermined", is: "a member records the issuer's answer to a records request — produced, none exists, withheld or no answer — once, never replaced (capture-requests R52)" },
  /* credentials R43: the member's own subscription fact cleared, as accountreferenceremove */
  subscriptiondisconnect: { ground: "credential", is: "a member clears the fact that they are connected through their own subscription; it holds no login (credentials R43)" },
};

/* ---- every op's NON_ACTS reason (R5) ---- */
export const T35_NON_ACTS = {
  unpack: "archive-directed: keyed by a held archive's capture, reached from its screen; files its entries as captures of "
    + "their own at the archive's grade, each promoted beside it",
  coarchiveset: "setting: the group's choice whether a capture asks for a co-archive; an administrator's act; moves no "
    + "bundle",
  noterevise: NOTE_DIRECTED,
  notedelete: NOTE_DIRECTED,
  signout: SESSION_DIRECTED,
  signouteverywhere: SESSION_DIRECTED,
  recoverycodesissue: "credential: an administrator's own recovery codes, shown once; moves no bundle",
  recover: "credential: a recovery code and a new password, reached with no session; moves no bundle",
  archivelist: R("a held archive's entries, each one's state and, when not filed, its refusal by name"),
  coarchivestate: R("whether the group's captures ask for a co-archive"),
  findin: R("what a scope holds of the kinds asked, each match with its words and extent, found by search; it records "
    + "nothing"),
  entitieskind: R("the group's registered entities of one kind, within the viewer's gate"),
  securitymap: word("act.securitymap.does"),
  recoverycodesstate: R("how many of an administrator's own recovery codes are unspent, never a code"),
  adminrecoverystep: R("whether the group's second-administrator step is done, to an administrator"),
  credit: "read: public, no credential",
  /* `agentpack` has no `NEEDS` row (op-declarations R30: the untargeted `affordances`' spec), so it is named nowhere here
     (K2054; `affordances` R12) */
  /* K2043 (B3) */
  standardforce: "standard-directed: keyed by a standard and one of its provisions, reached from the standard's text; a "
    + "member's confirmed force with its citation, moving no bundle",
  standardforcewithdraw: "standard-directed: keyed by a confirmed force; kept, shown withdrawn with who, when and why",
  standardforcepropose: "standard-directed: keyed by a standard and one of its provisions; a proposal stored apart and "
    + "labeled, never a force until a member confirms it",
  standardrelease: "standard-directed: keyed by a policy held at its source's sight, reached from the policy; its owner "
    + "moves it to the group's sight, recorded and never undone",
  standardadoption: "standard-directed: keyed by a standard and the act that adopted it; writes standards' rows and moves "
    + "no bundle",
  standardimpose: "standard-directed: keyed by a standard, a body and the law that imposes it; writes standards' rows and "
    + "moves no bundle",
  standardbenchmark: "standard-directed: keyed by a standard and a body; a comparison declared, never a finding that the "
    + "body is bound",
  forcesof: R("each portion's confirmed force of a standard with its citation, holder and criteria, its proposals apart"),
  overridesof: R("the overrides naming or made by a standard"),
  editioninforce: R("the edition a body's adoptions put in force on a date, with the adoption it rests on, or undetermined"),
  bindsat: R("whether a held standard binds a body on a date, or is a benchmark, or undetermined, with what it rests on"),
  discretionrecord: "event-directed: keyed by a new EVT- id; writes events' rows and moves no bundle",
  assessmentrecord: "event-directed: keyed by a new EVT- id; writes events' rows and moves no bundle",
  usewithdraw: "event-directed: keyed by event; keeps it, shown withdrawn with who, when and why, and moves no bundle",
  usesof: R("the held uses of powers the viewer may see — acts of discretion, waivers and assessments — never every use made"),
  usesfreeze: "set-directed: keyed by the frozen set's digest; freezes the held uses a filter answers as a table input",
  applicationrecipes: R("the recipes of application a member instantiates over a frozen uses table"),
  uselink: "power-directed: keyed by (power, event); a member's link with its reason, moving no bundle",
  useunlink: "power-directed: keyed by (power, event); keeps the link, shown unlinked with who, when and why",
  reviewpropose: "duty-directed: keyed by a new proposal; stored apart and labeled, never tracked until a member adopts it",
  poweruses: R("the events that use a power held, each with how it is linked and whether its decider is the obligor"),
  recordsrequestopen: "standard-directed: keyed by a standard held only by citation; writes capture-requests' rows and "
    + "moves no bundle",
  recordsrequestanswer: "request-directed: keyed by a records request; its answer recorded once and moves no bundle",
  recordsrequests: R("the records requests whose standard the viewer may see, each with its answer"),
  subscriptiondisconnect: "credential governance: a member clears their own subscription fact; the subject is a "
    + "credential, not a bundle",
};

/* ---- R21 (N623, DEC-142): `personexpunge`'s consequence entry. Its rung stays `reasoned` (people R12 refuses it
   without a reason, R13), its name honest; the full dialog states what the owner enforces: the value removed from the
   person's page, every question that cited it and every export, with no read answering it again (people R12), and a
   marker in its place. (R44, T49) The entry holds the sentence's key, never its English: the surface reads
   `word("screen.person.expunge.statement", {date, member})` by the act's id. ---- */
export const T35_CONSEQUENCE_STATEMENTS = Object.freeze({
  personexpunge: Object.freeze({ friction: "dialog", key: "screen.person.expunge.statement" }),
  /* K2049 (DEC-143 applied): releasing a policy held at its source's sight is never undone (standards R37), so it carries
     the Irreversible weight and DEC-143's full dialog stating that it is permanent; its rung stays `reasoned`. The
     sentence (`consequence.standardrelease`) says what the owner enforces: the group's sight from then on, recorded with
     who, when and why. */
  standardrelease: Object.freeze({ friction: "dialog", key: "consequence.standardrelease" }),
});
