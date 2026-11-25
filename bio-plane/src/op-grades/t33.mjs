/* op-grades — R13 (was `affordances` R40; C:A-16; B1a.16; K1522): THE OPS T33'S NEW MODULES PUBLISH, AND THE OPS T33
 * ADDS TO EARLIER ONES, graded by R5 and R3 with `affordances` R12's totality holding over them. Data only: no op's
 * behaviour is decided here (P6).
 *
 * Each writing op has a rung (`T33_RUNGS`) or one ground of `RUNG_ABSENCE_GROUNDS` (`T33_RUNG_ABSENT`), on R3's rule:
 * `reasoned` where the owner refuses the act without the member's authored account (the code beside it, each in
 * `JUSTIFICATION_REFUSALS`, `affordances` R19), `reversible` where a published act of the owner's takes the result back,
 * and `undetermined` where neither holds; the other grounds where the act is no act on the record (a setting beneath it,
 * a measurement, a member's own attention). Every op, read or write, carries its `NON_ACTS` reason (`T33_NON_ACTS`),
 * since `op-declarations` R17–R20 gives each a `NEEDS` row (`contribute` for a write, `null` for a read): none is an act
 * on a bundle's state that `affordanceFacts` describes, so none is an `ACTS` row and `MACHINE_REFUSALS` gains nothing
 * (R5, `affordances` R20: it holds only `ACTS`); each owner refuses a machine by its own code where it does.
 *
 * `./index.mjs` spreads these three tables into `RUNGS`, `RUNG_ABSENT` and `NON_ACTS`; this file imports nothing, so the
 * spread closes no cycle. Grouped by owner, in `modules.json` order. */

import { localize } from "../setup-words/index.mjs";

const R = (s) => `read: ${s}; writes nothing`;

