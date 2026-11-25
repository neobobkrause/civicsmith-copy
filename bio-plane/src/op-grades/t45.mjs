/* op-grades — R32 (T45; the Actions fold, N893; K2569's pattern; the plan's reconciliation R1, R21): EVERY OP T45'S
 * OWNERS SERVE, the ops `op-declarations` R49 declares, graded by R5 and R3 with `affordances` R12's totality holding over
 * them, each grade read from its owner's requirements and merged code as R13, R17 and R22–R31 do. Data only: no op's
 * behaviour is decided here (P6).
 *
 * R32's rule: an act that requires an authored reason is `reasoned`, its refusal code in `JUSTIFICATION_REFUSALS`
 * (`./index.mjs`); an act a published act takes back is `reversible`; a member's own setting `caller-owned`; otherwise
 * `undetermined`. A recorded fact held as bytes or a member's account (a receipt, a notice sent, a pressure record) asks
 * no authored reason: R1's K1025 grounds class names its four ops by ruling, so none of these joins it. An approval
 * recorded at most once is `filingapprove`'s `terminal`; a record judged once, never re-judged, `checkpointrecord`'s
 * `undetermined`. The assertion resolution per sentence is `filings`' approval (reconciliation R1), graded there.
 *
 * `./index.mjs` spreads the three tables into `RUNGS`, `RUNG_ABSENT` and `NON_ACTS`. This file imports only `word` from `setup-words`, so the
 * spread closes no cycle. (K2885, K2887) The ten acts `affordances` R51 makes ACTS rows on an action target have no
 * NON_ACTS row here, and eight of them are in `MACHINE_REFUSALS` (`./index.mjs`) with their owners' codes; every other op
 * here is a non-act, refused a machine by its owner's own code where it is. By R18 `phone` follows the rung. No consequence
 * statement is added (R32: which acts take one is the UX stream's to propose); `publishcheck`, graded as `publish`
 * (case-check's Uses; K2839), is `terminal` with it since R37 (T47) and carries no Irreversible weight. (T46; K2881) The five ops `op-declarations`
 * declared under R49 after this module's T45 merge (`grouprules`, `advocacycheck`, `advocacychecks`, `infractiondraft`,
 * `bearingdraft`) are graded here by the same rule; none is an act of `affordances` or a machine refusal (`case-account`
 * refuses a machine itself, `MACHINE_CANNOT_CHECK_ADVOCACY`). */

import { word } from "../setup-words/index.mjs";

const R = (s) => `read: ${s}; writes nothing`;
const PLAN = (s) => `plan-directed: ${s}; kept in the plan's history, never published; moves no bundle`;
const SUCCESS = (s) => `success-directed: ${s}; never a consequence part; moves no bundle`;
const RULE = (s) => `rule-directed: ${s}; the group's own rule beside the profiles, never a profile's; moves no bundle`;
const WATCH = (s) => `watch-directed: ${s}; moves no bundle`;

/* ---- the rungs (`affordances` R19's backing beside each) ---- */
export const T45_RUNGS = {
  /* case-check R1 (K2839): the same `publishCase` write as `publish`, refused MACHINE_CANNOT_PUBLISH, and graded as it;
     (R37, T47) `terminal` with it, a preparation held unsigned that publishes nothing until a member signs */
  publishcheck:        "terminal",     // case-check R1 · graded as publish (its Uses; K2839; R37)
  /* filings R42: a second approval stands, recorded at most once (ALREADY_APPROVED), as filingapprove (DEC-88) */
  filingsecondapprove: "terminal",     // filings R42 · ALREADY_APPROVED: approved a second time at most once
  /* reasoned: each owner refuses the act without the member's authored reason, in its own word for it */
  scenariosetaside:    "reasoned",     // PLAN_NO_REASON (action-plans R39, R4)
  scenariorestore:     "reasoned",     // PLAN_NO_REASON (action-plans R39, R4)
  planpause:           "reasoned",     // PLAN_NO_REASON (action-plans R40, R4)
  planresume:          "reasoned",     // PLAN_NO_REASON (action-plans R40, R4)
  actionscope:         "reasoned",     // SCOPE_NO_REASON (actions R87; a later statement supersedes, every one kept)
  projectscopeset:     "reasoned",     // NO_REASON (project-roster R21; appended, the latest the scope)
  projectapprovalset:  "reasoned",     // NO_REASON (project-roster R24; appended, the latest governs)
  successrevise:       "reasoned",     // SUCCESS_NO_REASON (consequences R21; K2857)
  cureunlink:          "reasoned",     // CONFORMANCE_NO_REASON (conformance R36: reason as R7's)
  ruledraft:           "reasoned",     // RULE_NO_REASON (local-facts R10)
  rulewithdraw:        "reasoned",     // RULE_NO_REASON (local-facts R13)
  /* reversible: a published act of the owner's takes the result back, and none asks a reason (R3) */
  followend:           "reversible",   // following R22: a later followend sets the end again, or `null` removes it
  actionpromise:       "reversible",   // actions R88: a later actionpromise with `ends` ends it, its text the reason
  actionreplybearing:  "reversible",   // action-replies R1: a later layout of the same entry replaces it, the earlier kept
  actionbearingpropose: "reversible",  // action-replies R1: restated by the same proposer, as actionseekspropose
  curelink:            "reversible",   // conformance R36: cureunlink takes it back
  matteroutcomeset:    "reversible",   // plan-work R1: a later statement replaces it, each revision kept
  plancomment:         "reversible",   // plan-work R6: a comment answered by another, as reviewcomment (DEC-88)
  /* B6 (K2896): instance-setup R77, as coarchiveset: a later setting replaces it (`null` clears it), and none asks a reason */
  declaredstakeset:    "reversible",   // instance-setup R77: a further declaredstakeset sets or clears it, every value kept
};

