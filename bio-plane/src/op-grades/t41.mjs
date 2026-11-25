/* op-grades — R29 (N797, N799; DEC-184, DEC-186; K2394) and R30 (T41; N820, N812; K2484, K2569, K2570): THE HANDLE OPS
 * (`op-declarations` R42) AND EVERY OP `op-declarations` R41, R43 AND R45 DECLARES, with `actionseekspropose` (`actions`
 * R73), graded by R5 and R3 with `affordances` R12's totality holding over them, each grade read from its owner's
 * requirements as R13, R17 and R22–R28 do: `credentials`' project accounts and uses, `ai-use`'s limits and exploring,
 * `steps`, `investigation`, `hypotheses`' proposals and shares, `reading-guides`, `question-explorer`'s finds,
 * `run-productions`' acceptance and bearing notes, `case-account`'s account drafts, `review`'s approvals, `ai-runs`'
 * group tests, `capture`'s upload and `membership`'s handle. Data only: no op's behaviour is decided here (P6).
 *
 * `./index.mjs` spreads the three tables into `RUNGS`, `RUNG_ABSENT` and `NON_ACTS`. This file imports only `word` from `setup-words`, so the
 * spread closes no cycle. None of these ops is in `MACHINE_REFUSALS`, which holds only `affordances`' `ACTS` (R5,
 * `affordances` R20): each owner refuses a machine itself (`membership` R129 refuses every caller `HANDLE_FIXED`; T46, R34). By R18
 * only `projectkeyset`, `projectsigninset` and `projectaccountremove` (ground `credential`) answer `phone: false`. No
 * consequence statement, vocabulary or prompt is added. (DEC-188 (8)) `aiceilingset` and `aicopyceilingset` (retired to
 * `ailimitset`) and `accountswitchset` and `groupswitchset` (retired to `accountusesset`) left `./t33.mjs` and
 * `./t34.mjs`, as `assistantset` left them (R25). */

import { word } from "../setup-words/index.mjs";

/* the sentence an owner declared, a code-held word the design has not taken into its list: its id is composed, as the words check judges a literal one */
const declared = (module, op) => word(`${module}.declared.${op}`);

const R = (s) => `read: ${s}; writes nothing`;
const STEP = (s) => `step-directed: ${s}; never evidence and writes no leg; moves no bundle`;
const PROJECT_ACCOUNT = (s) => `credential governance: ${s}; the subject is who pays for the assistant, not a bundle`;
const ACCOUNT_SETTING = (s) => `the account's configuration: ${s}; moves no document, claim or grade`;
const MILESTONE = (s) => `milestone-directed: ${s}; the group's own date, never a duty or finding, never published; `
  + "moves no bundle";
const WORKING = (s) => `project-directed: ${s}; working material, never published and never evidence; moves no bundle`;
const GUIDE = (s) => `guide-directed: ${s}; a reading guide carries no conduct and loosens no rule; moves no bundle`;