/* ---- the rungs, each with the backing it names (`affordances` R19) ---- */
export const T33_RUNGS = {
  /* events (R13, R14, R17, R20) */
  eventgovern:           "reversible", // a further eventgovern chooses another attestation; every choice is kept
  participantcorrect:    "reasoned",   // NO_REASON (events R13: a correction says why the participant was wrong)
  eventmerge:            "reasoned",   // NO_REASON (events R14: a merge says why the two are one happening)
  eventsplit:            "reasoned",   // NO_REASON (events R14: a split says why one record held two)
  eventrelate:           "reversible", // eventrelationwithdraw takes it back
  eventrelationwithdraw: "reasoned",   // NO_REASON (events R20)
  /* lines (R1, R8) */
  linerecord:            "reversible", // linewithdraw takes it back (a correction is a withdrawal and a new line)
  linewithdraw:          "reasoned",   // NO_REASON (lines R8)
  /* money (R1, R7, R12) */
  moneyrecord:           "reversible", // moneywithdraw takes it back
  moneywithdraw:         "reasoned",   // NO_REASON (money R7)
  moneysetinclude:       "reasoned",   // NO_REASON (money R12: a member's act, with why; the latest governs)
  moneysetexclude:       "reasoned",   // NO_REASON (money R12)
  /* money-checks (R5) */
  moneydetectorswitch:   "reversible", // a further switch turns it back; the latest governs
  /* duties (R3, R6, R12, R13) */
  dutyadopt:             "reversible", // dutywithdraw takes it back
  dutydeclare:           "reversible", // dutywithdraw takes it back
  dutyrevise:            "reasoned",   // DUTY_NO_REASON (duties R6: a new version with its reason)
  dutywithdraw:          "reasoned",   // DUTY_NO_REASON (duties R6)
  dutymatch:             "reasoned",   // DUTY_NO_REASON (duties R12: an event meets an occurrence, with why)
  dutytransition:        "reasoned",   // NO_CAUSE (duties R13: a member's statement of an occurrence's state names its cause)
  /* people (R1, R4, R9, R11, R12, R20, R21, R22) */
  identityclaim:         "reasoned",   // NO_NOTE (people R1: every claim carries the member's note); NO_EVIDENCE beside it
  identitywithdraw:      "reasoned",   // NO_REASON (people R4)
  personfact:            "reversible", // personfactwithdraw takes it back
  personfactwithdraw:    "reasoned",   // NO_REASON (people R11)
  personexpunge:         "reasoned",   // NO_REASON (people R12: an administrator, on a listed ground, with a reason)
  membertie:             "reversible", // R47 (T50; DEC-300 (5)): membertiewithdraw takes it back (R3); its note is people R20's shape, not a reason (was `reasoned`, NO_NOTE)
  membertiewithdraw:     "reasoned",   // NO_REASON (people R20)
  sourcepersonlink:      "reasoned",   // NO_EVIDENCE (people R21: a member's evidenced account of who a source is, as sourcelink)
  interestcheckswitch:   "reversible", // a further switch turns it back; the latest governs
  /* hypotheses (R1, R2) */
  hypothesishold:        "reversible", // hypothesiswithdraw takes it back
  hypothesisrevise:      "reasoned",   // HYPOTHESIS_NO_REASON (hypotheses R2)
  hypothesiswithdraw:    "reasoned",   // HYPOTHESIS_NO_REASON (hypotheses R2)
  /* calculations (R14, R23) */
  moneyingest:           "reasoned",   // NO_REASON (calculations R14: every row of a binding at once asks why; named rows ask none, `triage`'s shape)
  patternswitch:         "reversible", // a further switch turns it back; the latest governs
  /* workbooks (R3, R9, R10) */
  workbookbind:          "reversible", // workbookunbind takes it back
  workbookunbind:        "reasoned",   // NO_REASON (workbooks R3)
  workbooklintexplain:   "reasoned",   // NO_NOTE (workbooks R9: a member's note against one finding)
  workbookmethodnote:    "reasoned",   // NO_PURPOSE (workbooks R10: the method's purpose, sources, steps and limits are its account)
  /* following (R1, R4, R7, R9, R10) */
  followbody:            "reversible", // unfollow takes it back
  followregister:        "reversible", // unfollow takes it back
  followpersonquery:     "reversible", // unfollow takes it back
  followportal:          "reversible", // unfollow takes it back
  unfollow:              "reversible", // a further follow puts one back
  permeetingbody:        "reversible", // a further permeetingbody replaces it; the earlier kept
  /* T33's ops in earlier modules: standards (R23, R26, R27) */
  lawrelate:             "reasoned",   // STANDARD_NO_REASON (standards R23: a relation between two laws says why)
  lawwithdraw:           "reasoned",   // STANDARD_NO_REASON (standards R23, R26, R27)
  courtlink:             "reasoned",   // STANDARD_NO_REASON (standards R26)
  courttreat:            "reasoned",   // STANDARD_NO_REASON (standards R27)
  /* entities (R43) */
  entityidentify:        "reasoned",   // NO_BASIS (entities R43: an identifier is held with its stated basis)
  /* action-clocks (R2): a proposal per rule and proposer, restated by the same proposer, as actionlawspropose */
  clockpropose:          "reversible", // a further proposal by the same proposer restates it
  /* run-rules R19 (K1606), ai-runs' op */
  airunverify:           "reasoned",   // AI_RUN_VERIFICATION_UNFIT (the verifying member's evidence of what they checked)
  /* capture-requests (R46): a host marked a platform, and the mark withdrawn */
  capturerequestplatformmark:   "reversible", // capturerequestplatformunmark takes it back
  capturerequestplatformunmark: "reversible", // a further mark puts it back
};