/* ---- the stated absences ---- */
export const T45_RUNG_ABSENT = {
  /* the caller's own: a member's own standing question's end, review reminder and take-ups (R32) */
  standingendset:   { ground: "caller-owned", is: "a member changes the end date of their own standing question, answered to them alone; an ended question is never revived (answers R34)" },
  planreviewrhythm: { ground: "caller-owned", is: "a member sets or removes their own repeating reminder to review a plan (plan-work R4)" },
  prepitemtakeup:   { ground: "caller-owned", is: "a member takes a plan's preparation item up herself, with her own target date; nobody assigns anybody (plan-work R5)" },
  itemtakeup:       { ground: "caller-owned", is: "a member routes a clock entry's, a checkpoint's, a proposed stage's or a hold's to-dos to herself from then; nobody assigns anybody (plan-work R11)" },
  /* on R3's rule: none asks an authored reason, and no published act takes it back */
  dutyfromresponse: { ground: "undetermined", is: "a machine or a member PROPOSES one duty from a body's reply or a report, its quote held as written, stored apart and labeled; never tracked until a member adopts it (duties R30, as R2)" },
  actionreceipt:    { ground: "undetermined", is: "a member records that a sent entry was received or served, how and when, held as a capture or the member's account; a second record appends (actions R80)" },
  holdnoticesent:   { ground: "undetermined", is: "a member records that she sent the hold notice for a hold in place, held as the bytes sent or her account; it records no recipient and no one's compliance (action-holds R11)" },
  pressurerecord:   { ground: "undetermined", is: "a member records pressure that arrived outside any action, held as a capture or her account, in a project she sees; no action is created (action-holds R12)" },
  watchlink:        { ground: "undetermined", is: "a member records that a plan set a watch running, naming the matters it serves; links are append-only (following R23)" },
  watchanswer:      { ground: "undetermined", is: "one of a watch's recipients answers its once-only question, keep until a day or stop, setting the watch's end in its owner's terms; answered once (following R25)" },
  jointsignatory:   { ground: "undetermined", is: "a member records that a partner organisation approved the same text in its own copy, by its own act; recorded once per partner (filings R36)" },
  holdnoticeprepare: { ground: "undetermined", is: "a member prepares a plain notice telling members what to keep outside Civicsmith for a hold in place, assembled from the record and labeled as a draft; a member sends it by her own hand (filings R47)" },
  arosefrom:        { ground: "undetermined", is: "a member records that a matter or project arose from a response; appended, never edited (action-replies R2)" },
  successrecord:    { ground: "undetermined", is: "a member records what changed and when for a matter, on evidence, its figures computed and any cause on evidence other than the group's own act; never edited, revised by a successor (consequences R17)" },
  outcomecarry:     { ground: "undetermined", is: "a member carries a success, a harm addressed or a cure into a case's next edition through the case's own service, its text and citations only (consequences R22)" },
  clockstate:       { ground: "undetermined", is: "a member states a clock entry of an action with its basis and who owes it, appended by a revision of the action as clockadopt is (action-clocks R18)" },
  planreviewrecord: { ground: "undetermined", is: "a member records a dated review entry of a plan, what the members decided (plan-work R4)" },
  prepitemadd:      { ground: "undetermined", is: "a member adds a preparation item to one of a plan's options, seen by whoever sees the plan (plan-work R5)" },
  prepitemdone:     { ground: "undetermined", is: "a member marks a plan's preparation item done; marked once, as checkpointrecord is judged once (plan-work R5)" },
  statusreportsave: { ground: "undetermined", is: "a member keeps a status report with a plan, never required and never published, as reportkeep (plan-work R8)" },
  ruleconfirm:      { ground: "undetermined", is: "a member other than its drafter confirms a group rule, with her qualification where its tier asks one; the confirmation stands, and a withdrawal ends the rule, as templateapprove (local-facts R11)" },
  /* (T46; K2881) case-account R13, declared after this module's T45 merge: the text and its check kept in her own hidden
     project; it asks no authored reason and no published act takes it back */
  advocacycheck:    { ground: "undetermined", is: "a member checks text she wrote against the record, each claim and position sentence answered supported, not supported or contradicted, the text and its check kept in her own hidden project only and usable as no mark (case-account R13)" },
};

