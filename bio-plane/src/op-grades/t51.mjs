/* op-grades — R48 (T51; DEC-340, U366; K3935; amends R8): THE THREE READS THE DESIGN'S NEW SCREENS ADD, stated absent as reads.
 * `holdsdue` (`action-holds` R19), `templatebyhandle` (`filing-templates` R34) and `rulefields` (`local-facts` R18) write
 * nothing, so they take no rung and no ground: each has its `NON_ACTS` reason, beginning "read: ", and no other grade.
 * `./index.mjs` spreads the table into `NON_ACTS`. This file imports only `setup-words` (`word`, as `t34.mjs` does), so the spread closes no cycle. None is an
 * `ACTS` row, so none is in `MACHINE_REFUSALS`, and none takes a `CONSEQUENCE_STATEMENTS` entry or joins `IRREVERSIBLE_WEIGHT`;
 * by R18 `phone` follows the rung and the ground, and a read answers `true`. */

import { localize, word } from "../setup-words/index.mjs";

/* ---- R48: the reads' reasons. Each names what it reads and writes nothing. ---- */
export const T51_NON_ACTS = {
  /* R48 (`action-holds` R19): the hold screen's due list, the legal marks, docket marks and pressure records without a hold */
  holdsdue: "read: the legal marks, docket marks and pressure records that have no hold yet, each with where it arrived and who marked it (`action-holds` R19); writes nothing",
  /* K5232 (`action-holds` R22): the places a hold was stated, for the hold screen's held and released list; the owner's sentence, word for word (R50 (b)) */
  holdsplaced: localize("action-holds.declared.holdsplaced", "read: every place a hold was stated that the member may see, with its latest hold and what prompted it; writes nothing (action-holds R22)"),
  /* R48 (`filing-templates` R34): one template's text and blanks by its name, for the version offered to the caller */
  templatebyhandle: "read: a template's text and blanks by its name, for the version offered to the caller (`filing-templates` R34); writes nothing",
  /* R48 (`local-facts` R18): the fields a drafted rule's entry carries, per section, with their choices */
  /* R77–R79 (op-declarations; K3826, K3839, K3843, K3853, K3861, K3867, K4059): the session reads op-declarations declares for T51 */
  adminremovalsopen: "read: the member removals under way, for an administrator (`member-roster` R75); writes nothing",
  approvedunsent: "read: approved filings not yet sent (`filings` R53); writes nothing",
  bundlehistory: "read: a bundle's revisions and states, newest first (`promotion` R58); writes nothing",
  checkpointsdue: "read: the plan checkpoints due, answered to a viewer who sees the plan (`action-plans` R17); writes nothing",
  clocksrunning: "read: the clocks a member has running, counted (`action-clocks` R24); writes nothing",
  remindersfor: "read: an action's reminders, each with its entry, its day, who set it and its state; writes nothing (action-clocks R26)",   // fix round 3, B5
  entityidonly: "read: entities by id, with no further fields (`entities` R57); writes nothing",
  entitysimilar: "read: entities similar to a name, checked before another is added (`entities` R60); writes nothing",
  heldat: "read: whether an address is held and where its capture stands (`capture` R96); its one write is the governor's bookkeeping, and no record",
  projectinvitations: "read: a project's invitations, answered to a viewer who sees the project (`project-roster` R35); writes nothing",
  publishedfrozen: "read: public, no credential: a published edition as it was frozen at publication (`public-read` R38); writes nothing",
  subjectsnamed: "read: the subjects a name matches, for Find's subject route (`entities` R59); writes nothing",
  versioncompare: "read: two versions of a basis compared (`basis-versions` R55); writes nothing",
  rulefields: "read: the fields a drafted rule's entry carries for a section, with their kinds and choices (`local-facts` R18); writes nothing",
};

/* ---- fix round 3 (K4379, K4380; B6, B7): THE THREE MUTATING ACTS' GRADES, each by its owner's weight, with its NON_ACTS publication row.
 * `scanmirror` (`file-safety` R49; an administrator asks the scanner for new signatures; moves no bundle) is the substrate; `officeconfirm`
 * (`entities` R64; an administrator confirms an office a member named) weighs Reversible; `captureseenin` (`capture` R101; a member records
 * once that she filed a held document in a project; a repeat changes nothing, nothing takes it back, no reason is asked) is an observation.
 * The sentences are the owners' descriptions, word for word (R50 (b): a disagreement refuses the registration). ---- */
export const T51_RUNGS = {
  officeconfirm: "reversible",   // entities R64 · R3: an administrator's confirmation takes back nothing a member said; the mark returns by naming again
};
export const T51_RUNG_ABSENT = {
  scanmirror: { ground: "substrate", is: localize("file-safety.declared.scanmirror", "setting: the group's file scanner, an administrator's act; asks it to check for new signatures now and answers at once; moves no bundle") },
  captureseenin: { ground: "observational", is: localize("capture.declared.captureseenin", "member-directed: a member records once that she filed a held document in a project; a repeat changes nothing, and no reason is asked (capture R101)") },
};
export const T51_ACT_NON_ACTS = {
  scanmirror: localize("file-safety.declared.scanmirror", "setting: the group's file scanner, an administrator's act; asks it to check for new signatures now and answers at once; moves no bundle"),
  officeconfirm: word("entities.declared.officeconfirm"),
  captureseenin: localize("capture.declared.captureseenin", "member-directed: a member records once that she filed a held document in a project; a repeat changes nothing, and no reason is asked (capture R101)"),
};