/* ---- the stated absences ---- */
export const T33_RUNG_ABSENT = {
  /* events */
  datedfact:            { ground: "observational", is: "holds a document's own stated date, as read from one extent of a capture, with how it was read; the earlier reading stays true of the moment it was made (events R1, R2)" },
  editacts:             { ground: "observational", is: "holds what an office file states about itself — its created and modified values — as dated facts, never a finding (events R5)" },
  readoptin:            { ground: "substrate", is: "an administrator's setting of which capture classes' readings have their stated dates held after read; it moves no document, claim or grade (events R4)" },
  eventcreate:          { ground: "undetermined", is: "a member or the machine records a happening with at least one attestation, its kind, status and participants; corrected by attestation, merge, split and correction, never withdrawn (events R6)" },
  eventattest:          { ground: "undetermined", is: "adds an attestation to an event — a dated fact, a capture extent or a member's testimony; kept, never removed (events R7)" },
  participantadd:       { ground: "undetermined", is: "adds who took part in an event and in what role, as a document states it or a member testifies; corrected forward by participantcorrect (events R11)" },
  actalias:             { ground: "undetermined", is: "makes an ACT- id an alias of an event, once (events R21)" },
  eventimport:          { ground: "substrate", is: "writes the events and participants a followed body's captured register identifies by source-native ids, stamped as the machine's and correctable by a member (events R22–R25)" },
  registerimport:       { ground: "substrate", is: "writes a followed court register's rows as filing or order events of the proceeding, stamped as the machine's (events R38)" },
  /* lines */
  linecurrentthrough:   { ground: "undetermined", is: "records, with its citation, that a holds line with no stated end is current as of a day; a later statement supersedes on read, the earlier kept (lines R21)" },
  /* money */
  moneysetcreate:       { ground: "undetermined", is: "a member declares a money trail or an attribution set with its label; it holds nothing until facts are included (money R12)" },
  moneysetpropose:      { ground: "undetermined", is: "a machine or a member PROPOSES a fact for a set with its method, stored apart and labeled; included only when a member's include adopts it (money R13)" },
  moneyfundtype:        { ground: "undetermined", is: "records a fund's type from the source that states it, which sets its balance classes; a later record supersedes on read, the earlier kept (money, K1505 (10))" },
  /* money-checks */
  moneycheckparam:      { ground: "undetermined", is: "a member states a check's threshold, share or stage with its citation, for one contract or the group; the latest governs, every statement kept (money-checks R3)" },
  moneydetectordefine:  { ground: "undetermined", is: "a member defines a money detector — its population, recipe, parameters, denominator and derivation — or a new version of one; earlier versions kept (money-checks R4)" },
  moneydetectorsrun:    { ground: "substrate", is: "the detectors' own run over the held money facts, holding each raised result apart with its derivation; a computation, never a model run (money-checks R6, R7)" },
  moneydetectorgate:    { ground: "substrate", is: "records a detector version's false-alarm rate measured on a named gold set; it moves no claim, and results show only at or under the gate (money-checks R8)" },
  /* duties */
  dutypropose:          { ground: "undetermined", is: "a machine or a member PROPOSES an obligation with an optional why, stored apart and labeled; never tracked until a member adopts it (duties R2)" },
  /* people */
  interestcheckdefine:  { ground: "undetermined", is: "a member or the machine defines an interest check, or a new version of one, with its condition and denominator; earlier versions kept, and a machine's results shown only once gated (people R22)" },
  interestcheckgate:    { ground: "substrate", is: "an administrator records a check version's false-alarm rate measured on a named gold set; results show only at or under the gate (people R24)" },
  /* hypotheses (R15; hypotheses R11, R13): a member's own note, answered to its author alone, and a turn recorded on it; what a turn
     makes is its owner's act, graded there */
  notewrite:            { ground: "caller-owned", is: "a member writes a note of their own, answered to that member alone; never a record id, never cited, published or counted (hypotheses R11)" },
  noteturn:             { ground: "caller-owned", is: "the note's author records that the note became an observation, a hunch or a question their own act made (hypotheses R13)" },
  /* calculations */
  tabledeclare:         { ground: "undetermined", is: "a member declares a table from a captured source, with its schema, roles and vintage; superseded only by a later declaration naming it (calculations R1–R3)" },
  bindingadopt:         { ground: "undetermined", is: "a member adopts a table's money-role mapping, which the ingest writer reads (calculations R14)" },
  calculationcreate:    { ground: "undetermined", is: "a member records a calculation — its question, terms, period, inputs and recipe — with its results stored under their key; unchecked until accepted (calculations R4–R6)" },
  calculationaccept:    { ground: "undetermined", is: "a member accepts a calculation after a recompute that agrees, once (calculations R8)" },
  calculationdraw:      { ground: "undetermined", is: "records a seeded random draw over a frozen set — the seed, the set and the sample — so anyone can reproduce it (calculations R18)" },
  recordset:            { ground: "observational", is: "freezes the ids a saved query answered at this instant; a later freeze is another set (calculations R21)" },
  patterngate:          { ground: "substrate", is: "an administrator records a pattern version's false-alarm rate measured on a named gold set; results show only at or under the gate (calculations R23)" },
  /* workbooks */
  workbookadd:          { ground: "undetermined", is: "a member holds a captured workbook in a project with its question and period (workbooks R1)" },
  workbookrecompute:    { ground: "observational", is: "records the engine's recompute of a workbook against its cached values, or that it was not recomputed here; a later recompute is another observation (workbooks R6–R8)" },
  workbooksecondcheck:  { ground: "undetermined", is: "a second member records that they checked a workbook — agrees, disagrees or could not check — never a gate (workbooks R11)" },
  /* answers */
  answercheck:          { ground: "observational", is: "adds one to a day's unattributed count of answered, refused or withheld results by code; names no member (answers R4, R13)" },
  ruleservicesswitch:   { ground: "substrate", is: "an administrator's switch of the copy's rule services; it moves no document, claim or grade" },
  standingset:          { ground: "caller-owned", is: "a member sets their own standing question — their words, a saved query, a cadence and an end — seen only by them (answers R15)" },
  standingend:          { ground: "caller-owned", is: "a member ends their own standing question (answers R16)" },
  standingaiswitch:     { ground: "substrate", is: "an administrator's switch of the AI half of standing questions for the copy; it moves no document, claim or grade (answers R19)" },
  /* following */
  refreshregister:      { ground: "substrate", is: "captures a gated register afresh with the following member's own credential, marked not reproducible by the public; the capture is the act (following R8)" },
  /* T33's ops in earlier modules */
  lawpropose:           { ground: "undetermined", is: "a machine or a member PROPOSES a law relation, a court link or a treatment with its why, stored apart and labeled; recorded only when a member's act names it (standards R23, R26, R27)" },
  accountreferenceset:  { ground: "credential", is: "a member sets their own assistant account reference, its secret sealed and never answered (credentials R22, R23)" },
  accountreferenceremove: { ground: "credential", is: "a member removes their own assistant account reference (credentials R22, R25)" },
  aigrantmint:          { ground: "credential", is: "a member mints a short-lived, read-only ai grant under their own session, for their own account (credentials R27, R28)" },
  keyedserviceset:      { ground: "credential", is: "an administrator sets the group's sealed key for a keyed outside service, off until switched on (credentials R29)" },
  keyedserviceswitch:   { ground: "substrate", is: "an administrator switches a keyed outside service on or off for the copy; it moves no document, claim or grade (credentials R29)" },
  sourcekeyed:          { ground: "undetermined", is: "a member marks their own capture as a result from a paid or member-keyed source, naming the vendor and terms, which caps its grade; appended, never removed (sources R16–R18)" },
  waitlook:             { ground: "caller-owned", is: "the member who set a dated wait records that they looked; it moves nothing in the inquiry (inquiry R56)" },
  exportrender:         { ground: "substrate", is: "renders the rows the viewer would be carried in one open format and logs the export; the bytes are already the record's (corpus-export R10)" },
  clockadopt:           { ground: "undetermined", is: "a member adopts a standing clock proposal, as proposed or amended, as a clock entry with its basis and trace (action-clocks R13)" },
  officesseed:          { ground: "substrate", is: "an administrator seeds the offices and bodies the active profiles name as entities, with their identifiers and lines (instance-setup R50)" },
  /* `assistantset` is retired (R25; DEC-172 (5), instance-setup R53 as T36-34 supersedes it): no row here or below.
     (R30; DEC-188 (8)) `accountswitchset` (to `accountusesset`), `aiceilingset` and `aicopyceilingset` (to `ai-use`'s
     `ailimitset`) are retired too, and graded in ./t41.mjs under the ops that replace them. */
  /* B3 (K1689): the ops op-declarations declares that T33's first grading did not reach */
  seatsseed:            { ground: "substrate", is: "an administrator seeds the seats of matched bodies, and their holders, from held register captures as entities and lines, each as the register records it (instance-setup R52)" },
  disclosureshown:      { ground: "caller-owned", is: "records that a member was shown the assistant's disclosure, and its version, when they connect their own account (instance-setup R54)" },
  ask:                  { ground: "caller-owned", is: "a member asks the assistant their own question under their own account; what is read to answer it is logged, and the answer stores nothing in the record (answers; K1609)" },
  askusage:             { ground: "observational", is: "counts one assistant call's usage against the member's own day, naming no question or answer (K1601)" },
};