/* ---- the rungs (`affordances` R19's backing beside each) ---- */
export const T41_RUNGS = {
  /* reasoned: each owner refuses the act without the member's authored reason, in its own word for it */
  projectaikeepaway:   "reasoned",   // AI_KEEP_AWAY_NO_REASON (credentials R57: R51's reason rule, for a project)
  milestoneremove:     "reasoned",   // INVESTIGATION_NO_REASON (investigation R1: removed with its reason, history kept)
  milestoneitemremove: "reasoned",   // INVESTIGATION_NO_REASON (investigation R1: `reason` required)
  projectclosewithgaps: "reasoned",  // CLOSE_BAD_REASON (investigation R18: the project's closed_reason, intent R29)
  hypothesissetaside:  "reasoned",   // PROPOSAL_NO_REASON (hypotheses R18: a proposal set aside with the member's reason)
  guidereview:         "reasoned",   // GUIDE_REASON_MISSING (reading-guides R3: approve or refuse, with the reason)
  guideretire:         "reasoned",   // GUIDE_REASON_MISSING (reading-guides R7)
  stepaccept:          "reasoned",   // STEP_BAD_TEXT (steps R24: `own_instead` sets the proposal aside with her reason; triage's shape)
  /* reversible: a published act of the owner's takes the result back, and none asks a reason (R3) */
  stepcreate:          "reversible", // steps R5, R6: set aside, or deleted while untouched
  stepstart:           "reversible", // steps R5: stepend ends it, and a further stepstart reopens an ended step
  stepend:             "reversible", // steps R5: stepstart reopens it, recorded
  stepwait:            "reversible", // steps R11: stepwaitremove takes it back
  stepwaitremove:      "reversible", // steps R11: a further stepwait puts it back
  stepcostadd:         "reversible", // steps R13: stepcostremove takes it back, recorded
  stepcostremove:      "reversible", // steps R13: a further stepcostadd puts it back
  questionfollow:      "reversible", // steps R16: a further questionfollow with the other `on` takes it back
  stepsrunai:          "reversible", // ai-runs R74: each step it starts is set aside or ended by steps R5
  milestoneset:        "reversible", // investigation R1: revised or removed, with history
  milestonerevise:     "reversible", // investigation R1: a further revision replaces it, with history
  hypothesistakeup:    "reversible", // hypotheses R17: held by R1 as hers, withdrawn by hypothesiswithdraw
  noteshare:           "reversible", // hypotheses R20: noteunshare takes it back
  noteunshare:         "reversible", // hypotheses R19: a further noteshare shares the note again
  approvalruleset:     "reversible", // review R30: a further set replaces it (`null` turns it off), each appended
  actionseekspropose:  "reversible", // actions R73: a proposal restated by the same proposer, as actionlawspropose
  stepoutcome:         "reversible", // steps R5: a member revises an outcome later, each change kept
  stepbywhen:          "reversible", // steps R12: a further stepbywhen sets the date again
  /* (K2583) reading-guides R12, as extractpropose (DEC-88): a run's labelled draft, stored apart; never a guide until a
     member's guidedraft names it */
  guidepropose:        "reversible", // a member's guidedraft adopts it or a further proposal supersedes it
};

