/* op-grades — R45, R47 (T50; R32's pattern; K3643, K3627, K3637; DEC-295, DEC-300 (5); `following` R32, R33; `project-roster`
 * R31–R33; `action-records` R17, R19; `action-plans` R1, R20; `wizard-scripts` R9): THE OPS T50'S OWNERS ADD, and the four acts
 * DEC-300 (5) weighs Reversible, graded by R5 and R3 with `affordances` R12's totality holding over them, each grade read from
 * its owner's requirements as R13, R17, R22–R37 and R38–R43 do. Data only: no op's behaviour is decided here (P6).
 *
 * `./index.mjs` spreads the tables into `RUNGS`, `RUNG_ABSENT` and `NON_ACTS`. This file imports nothing, so the spread closes
 * no cycle. None of these ops is an `ACTS` row (`affordances` R51 adds none), so none is in `MACHINE_REFUSALS`: each owner
 * refuses a machine by its own code. None takes a `CONSEQUENCE_STATEMENTS` entry or joins `IRREVERSIBLE_WEIGHT`. By R18
 * `phone` follows the rung: every one answers `true`. `membertie`'s grade (R47) is in `./t33.mjs`, where its op is graded. */

/* ---- R45, R47: the rungs. The five writing acts a further call takes back, R3's rule, as `declaredstakeset` (t45.mjs). ---- */
export const T50_RUNGS = {
  /* R45 (`following` R32): a member's own watch on one item, read back only to its setter; a further watchitem takes it back */
  watchitem:          "reversible",   // following R32 · R3: a further watchitem call sets or clears it, and none asks a reason
  /* R45 (`following` R33): a second look asked of one item, cleared by any member; the clear takes the ask back */
  secondlook:         "reversible",   // following R33 · R3: secondlookclear takes it back
  secondlookclear:    "reversible",   // following R33 · R3: a later secondlook asks for another look again
  /* R45 (`project-roster` R31): a project's declared stake, every value kept; a further set takes it back */
  projectstakeset:    "reversible",   // project-roster R31 · R3: a further projectstakeset sets or clears it
  /* R45 (`action-records` R17): an action's declared stake, every value kept; a further set takes it back */
  actionstake:        "reversible",   // action-records R17 · R3: a further actionstake sets or clears it
  /* R47 (DEC-300 (5); `action-plans` R1, R20): a plan is opened and ended by `planclose`, which takes the open back; the
     design weighs the open Reversible, so no mark is drawn for it (`marks.mjs`). */
  planopen:           "reversible",   // action-plans R1, R20 · R3: planclose ends the plan, and the plan stays readable
  /* R47 (DEC-300 (5); `wizard-scripts` R9): the recording's save is a draft a retirement takes back with a version, as
     wizardretire does; the design weighs it Reversible, so no mark is drawn for it (`marks.mjs`). */
  wizarddraft:        "reversible",   // wizard-scripts R9 · R3: wizardretire takes the script back, with a version
};

/* ---- R45: the stated absence. `actioninquiry` opens a question no published act takes back as such, and asks no reason. ---- */
export const T50_RUNG_ABSENT = {
  /* R45 (`action-records` R19): a question opened with an action as its reference; no published act takes it back as such,
     and it asks no authored reason, so by R3 it is `undetermined` (the reason the R3 tally rises by one for it) */
  actioninquiry: { ground: "undetermined", is: "a member opens a question with an action as its reference, a question no published act takes back as such, and which asks no reason (action-records R19)" },
};

/* ---- R45: every op's NON_ACTS reason. Each read begins "read: " and names what it reads; each writing op names its key. ---- */
export const T50_NON_ACTS = {
  /* the six writing ops, each `…-directed: …` naming its key */
  watchitem: "item-directed: a member's own watch on one followed item, read back only to its setter; moves no bundle",
  secondlook: "item-directed: a member asks a second look at one followed item, seen by every member with the date and note; moves no bundle",
  secondlookclear: "item-directed: a member clears a second look at one followed item, with who and when; moves no bundle",
  projectstakeset: "project-directed: a project's declared stake, every value kept, keyed by project; moves no bundle",
  actionstake: "action-directed: an action's declared stake, every value kept, keyed by action; moves no bundle",
  actioninquiry: "action-directed: a question opened with an action as its reference, keyed by action; reached from the action, and writes this module's rows, never a bundle's state",
  /* the nine reads */
  lookedat: "read: a member's own last look at Home (`membership` R148), read without moving the mark; answered to that member alone",
  browse: "read: what the viewer may see, by change, newest first, with what is new since a time, watched or flagged (`retrieval` R85); writes nothing",
  opencaptures: "read: a member's own unfinished captures (`acquisition` R46); writes nothing",
  capturegrade: "read: one capture's grade, keyed by capture sha (`capture` R95); writes nothing",
  inquirypartition: "read: a question's partition with each change's strength, keyed by inquiry (`inquiry` R65); writes nothing",
  instances: "read: the matters followed through a progression, each with its instance (`progressions` R44); writes nothing",
  projectstake: "read: a project's declared stake with its history, keyed by project (`project-roster` R32); writes nothing",
  projectownersgone: "read: whether every owner of a project is gone, keyed by project (`project-roster` R33); writes nothing",
  stakeatpreparation: "read: what a preparation's stake question reads (`filings` R62), a prompt and never a gate; writes nothing",
};