/* ---- every op's NON_ACTS reason (R5, R13) ---- */
export const T33_NON_ACTS = {
  /* events */
  datedfact: "dated-fact-directed: keyed by (capture, extent); holds a document's own stated date and moves no bundle",
  editacts: "dated-fact-directed: keyed by capture; holds an office file's own created and modified values and moves no bundle",
  readoptin: "the instance's configuration: which capture classes' stated dates are held after read; an administrator's, not an act on an object",
  eventcreate: "event-directed: keyed by a new EVT- id; writes events' rows and moves no bundle",
  eventattest: "event-directed: keyed by event; writes events' rows and moves no bundle",
  eventgovern: "event-directed: keyed by (event, attestation); writes events' rows and moves no bundle",
  participantadd: "event-directed: keyed by (event, entity, role); writes events' rows and moves no bundle",
  participantcorrect: "event-directed: keyed by participant; keeps the corrected row beside the new one and moves no bundle",
  eventmerge: "event-directed: keyed by the two events; the absorbed one stays as an alias, and no bundle moves",
  eventsplit: "event-directed: keyed by event; moves the named attestations to a new event, and no bundle moves",
  eventrelate: "event-directed: keyed by the two events; writes a cited relation and moves no bundle",
  eventrelationwithdraw: "relation-directed: keyed by relation; keeps it, shown withdrawn, and moves no bundle",
  actalias: "event-directed: keyed by (ACT- id, event); writes an alias and moves no bundle",
  eventimport: "derivation: keyed by a followed capture; writes the events it identifies as the machine's and moves no bundle",
  registerimport: "derivation: keyed by a followed register capture; writes its rows' events as the machine's and moves no bundle",
  event: R("one event — its kind, status, when, participants, attestations and relations"),
  eventforact: R("the event an ACT- id names"),
  datedfacts: R("one capture's dated facts in extent order"),
  eventsfor: R("the events an entity took part in or that concern it, in order of when"),
  timeline: R("what they did and what we did for a set of entities or events, the two lanes apart"),
  sequence: R("whether one event came before or after another, or undetermined with why"),
  whowassent: R("who a communication, issuance or meeting was sent to, copied or present at"),
  statementsof: R("an entity's statements and communications in order"),
  proceedingstatus: R("the stage a proceeding's held events reach on a date, or undetermined with why"),
  /* lines */
  linerecord: "line-directed: keyed by a new LIN- id between two entities; writes lines' rows and moves no bundle",
  linewithdraw: "line-directed: keyed by line; keeps it, shown withdrawn, and moves no bundle",
  linecurrentthrough: "line-directed: keyed by a holds line; records a cited current-as-of day and moves no bundle",
  line: R("one line with its basis, both grades and its bounds"),
  linesof: R("the lines at one end of an entity, oldest first"),
  structureat: R("the structure lines at an entity as of a date, held or undetermined"),
  holderat: R("who held an office on a date, or undetermined naming the lines"),
  partiesof: R("a proceeding's parties and their roles"),
  proceedinglinks: R("a proceeding's appeal, consolidation, remand and origin lines, one hop"),
  /* money */
  moneyrecord: "money-directed: keyed by a new MNY- id; holds one source's reading of one amount and moves no bundle",
  moneywithdraw: "money-directed: keyed by fact; keeps it, shown withdrawn, and moves no bundle",
  moneysetcreate: "money-set-directed: keyed by a new MSR- id; writes money's rows and moves no bundle",
  moneysetinclude: "money-set-directed: keyed by (set, fact); writes money's rows and moves no bundle",
  moneysetexclude: "money-set-directed: keyed by (set, fact); writes money's rows and moves no bundle",
  moneysetpropose: "money-set-directed: keyed by (set, fact); a proposal stored apart and labeled, never an inclusion until a member includes it",
  moneyfundtype: "fund-directed: keyed by a fund entity; records its type from a cited source and moves no bundle",
  money: R("one money fact with both grades, its source, its adjustments and its withdrawal"),
  moneyof: R("the money facts an entity is a party to or that concern it, never a total"),
  moneysummable: R("whether named facts may be summed, or the first dimension that differs"),
  moneyreconcile: R("whether two money facts are consistent, or each dimension that differs"),
  moneyset: R("one money set's inclusions, exclusions and open proposals, each with its reason"),
  moneysets: localize("money.declared.moneysets", "read: the money sets that concern an id, such as a project's trails, newest first, bounded; writes nothing"),   // money R28 (fix round 3, B3)
  committedagainstpaid: R("a contract's committed and paid facts with their sums and the difference, never a verdict"),
  authoritychain: R("the chain of authorising events toward the event a fact concerns, bounded"),
  /* money-checks */
  moneycheckparam: "check-directed: keyed by (check, parameter, contract or the group); records a member's cited parameter and moves no bundle",
  moneydetectordefine: "detector-directed: keyed by detector and version; writes money-checks' rows and moves no bundle",
  moneydetectorswitch: "detector-directed: keyed by (detector, project); a member's switch, moving no bundle",
  moneydetectorsrun: "derivation: the detectors' run over held money facts, holding results apart; asserts nothing of the caller's",
  moneydetectorgate: "detector-directed: keyed by (detector, version); records a measured false-alarm rate on a gold set, an administrator's",
  moneyamountchecks: R("a contract's amount checks, each labeled Noticed with its derivation"),
  moneyjunction: R("a progression instance's junction checks, labeled Noticed"),
  moneycheckparams: R("a check's stated parameters, each marked whether it governs"),
  moneydetectors: R("the money detectors with their versions, gates and switches"),
  moneynoticed: R("a project's gated, switched-on detector results the viewer can see, labeled Noticed"),
  /* duties */
  dutypropose: "duty-directed: keyed by a new proposal; stored apart and labeled, never tracked until a member adopts it",
  dutyadopt: "duty-directed: keyed by proposal; writes a DUT- duty and moves no bundle",
  dutydeclare: "duty-directed: keyed by a new DUT- id; writes duties' rows and moves no bundle",
  dutyrevise: "duty-directed: keyed by duty; writes a new version, the earlier kept, and moves no bundle",
  dutywithdraw: "duty-directed: keyed by duty; keeps it, shown withdrawn, and moves no bundle",
  dutymatch: "occurrence-directed: keyed by (duty, occurrence); records what meets or discharges it, append-only",
  dutytransition: "occurrence-directed: keyed by (duty, occurrence, date); a member's statement of its state, append-only",
  duty: R("one duty with its versions, its adoption and whether it is in force on a date"),
  dutiesof: R("the duties an entity owes, is owed or enforces"),
  dutyoccurrences: R("a duty's occurrences as of a date, each with its due date, state and evidence"),
  dutytransitions: R("the recorded transitions of duties' occurrences in order"),
  powersof: R("the powers an office holds on a date, with their instruments"),
  dutysetagainst: R("the money facts in a duty's scope, each compared to its cited term"),
  /* people */
  identityclaim: "person-directed: keyed by a new IDC- id between two persons; a claim that links and never merges",
  identitywithdraw: "person-directed: keyed by claim; keeps it, shown withdrawn, and links nothing",
  personfact: "person-directed: keyed by a new PFA- id on a person; holds one cited fact and moves no bundle",
  personfactwithdraw: "person-directed: keyed by fact; keeps it, shown withdrawn, and moves no bundle",
  personexpunge: "person-directed: keyed by a person fact, claim, tie or source link; an administrator removes its value on a listed ground and leaves a tombstone",
  membertie: "member-directed: keyed by a new MTI- id; the member's own declared tie, seen by them and administrators only",
  membertiewithdraw: "member-directed: keyed by tie; keeps it, shown withdrawn",
  sourcepersonlink: "source-directed: keyed by (source, person); a protected link seen only by its listed members",
  interestcheckdefine: "check-directed: keyed by a CHK- id and version; writes people's rows and moves no bundle",
  interestcheckswitch: "check-directed: keyed by (check, project); a member's switch, moving no bundle",
  interestcheckgate: "check-directed: keyed by (check, version); records a measured false-alarm rate on a gold set, an administrator's",
  identity: R("a person's identity cluster as the viewer sees it, linked or undetermined"),
  samepersoncandidates: R("other persons sharing a name or an identifier, compared field by field; never a claim"),
  person: R("a person's names, life facts, posts and duties on a date"),
  career: R("every post a person held, in order"),
  personcredentials: R("a person's education and credentials"),
  personinterests: R("a person's interests and the money facts naming them, never a total"),
  personstatements: R("a person's statements and acts in order"),
  staffing: R("who held posts in an organisation on a date, beside each roster source's answer"),
  memberties: R("a member's own declared ties, to that member or an administrator only"),
  sourcepersonlinks: R("the protected links of a source or a person, to their listed members only"),
  interestchecks: R("interest checks' gated results, labeled Noticed, the viewer may see whole"),
  /* explore */
  explore: R("the paths from a node over the registered kinds as of a date, each hop cited and graded, within the bounds"),
  explorepreset: R("one preset walk — chain, flows, relations, a path between two nodes, overlaps — or the presets"),
  exploreverify: R("whether a derived connection re-derives to its id, and which hops it rests on"),
  exploretimeline: R("a timeline over a set of entities with the money facts about its events"),
  /* hypotheses */
  hypothesishold: "inquiry-directed: keyed by a new HYP- id in an inquiry; held as a hypothesis, never a fact or a leg",
  hypothesisrevise: "hypothesis-directed: keyed by hypothesis; a new statement with its reason, the history kept",
  hypothesiswithdraw: "hypothesis-directed: keyed by hypothesis; keeps it, shown withdrawn",
  hypotheses: R("one hypothesis, or an inquiry's, each labeled a hypothesis with its history"),
  /* R15: a member's own notes */
  notewrite: "note-directed: a member's own note, keyed by the note and answered to its author alone; never a record id, never cited, published or counted; moves no bundle",
  noteturn: "note-directed: a member's own note, keyed by the note and answered to its author alone; never a record id, never cited, published or counted; moves no bundle",
  notes: R("a member's own notes, to that member alone"),
  /* calculations */
  tabledeclare: "table-directed: keyed by a table's digest; writes calculations' rows and moves no bundle",
  bindingadopt: "table-directed: keyed by (table, roles); writes calculations' rows and moves no bundle",
  moneyingest: "binding-directed: keyed by (binding, rows); money facts written as the machine's at a member's request",
  moneyingestread: localize("calculations.declared.moneyingestread", "read: a money ingest's stored lists, a page at a time, with true counts and whether the ingest is complete (`calculations` R14); writes nothing"),   // G55 (K4562): a read, no rung
  calculationcreate: "calculation-directed: keyed by a new CALC- id; writes calculations' rows and moves no bundle",
  calculationaccept: "calculation-directed: keyed by calculation; a member's acceptance after an agreeing recompute",
  calculationdraw: "set-directed: keyed by (set, seed, size, method); records a reproducible draw and moves no bundle",
  recordset: "query-directed: keyed by the set's digest; freezes the ids a saved query answered",
  patterngate: "pattern-directed: keyed by (pattern, version); records a measured false-alarm rate on a gold set, an administrator's",
  patternswitch: "pattern-directed: keyed by (pattern, project); a member's switch, moving no bundle",
  table: R("one declared table — its schema, rows and grade facts"),
  tablesat: R("the vintage of a table key valid on a date, or undetermined"),
  calculationevaluate: R("what a calculation would store for a recipe and its inputs"),
  calculation: R("one stored calculation with its grade facts and recompute status, never recomputed"),
  patterns: R("each pattern's gated results, labeled Noticed, or why they are not shown"),
  /* workbooks */
  workbookadd: "workbook-directed: keyed by (capture, project); writes workbooks' rows and moves no bundle",
  workbookbind: "workbook-directed: keyed by (capture, project) and a range; writes a binding and moves no bundle",
  workbookunbind: "binding-directed: keyed by binding; keeps it, shown taken back",
  workbookrecompute: "workbook-directed: keyed by (capture, project); records the engine's recompute and moves no bundle",
  workbooklintexplain: "workbook-directed: keyed by (capture, project, finding); a member's note, kept",
  workbookmethodnote: "workbook-directed: keyed by (capture, project); the method's documentation, the latest current and every one kept",
  workbooksecondcheck: "workbook-directed: keyed by (capture, project); a second member's check, disclosed and never a gate",
  workbook: R("one workbook with its bindings, inputs, recompute, lint, notes and checks; never recomputed"),
  workbookinputs: R("a workbook's input cells, bound or unbound"),
  workbooklint: R("a workbook's lint findings with members' notes"),
  workbookexport: R("a calculation as a workbook file"),
  /* answers */
  answercheck: "tally: unattributed, keyed by (day, mode, kind, code); names no member",
  ruleservicesswitch: "the copy's configuration: whether its rule services answer; an administrator's, not an act on an object",
  standingset: "personal state, keyed (member, STQ- id): a member's own standing question, seen only by them",
  standingend: "personal state, keyed (member, STQ- id): a member ends their own standing question",
  standingaiswitch: "the copy's configuration: whether standing questions' AI half runs; an administrator's, not an act on an object",
  rule: R("one rule service's value with its basis, grade and label, or not held"),
  asktallies: R("the day counts of answered, refused and withheld results, to an administrator"),
  ruleservicesstate: localize("answers.declared.ruleservicesstate", "read: whether the rule services are switched on, so a screen draws their control only while on; writes nothing"),   // K5157: answers' declared read, its owner's sentence (R13, R51)
  standing: R("a member's own standing questions"),
  standinganswers: R("the runs of a member's own standing questions that found something new"),
  /* following */
  followbody: "body-directed: keyed by (body, period); a member's follow of a body's meetings, moving no bundle",
  unfollow: "follow-directed: keyed by follow; its author ends it, and it stays readable",
  followregister: "register-directed: keyed by the register's address; a member's follow, moving no bundle",
  followpersonquery: "register-directed: keyed by (register, identifier); a member's follow of one named query, never a crawl of a person",
  followportal: "portal-directed: keyed by (address, key field); a member's follow of a dataset, moving no bundle",
  permeetingbody: "address-directed: keyed by a watched address; names the body its captures follow, the latest governing",
  refreshregister: "follow-directed: keyed by follow; a fresh capture with the member's own credential",
  follows: R("the follows and per-meeting watches the viewer may see, each with when it is next due"),
  snapshots: R("a portal follow's snapshots, each valid at its capture"),
  snapshotdiff: R("the rows added, removed and changed between two snapshots of a portal follow"),
  /* T33's ops in earlier modules: standards */
  lawrelate: "standard-directed: keyed by a new relation between two standards or portions; writes standards' rows and moves no bundle",
  lawwithdraw: "standard-directed: keyed by a relation, link or treatment; keeps it, shown withdrawn",
  lawpropose: "standard-directed: keyed by a new proposal; stored apart and labeled, recorded only when a member's act names it",
  courtlink: "standard-directed: keyed by a court standard and a portion; writes standards' rows and moves no bundle",
  courttreat: "standard-directed: keyed by two decisions; writes standards' rows and moves no bundle",
  inforceat: R("whether a standard, or an instrument's portion, was in force on a date, and which version"),
  standardsfor: R("the documents citing a standard, or the standards a document cites"),
  lawrelations: R("a standard's temporal and referential relations, withdrawn ones marked"),
  lawaddresses: R("every key and portion a provision has been held under"),
  stillstanding: R("whether a court decision still stood on a date, or undetermined"),
  citationresolve: R("whether a held capture states a court citation"),
  /* credentials */
  accountreferenceset: "credential governance: a member's own assistant account reference, never answered; the subject is a credential, not a bundle",
  accountreferenceremove: "credential governance: a member removes their own account reference; the subject is a credential, not a bundle",
  aigrantmint: "credential governance: a member's own short-lived ai grant; the subject is a credential, not a bundle",
  keyedserviceset: "credential governance: the group's key for a keyed outside service, an administrator's; never answered",
  keyedserviceswitch: "the copy's configuration: whether a keyed outside service is on; an administrator's, not an act on an object",
  accountreference: R("a member's own account reference state, never its secret"),
  keyedservices: R("each keyed outside service held and switched, never a key"),
  /* sources, entities, inquiry */
  sourcekeyed: "capture-mark: keyed by the member's own capture sha; records the paid source it came from, never the query",
  entityidentify: "registry write, keyed by (entity, scheme): holds a scheme identifier with its validity and basis",
  waitlook: "personal state, keyed by the member's own dated wait: records that they looked and moves nothing in the inquiry",
  /* corpus-export */
  exportpage: R("one page of a carried table's rows and their digest, for an export"),
  exportrender: "export: keyed by (viewer, format); renders what the viewer would be carried and logs who took it",
  /* actions, action-clocks */
  addresseesuggest: R("the offices the record holds as responsible for an action's subject on its date, as a suggestion"),
  clockpropose: "action-directed: keyed by (action, rule, proposer); a proposal stored apart, never a clock entry until a member adopts it",
  /* `clockadopt` (T46; R33, K2998): an ACTS row on an action (`affordances` R52), so it has no row here; its absence stands
     above, and it is in MACHINE_REFUSALS (`./index.mjs`) */
  clocksics: R("an iCalendar file of named actions' pending dated clock entries"),
  clocklateness: R("the group's own lateness: commitments met on time, met late, or pending past their date"),
  /* ai-use (R30: `ai-use` R4; no ceiling remains, its limits are `ailimitset`'s, ./t41.mjs) */
  aiusage: R("one account's month of assistant use per use, to its owners, naming no member, or a member's own use per "
    + "payer and per use against each limit that bound them"),
  airunverify: "run-directed: keyed by (mode, run); a member's evidenced verification of a mode's first live run",
  /* capture-requests */
  capturerequestplatformmark: "host-directed: keyed by a host; a group-wide mark that the host is a login-gated platform",
  capturerequestplatformunmark: "host-directed: keyed by a host; withdraws its platform mark, kept with who and when",
  capturerequestplatformhosts: R("the hosts marked platforms"),
  /* instance-setup */
  officesseed: "the instance's configuration: seeds the active profiles' offices and bodies as entities; an administrator's",
  /* B3 (K1689). `askusage` carries no NEEDS row (op-declarations' UNATTENDED_BY_DECISION, K1601), so it has no reason
     here (`affordances` R12: a reason for an ungated op reads stale); its rank is above. */
  seatsseed: "the instance's configuration: seeds the seats of matched bodies and their holders from held captures; an administrator's",
  disclosureshown: "personal state, keyed by member: the assistant's disclosure shown to them, with its version",
  ask: "member-directed: a member's own question to the assistant under their own account; no object is before them",
  assistantstate: R("whether the assistant is enabled for this copy, with who set it and when"),
  disclosureof: R("a member's own record of the assistant's disclosure shown to them"),
  /* layer 9's read, gated since T33 (op-declarations gives it a NEEDS row of null, K1689) */
  standardinforce: R("whether one standard was in force on a date, with why"),
};