/* ---- the stated absences ---- */
export const T41_RUNG_ABSENT = {
  /* R29, as setpassword (R27); (T46) R34: membership R129 (DEC-197) refuses every change, so the sentence states it */
  handlechange:        { ground: "caller-owned", is: "a member's own handle, fixed at joining: the act stays declared and refuses every change HANDLE_FIXED, whoever asks, writing nothing (membership R129)" },
  /* credentials R54, as groupkeyset and accountreferenceremove: who pays for a project's assistant */
  projectkeyset:       { ground: "credential", is: "an owner holds an Anthropic API key as the project's one account, replacing any earlier, never answered (credentials R54)" },
  projectsigninset:    { ground: "credential", is: "an owner who is the project's sole participant makes their own subscription sign-in the project's account (credentials R54)" },
  projectaccountremove: { ground: "credential", is: "an owner removes the project's account, a key or a sign-in, recorded with who and when (credentials R54, R61)" },
  /* credentials R54, R55 and ai-use R2, R9, as groupkeyswitch: an account's settings beneath the record */
  projectaccountswitch: { ground: "substrate", is: "an owner switches the project's account on or off; it moves no document, claim or grade (credentials R54)" },
  accountusesset:      { ground: "substrate", is: "an account's owner sets one of its uses' switches (`explore` no, ask or yes); it moves no document, claim or grade (credentials R55)" },
  ailimitset:          { ground: "substrate", is: "an account's owner sets, changes or removes a limit on its assistant use by scope, unit and period; it moves no document, claim or grade (ai-use R2)" },
  exploreapprove:      { ground: "substrate", is: "an account's owner approves exploring for one day on that account; silence means no, and it moves no document, claim or grade (ai-use R9)" },
  /* the caller's own attention, as reminderset and groupkeynoticeseen */
  projectkeynoticeseen: { ground: "caller-owned", is: "records that a member saw the notice that a project's account pays for their acts there, for that member alone (credentials R58)" },
  stepreminder:        { ground: "caller-owned", is: "a member asks to be reminded of a step on a day, answered to her alone (steps R12)" },
  milestonereminder:   { ground: "caller-owned", is: "a member asks to be reminded of a milestone on a day, answered to her alone (investigation R3)" },
  findmute:            { ground: "caller-owned", is: "a follower outside every drawing project mutes one find on a question, a preference about her own feed (question-explorer R6, as queuemute)" },
  /* run-productions R15, extractpropose's door: the run spends its own pages bound reading what the record holds */
  readpages:           { ground: "observational", is: "a run reads a few pages of a document the record holds within its reading bound, spending that bound; it decides nothing (run-productions R15, question-explorer R13)" },
  /* on R3's rule: none asks an authored reason, and no published act takes it back */
  stepdelete:          { ground: "undetermined", is: "deletes an untouched step outright, or one question's reference to it; a deletion leaves no row (steps R6; Bob's D28 A)" },
  steprefer:           { ground: "undetermined", is: "adds a question's reference to an existing step, so what it produces serves that question too (steps R7)" },
  stepproduct:         { ground: "undetermined", is: "ties a record the member may see to a step as what it produced (steps R9)" },
  costmessage:         { ground: "undetermined", is: "an owner of a project sharing a step's cost relays words once to the owners of each other sharing project; no split or payment recorded (steps R15)" },
  findaccept:          { ground: "undetermined", is: "a member accepts a system find into the evidence by one act, as found, edited or her own instead (question-explorer R6, record-grammar R52)" },
  reportkeep:          { ground: "undetermined", is: "a joined participant keeps a status report as she edited it, dated with its author and never edited after; a later report may correct it (investigation R7)" },
  interviewkeep:       { ground: "undetermined", is: "a joined participant keeps her checked intake answers as narrative, a project-placed step's product, never evidence (investigation R12)" },
  narrativeclaim:      { ground: "undetermined", is: "records a claim in a member's narrative about what a public body said or did, as recalled until a record is found (investigation R14)" },
  claimfindstep:       { ground: "undetermined", is: "creates a find-the-record step linked to a narrative claim (investigation R14)" },
  claimfound:          { ground: "undetermined", is: "marks a narrative claim found, naming the record tied to its find step (investigation R15)" },
  planaccept:          { ground: "undetermined", is: "a member accepts a proposed question or step, the one act by which it becomes one (investigation R20)" },
  projectwatch:        { ground: "undetermined", is: "a project's members choose to keep watching the sources its objective names and reopen the work when something arrives (investigation R18)" },
  proposalaccept:      { ground: "undetermined", is: "a member accepts a proposed passage or connection, as proposed, edited or her own instead, so a leg may cite it as hers (run-productions R22)" },
  bearingnote:         { ground: "undetermined", is: "stores a note on what a document says about a question, each sentence tied byte-exact to a quote; shown beside the source, never evidence (run-productions R23)" },
  guidedraft:          { ground: "undetermined", is: "a member drafts a reading guide for a document kind, usable by its author at once (reading-guides R2)" },
  guideoffer:          { ground: "undetermined", is: "a member offers a guide's canonical bytes and digest, labeled with the group, for another group (reading-guides R6)" },
  guideadopt:          { ground: "undetermined", is: "a member imports another group's offered guide as adopted, usable only after review (reading-guides R6)" },
  /* (K2583) as guideoffer */
  guideproposetocivicsmith: { ground: "undetermined", is: "a member exports a guide many groups use, marked as a proposal for Civicsmith's library; Civicsmith's adoption is a release's (reading-guides R6)" },
  accountpropose:      { ground: "undetermined", is: "stores the system's draft of a case's account or its check flags, labeled machine work; the published account is a member's (case-account R1, R2)" },
  caseapprove:         { ground: "undetermined", is: "a named approver approves one case edition's document by its digest, an optional reason kept; a later document needs a new approval (review R31)" },
  grouptestset:        { ground: "undetermined", is: "a member adds a group's own test investigation for an assistant part, its answers written by people; it never opens or closes a gate (ai-runs R75)" },
  captureupload:       { ground: "undetermined", is: "a member uploads bytes as a capture in her own name, with its receipt (capture R86)" },
  steplearn:           { ground: "undetermined", is: "the doer or a member writes what a step taught in her own words, revisable by its writer with history (steps R10)" },
};