/* ---- every op's NON_ACTS reason (R5; R32: a read "read: …", a draft "draft: …") ---- */
export const T45_NON_ACTS = {
  /* action-plans (R39, R40) */
  scenariosetaside: PLAN("keyed by (plan, scenario); a member sets a scenario aside with a reason, kept whole and readable"),
  scenariorestore: PLAN("keyed by (plan, scenario); a member restores a scenario set aside, with a reason"),
  planpause: PLAN("keyed by plan; a member pauses it with a reason, what it set running continuing"),
  planresume: PLAN("keyed by plan; a member resumes a paused plan with a reason"),
  /* answers (R34) */
  standingendset: "personal state, keyed (member, STQ- id): a member changes the end date of their own standing question, "
    + "seen only by them",
  /* duties (R30, R31) */
  dutyfromresponse: "duty-directed: keyed by a reply's or a report's capture and its quoted extent; a proposal stored apart "
    + "and labeled, never tracked until a member adopts it",
  dutiesarising: R("the adopted duties arising in named captures, each with its occurrences' states, and whether every one "
    + "is met"),
  /* actions (R80, R87, R88, R92) */
  openitemswith: R("the open actions the viewer may see addressed to the same office, with their overdue replies, as facts "
    + "and never a block"),
  /* action-holds (R11, R12) */
  pressurerecord: word("act.pressurerecord.does"),
  /* following (R22–R25) */
  followend: WATCH("keyed by follow; its author, or the once-only question's answer, sets or removes its end date"),
  watchlink: WATCH("keyed by (plan, watch); a member records that the plan set the watch running, append-only"),
  watchanswer: WATCH("keyed by a watch's link to a plan; one recipient answers the once-only question, keep or stop"),
  watchquestions: R("the once-only questions due on watches a plan set running, each with its recipients"),
  /* filings (R36, R41, R42, R47) */
  filingsecondapprove: "filing-directed: keyed by filing id; a member other than the approver records the second "
    + "approval a project's setting asks, at most once; moves no bundle",
  jointsignatory: "filing-directed: keyed by (filing, partner organisation); a member records that the partner approved "
    + "the same text by its own act; no shared plan is made; moves no bundle",
  templatesforaction: R("the file templates offered for one action's kind at its governing tier, after the act is chosen, "
    + "never a suggestion of what to do"),
  /* case-check (R1, R2) */
  publishcheck: "case-directed: keyed by a case edition, reached from the publication ceremony; runs every check "
    + "publication makes and holds the case unsigned, with no limit; publishes nothing until a member signs",
  casecheck: R("one check of a case edition and whether it still stands — held, void with why, published, none or "
    + "undetermined"),
  /* project-roster (R21, R24) */
  projectscopeset: "setting: a project's scope (a counsel matter, a member's own hidden project, or none), a participant's "
    + "act with a reason, appended; moves no bundle",
  projectapprovalset: "setting: which acts of a project need a second member's approval before sending, an owner's act "
    + "with a reason, appended; names no member; moves no bundle",
  /* action-replies (R1, R2) */
  /* reading-guides (R13) */
  procedureguides: R("the procedure guides for a kind of action and their items, with each guide's origin"),
  /* consequences (R17, R20–R22) */
  successrecord: SUCCESS("keyed by a new SUC- id in a project; a member's statement of what changed and when, on evidence"),
  successrevise: SUCCESS("keyed by success record; a successor with its reason, the earlier kept and linked"),
  successread: R("one success record with its figures, sequence, cause, supersessions and carries"),
  successrecords: R("the live success records of a project or a matter the viewer may see"),
  outcomecarry: "case-directed: keyed by a published case and the outcome carried; a member carries a success, a harm "
    + "addressed or a cure into its next edition through the case's own service, never its cause; moves no bundle",
  /* plan-work (R1, R3–R8, R11, R13) */
  matteroutcomeset: PLAN("keyed by (plan, matter); the group's intended outcome, each revision kept"),
  matters: R("a plan's matters, each with its intended outcome and its state, never a percentage or score"),
  plantimeline: R("every act the group did on a plan's actions and every coming date, in date order"),
  planreviewrhythm: "personal state, keyed (member, plan): a member's own repeating reminder to review a plan",
  planreviewopen: R("what changed on a plan since its last review entry: responses recorded, dates passed, marks"),
  planreviewrecord: PLAN("keyed by plan; a dated review entry, what the members decided"),
  planreviews: R("a plan's review entries, oldest first, and the reader's own review rhythm"),
  prepitemadd: PLAN("keyed by (plan, option); a member adds a preparation item"),
  prepitemtakeup: "personal state, keyed (member, plan, item): a member takes a preparation item up herself; nobody "
    + "assigns anybody",
  prepitemdone: PLAN("keyed by (plan, item); a member marks a preparation item done, once"),
  prepitems: R("a plan's preparation items with their take-ups and whether each is done"),
  plancomment: PLAN("keyed by (plan, option, action or draft); a member's comment under the plan's sight"),
  plancomments: R("a plan's comments under its sight, never published"),
  whereitstands: R("where a plan stands: its waits, next dates, holds, overrides, declines, set-asides, escalations and "
    + "watches"),
  statusreportdraft: "draft: answers a sourced list assembled by the system from where a plan stands, each item naming "
    + "its source and labeled machine work; writes nothing of the record; the member's words only by her own act of "
    + "keeping a report",
  statusreportsave: PLAN("keyed by plan; a member keeps her status report, never required"),
  statusreports: R("a plan's kept status reports, never published"),
  matterpromiseduties: R("the adopted promise-duties of a matter's replies, and whether every one is met"),
  /* action-clocks (R18) */
  /* conformance (R36, R37) */
  curelink: "determination-directed: keyed by (determination, standard, curing determination); a member links the curing "
    + "act, append-only; moves no bundle",
  cureunlink: "cure-directed: keyed by a cure link; a member ends it with a reason, the link kept; moves no bundle",
  cures: R("each standard's standing cure link of a determination, and the ended ones apart with their reasons"),
  /* instance-setup (R77; B6, K2896) */
  declaredstakeset: "setting: the group's declared stake in its own words, carried beside its public identity on what it "
    + "sends or publishes from then; an administrator's act, every earlier value kept; moves no bundle",
  /* local-facts (R10–R13) */
  ruledraft: word("local-facts.declared.ruledraft"),
  ruleconfirm: word("local-facts.declared.ruleconfirm"),
  rulewithdraw: word("local-facts.declared.rulewithdraw"),
  ruleoffer: R("a confirmed group rule's entry and primary source as canonical bytes with their digest, for a member to "
    + "carry to the shared profile's maintainers; transmits nothing"),
  /* (T46; K2881) the five ops op-declarations declared under R49 after this module's T45 merge, graded on R32's rule:
     local-facts R12's read, case-account R13's check and its list, and agent-worker R76's two record drafts */
  grouprules: R("the group's rules with their state, source, drafter, confirmer and dates, to a viewer naming a member"),
  advocacycheck: "project-directed: keyed by the member's own hidden project; her own text checked against the record "
    + "sentence by sentence, kept there and never a mark, never evidence; moves no bundle",
  advocacychecks: R("a member's kept text checks in her own hidden project, newest first, to a viewer with full sight of "
    + "it"),
  infractiondraft: "draft: answers a documented account of an infraction for one audience, drafted by the assistant from "
    + "what the member may see of the matter, each point with its source, labeled machine work; writes nothing of the "
    + "record; the member's words only by her own act",
  bearingdraft: "draft: answers the assistant's proposed bearing of each claim of an action on a reply, each with its "
    + "quote, labeled machine work; writes nothing of the record; a bearing only by a member's own act",
};