/* ---- every op's NON_ACTS reason (R5) ---- */
export const T41_NON_ACTS = {
  /* R29, as R34 amends it (T46; N934; DEC-197; membership R129) */
  handlechange: "member-directed: a handle is fixed at joining; this act refuses every change, `HANDLE_FIXED`, and "
    + "writes nothing",
  handlecheck: "read: whether a handle is free, taken or not allowed, never who holds it",
  /* credentials (R41) */
  projectkeyset: PROJECT_ACCOUNT("an owner holds the project's API key, never answered"),
  projectsigninset: PROJECT_ACCOUNT("the sole participant's own sign-in made the project's account"),
  projectaccountremove: PROJECT_ACCOUNT("an owner removes the project's account"),
  projectaccountswitch: ACCOUNT_SETTING("whether the project's account is on; an owner's"),
  projectaccountstate: R("a project's account to its owners — held, kind, on, uses and whether it serves — never a key"),
  projectkeynotice: R("the notice of a project's account for the session's own member"),
  projectkeynoticeseen: "personal state, keyed (member, project): the notice of the project's account seen by them",
  projectaikeepaway: "setting: whether a project keeps its material away from the assistant, an owner's act with a "
    + "reason; moves no bundle",
  projectaikeepawaystate: R("whether a project keeps its material away from the assistant, with the reason, who set it "
    + "and when"),
  accountusesset: declared("ai-accounts", "accountusesset"),
  accountuses: R("one account's uses and keep-aways, to that account's owners, never a key"),
  accounthistory: R("every change to one account's settings with who and when, to its owners, never a key"),
  /* ai-use (R41) */
  ailimitset: ACCOUNT_SETTING("a limit on one account's assistant use, set by its owner"),
  ailimits: R("each limit set on one account with its use this period and its history, to that account's owners, "
    + "naming no member"),
  exploreapprove: ACCOUNT_SETTING("an owner's approval of one day's exploring on that account"),
  aiestimate: R("the range an assistant act or exploring run is expected to cost, or not known yet, to the paying "
    + "account's owners"),
  aiactual: R("what a closed assistant run cost, to the paying account's owners"),
  /* steps (R43) */
  stepcreate: STEP("keyed by a new STP- id at its place, a question, a project or the group"),
  stepstart: STEP("keyed by step; starts or reopens it, recorded"),
  stepend: STEP("keyed by step; ends it or sets it aside, with its outcomes"),
  stepoutcome: STEP("keyed by (step, question); a member's outcome, each change kept with who and when"),
  stepdelete: STEP("keyed by step, or (step, question) for one reference; deletes an untouched step outright"),
  steprefer: STEP("keyed by (step, question); adds a question's reference to an existing step"),
  stepproduct: STEP("keyed by (step, record); ties what the step produced"),
  steplearn: STEP("keyed by step; what it taught in its writer's own words, with history"),
  stepbywhen: STEP("keyed by step; the date it is due by, with its basis"),
  stepwait: STEP("keyed by step; what it waits on, a step, an arrival or a date"),
  stepwaitremove: STEP("keyed by (step, wait); removes a wait"),
  stepreminder: "personal state, keyed (member, step): a member's own reminder of a step on a day, answered to her alone",
  stepcostadd: STEP("keyed by step; a fee or purchase in the group's own money, never a money fact"),
  stepcostremove: STEP("keyed by (step, cost); its writer removes a cost, recorded"),
  costmessage: "cost-directed: keyed by a costed step, reached from its cost share; relays an owner's words once to the "
    + "other sharing projects' owners, naming no project unless written in; moves no bundle",
  questionfollow: "personal state, keyed (member, question): a member's own choice to follow a question or stop, answered "
    + "to her alone and never counted",
  stepaccept: STEP("keyed by a proposed step; a member's accepting act, as proposed, edited or her own instead"),
  stepsrunai: STEP("keyed by a project's questions; several assistant steps started at once, each a system step"),
  stepslike: R("the steps the viewer may see whose work matches, open and ended alike, at most 50"),
  steps: R("one step, or the steps on a question, in a project or of the group, as the viewer may see them"),
  stepproposals: R("the proposed steps the viewer may accept, each labeled the system's"),
  costmessages: R("the cost messages relayed to the viewer"),
  questionfollowstate: R("whether the viewer follows a question"),
  stepproducts: R("a step's products and looks the viewer may see, the rest left out uncounted"),
  recordsteps: R("the steps that produced a record and their questions, as the viewer may see them"),
  /* question-explorer (R43) */
  findaccept: "find-directed: keyed by (find, question), reached from the find; a member accepts it into the evidence by "
    + "one act, as found, edited or her own instead; the system writes no leg",
  findmute: "personal state, keyed (member, find, question): a follower's mute of one find, a preference about her own "
    + "feed (D-125)",
  finddoors: R("the member's doors on one find, or absent"),
  /* investigation (R43) */
  milestoneset: MILESTONE("keyed by a project, reached from the project; a joined participant sets a dated milestone"),
  milestonerevise: MILESTONE("keyed by milestone; revised with history"),
  milestoneremove: MILESTONE("keyed by milestone; removed with its reason, history kept"),
  milestoneitemremove: MILESTONE("keyed by (milestone, item); an item removed with its reason, history kept"),
  milestonereminder: "personal state, keyed (member, milestone): a member's own reminder of a milestone on a day, answered "
    + "to her alone",
  milestones: R("a project's milestones, each with its items' states, to its participants"),
  reportdraft: R("a status report composed by code from the record since the last kept, each line citing its source; "
    + "no AI"),
  reportkeep: WORKING("keyed by a project (and a question), reached from its report draft; kept as its author kept it, "
    + "never edited after"),
  reports: R("a project's kept status reports, to its participants"),
  interviewkeep: WORKING("keyed by a project, reached from its intake interview; the member's checked answers kept as her "
    + "own narrative"),
  interview: R("a project's kept intake interviews, each labeled the member's own account"),
  interviewform: R("the intake interview's six questions as one page"),
  narrativeclaim: WORKING("keyed by a project and a quoted span of a member's narrative; a claim as recalled, never what "
    + "the body said until found"),
  claimfindstep: WORKING("keyed by a narrative claim; creates its find-the-record step"),
  claimfound: WORKING("keyed by (claim, record); marks the claim found, naming the record"),
  claims: R("a project's narrative claims, each as recalled or found, with its look"),
  planaccept: "proposal-directed: keyed by a planning proposal; a member's one accepting act, a question by her own "
    + "promotion or a step by steps' acceptance",
  investigationproposals: R("the planning proposals a member may accept, each labeled the system's"),
  projectwatch: WORKING("keyed by a quiet project, reached from its prompt; keeps watching its sources and reopens the "
    + "work when something arrives"),
  projectclosewithgaps: "project-directed: keyed by a quiet project, reached from its prompt; closes it with its reason, "
    + "the gaps read at the act kept as what remains unknown; moves no bundle",
  projectstanding: R("a project's page: its objective, progress, questions with their legs grouped by bearing, and gaps; "
    + "no score and no member's share"),
  quietstate: R("whether a project's work is quiet; a display, never a stage"),
  /* hypotheses (R43) */
  hypothesistakeup: "proposal-directed: keyed by a proposed hypothesis; a member holds it as hers, noting it came from "
    + "the system",
  hypothesissetaside: "proposal-directed: keyed by a proposed hypothesis; a member sets it aside with her reason, kept",
  noteshare: "note-directed: keyed by (note, project); the author shares her note's words with a project she has joined, "
    + "labeled hers and as narrative; never evidence; moves no bundle",
  noteunshare: "share-directed: keyed by share; its author withdraws it, its words leaving every answer and the dates "
    + "kept; moves no bundle",
  shares: R("a project's standing shared notes, newest first, to its participants"),
  /* inquiry, leg-earning (R43) */
  questionwaits: R("every dated wait on a question, the project it was set in only when not hidden"),
  projectsshownon: R("the projects drawing on a question that are not hidden, never counting a hidden one"),
  /* run-productions (R43) */
  proposalaccept: "proposal-directed: keyed by a proposed passage or connection; a member's one accepting act, as "
    + "proposed, edited or her own instead",
  bearingnote: "capture-question-directed: keyed by (capture, question); a note on what a document says and does not, "
    + "each sentence tied to a quote; shown beside the source, never evidence or a leg target",
  bearingnotes: R("the bearing notes beside a source, for a question"),
  acceptancecounts: R("how many proposals were accepted in each form, group-wide only, naming no member, project or "
    + "proposal"),
  readpages: "run-directed: a run reads a few pages of a held document within its reading bound, keyed by (run, "
    + "document); the run is the subject and no bundle state offers it",
  /* reading-guides (R43) */
  guidedraft: GUIDE("keyed by a document kind; a member's draft, usable by its author at once"),
  guidereview: GUIDE("keyed by guide; another member approves it for the group or refuses it, with the reason"),
  guideoffer: GUIDE("keyed by guide; its canonical bytes offered to another group"),
  guideadopt: GUIDE("keyed by an offer's digest; another group's guide imported as adopted, usable after review"),
  guideretire: GUIDE("keyed by guide; retired with the reason, still readable"),
  guides: R("the reading guides the viewer may see, at most 200"),
  /* (K2583) */
  guidepropose: "run-directed: a run's draft of a reading guide, keyed by (run, document kind); stored apart and labeled "
    + "machine work, never a guide until a member drafts from it",
  guideproposetocivicsmith: GUIDE("keyed by guide; exported marked as a proposal for Civicsmith's library"),
  guidefor: R("the reading guide in force for a document kind, the viewer's own, the group's or Civicsmith's, with its "
    + "origin"),
  guide: R("one reading guide the viewer may see, with its items, state and history"),
  guideproposals: R("the machine drafts of reading guides, each labeled the system's"),
  /* case-account (T42; N839), review (R43) */
  accountpropose: "case-directed: keyed by a case, reached from its account; the system's draft of the account, labeled "
    + "machine work, never the published account until a member writes it",
  accountdrafts: R("a case's drafts of its account, each labeled machine work"),
  approvalruleset: "setting: the members whose approval a case needs before it is signed, or none; an administrator's "
    + "act, appended; moves no bundle",
  caseapprove: "case-directed: keyed by a case edition and its document's digest, reached from the case; a named "
    + "approver's approval; moves no bundle",
  reviewcomments: R("a case's review comments, for the publisher's choice of what travels"),
  /* ai-runs (R43) */
  grouptestset: "test-directed: keyed by an assistant part and a matter; a group's own test investigation, never a find, "
    + "evidence or report, and never a gate",
  grouptestresults: R("an assistant part's results on the group's own tests, with its false-alarm rate, to its members"),
  /* actions (actions R73), as actionlawspropose */
  actionseekspropose: "action-directed: a machine (or a member) proposes what an action seeks, keyed by (action, "
    + "proposer); labeled machine work and never the action's own",
  /* capture (R45) */
  captureupload: "upload-directed: a member's bytes held as a capture under their digest, in her own name, with "
    + "its receipt; reached from the upload, never beside a bundle",
};
