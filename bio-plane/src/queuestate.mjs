/* REC-21 — the PERSONAL half of the queue, kept structurally distinct from the
 * record half, and the one doctrine rule that keeps them apart.
 *
 * THE RULE, and it is doctrine rather than preference (D-125's first-named
 * hazard, restated by DEC-16): **muting is PERSONAL and dismissing is a RECORD
 * ACT, and they must never be one control.** An OBLIGATION leaves everyone's
 * list when it is RESOLVED, which is record state. A FINDING leaves the list
 * when it is adopted, deferred or dismissed, which is an authored record act
 * carrying its author and reason (op=proposedispose). A CONDITION — a fact
 * about our own machinery rather than about the world — is acknowledged or
 * MUTED, and that is personal only: the condition persists and every other
 * member still sees it (NOTIFICATIONS.md, "MARKED AS HANDLED", which calls this
 * "the rule most likely to be lost when someone implements a delete button").
 *
 * CORRECTED 2026-09-22 by BOB #26's ruling (D-125, NOTIFICATIONS.md "MARKED AS
 * HANDLED"), built by D-125's landing: a member may PERSONALLY stop being
 * notified of a FINDING too — DEC-10's (b) per item and (c) per case over the
 * kinds named. That does not touch the rule above: a mute is keyed on the
 * MEMBER, so it removes nothing from any other member's list, and a finding
 * still leaves the TEAM's list only by the authored disposition, which a mute
 * never writes. The sentence below said "CONDITION KINDS ONLY" and guarded the
 * right hazard with the wrong key; it now reads OBLIGATION-free.
 *
 * SO `muted_kinds` MAY CONTAIN NO OBLIGATION KIND, and the fence is at the
 * WRITE, in queueMute, which is the ONE place the column is ever authored. The
 * concrete failure it prevents is stated by CRITIQUE.md and is worth carrying
 * here where the fence lives: an OBLIGATION is something a NAMED PERSON must do
 * for the record to proceed; a muted case would remove it from the only surface
 * that routes it; and `tasks` carries no per-member mute, so the record would go
 * on believing a question reached a person it cannot reach. Under DEC-16 that
 * is worse rather than better, because one member's resolution now clears every
 * other member's queue: the mute/resolve boundary is what stands between SHARED
 * RESOLUTION and SILENT DISAPPEARANCE.
 *
 * WHY THE CLASS IS CHECKED AT THE WRITE AND NOT AGAIN AT THE READ. A second
 * copy of a rule is a second place for it to drift (C-5, and the reason
 * op=dispose's duplicated state machine is named as the hazard not to repeat).
 * `muted_kinds` is written by exactly one method, which refuses anything that is
 * not a CONDITION kind, so membership in that column already MEANS "a condition
 * kind this member muted". The read therefore asks one question — is this
 * item's kind muted for one of the homes it appears under — and asks it of
 * every item, whatever its class. That is also what makes the failure OBSERVABLE:
 * remove the fence and a real obligation genuinely disappears from a real feed,
 * which is negative control (b) and is the whole point of running it.
 *
 * WHY THIS IS ITS OWN MODULE. It is PURE — no storage, no clock, no viewer — so
 * a suite can hold the decision to the store's own behaviour directly, exactly
 * as affordances.mjs lets the affordances suite hold deriveActs. The plane's store (`src/plane/store.mjs`)
 * cannot be imported outside workerd (it imports cloudflare:workers), and a
 * rule that can only be exercised through a Durable Object is a rule that gets
 * exercised less.
 */

/* THE CONDITION-KIND VOCABULARY is `observation-log`'s (R5; K78 (3), N49, N114): the condition kinds a look may
 * carry (C-22.4) and the kinds a member may lawfully mute are one list, kept in one place, so the two cannot drift.
 * It is a VOCABULARY, not a producer. What it gives the mute is the set of kinds a member may lawfully mute, which
 * is what the fence needs in order to refuse anything else BY NAME rather than by silence. The list is larger than
 * the feed can emit (not every kind has a producer), which is the safe direction: the fence accepts a mute for
 * a kind whose generator is not built, and the mint refuses any CONDITION kind this list does not name. A surface
 * never keeps a copy of it; it reads it from the refusal or from op=queue's own answer. */
/* R5 (K608, K611): beside observation-log's kinds (twenty since T23, K1099), the one condition kind that is not a
 * look's: a deadline on one of the group's actions passed while its entry is still pending (`action-producers` R1, was
 * `queue-producers` R15 until T45, from `action-clocks.overdueClocks`).
 * A CONDITION and not a FINDING (K611): it is said once, when the date passes, and a member quiets it for themselves;
 * the action's own record is where the overdue entry is met or waived. It is queue's to add and not observation-log's,
 * because no look ever carries it (C-22.4 checks a look's condition against observation-log's list alone). */
import { CONDITION_KINDS } from "./observation-log/vocabulary.mjs";
import { word, localize } from "./setup-words/index.mjs";
export const QUEUE_CONDITION_KINDS = Object.freeze({
  ...CONDITION_KINDS,
  "action-clock-overdue":       "a deadline on one of the team's actions passed while its entry is still pending "
                              + "(DEC-94) — LIVE: action-producers R1, from action-clocks' overdueClocks",
  /* R1, R5 (DEC-101 (3), DEC-116 item 8; T31): a docket a member follows could not be read on this copy's latest read.
     A fact about our own reading, never about the publisher, so a CONDITION a member quiets for themselves; queue's to add
     for action-clock-overdue's reason (no look carries it). Its producer is `queue-producers`' (its R35). */
  "cited-docket-unreadable":    "a docket you follow could not be read (DEC-101, DEC-116) — LIVE: queue-producers R35",
  /* R1 (T51 fix round 7, G61): three more producers' CONDITIONs the catalogue did not name, so the mint (R11) refused the
     whole feed for a member they were raised to. Each is a fact about our own machinery or a step left undone, quieted by
     its recipient. Code-origin stand-ins; the words members see are the design stream's (rows owed, T52). */
  "edition-scheduled":          "a case edition is signed to publish at a set time and is waiting; move the time or "
                              + "cancel it — LIVE: queue-producers R37",
  "place-profile-arrived":      "a place profile arrived on this copy; choose it under Places — LIVE: queue-producers R38",
  "request-unsent":             "a request was approved and has not been recorded sent — LIVE: action-producers R25",
});

/* Every OTHER kind the catalogue names, with the class it belongs to — so a
 * refusal can say what the kind ACTUALLY is instead of only what it is not, and
 * so a suite can assert that every kind a live producer emits is classified.
 *
 * THE THREE LIVE SPELLINGS MATTER and are carried exactly as the producers emit
 * them: `authority-undetermined` is the kind `tasks`' drain routes (D-98);
 * `missing_predecessor` and `overdue_successor` are the two kinds
 * `queue-producers/proposals.mjs` emits from proposalsFeed. If one of those were absent here the fence would refuse it as
 * UNKNOWN rather than as MISCLASSED, which is a weaker and less true answer. */
export const QUEUE_OBLIGATION_KINDS = {
  "authority-undetermined":      "authority undetermined at capture (D-98, RULED: created automatically) — LIVE: capture's task kinds, drained by tasks",
  /* CORRECTED 2026-08-05 (REC-47 / DEC-46 (d), D-188). This read "blocks a
     transition", which is the PRE-DEC-20 blanket rule and the opposite of the
     doctrine: ordinary bias debt is DISCLOSED and travels; only an uncleared
     HUNCH disqualifies. DEC-20 narrowed the old state-transition gate to hunches
     too (that gate is since retired, K899 (3)), so nothing about this kind blocks
     anything. The producer is unbuilt
     (D-86's remaining half), which is why this is free to correct now — and
     exactly why it had to be, since the producer would have been built to the
     sentence. The identical wording in NOTIFICATIONS.md is corrected with it.
     LIVE from 2026-09-23 (D-86): the `bias-debt` consumer on the one alarm raises one item per run whose lens
     `moved`, read from aiRunRead and never compared again; queue-producers #obligationsBiasDebt serves it on op=queue. */
  "bias-debt":                   "a re-run is owed after a lens change (D-86) — DISCLOSED, never blocking (DEC-20) "
                              + "— LIVE: bias's debt sweep, served by queue-producers #obligationsBiasDebt",
  "endorsement-owed":            word("queuestate.endorsement_owed"),
  "expertise-confirmation-owed": word("queuestate.expertise_confirmation_owed"),
  "membership-request":          word("queuestate.membership_request"),
  "project-owners-inactive":     localize("queue.queuestate.every_owner_of_a_project", "every owner of a project is inactive; rescue is available (D-47)"),
  /* N345 (R1; DEC-84 item 2, DEC-85): a duty is never muted, dismissed or set aside, and it leaves only by resolution
     (contradiction R24), so both are OBLIGATIONs. Their producers are `queue-producers`' (its R4, R7). */
  "contradiction-duty":          "a conflict the record holds that a member of this project must resolve (N345)",
  "contradiction-duty-unseen":   "something this project rests on is in conflict with a record you cannot see; "
                              + "your project can ask to resolve it (DEC-85)",
  /* N375 (R1; membership R89, K535, K566): a key a member registered for themselves is a signer of the group's bundles
     until an administrator decides otherwise, so it is an OBLIGATION of the administrators, never muted. Its producer is
     `queue-producers`' (its R14), which offers membership's revoke. */
  "signer-self-registered":      "a member registered their own signing key; you may revoke it (N375)",
  /* The Action layer (R1; K608, K613, K614; BIO_Action_v0_1.md §4 rule 5): three OBLIGATIONs, each a judgement or an
     answer a named member owes, each leaving by its own act (R12's doors) and never by a mute. Their producers are
     `action-producers`' (its R2, R3, R4; `queue-producers` R16–R18 until T45, K2781 (1)). */
  "plan-checkpoint-due":         "a checkpoint your team set in an action plan has come; a member judges whether its "
                              + "condition was met (op=checkpointrecord) — LIVE: action-producers R2",
  "escalation-stage-proposed":   "an escalation's next stage is proposed because its trigger was met; a member advances "
                              + "it or declines with a reason (op=escalationadvance, op=escalationdecline) "
                              + "— LIVE: action-producers R3",
  "action-reminder":             "a reminder you asked for on one of the team's action deadlines; answer it with "
                              + "another reminder or none (op=reminderanswer, DEC-94) — LIVE: action-producers R4",
  /* K899 (7), DEC-61, DEC-113 (R1; action-holds R2, R5, were actions R52, R56): a reply the group marked as legal
     pressure asks the group whether to place a litigation hold; a member answers by placing the hold (op=actionhold) or
     releasing it (op=actionholdrelease, its own act since DEC-113), each with a reason, and those acts are the item's
     doors (R12). (T45; Actions D10, v0.2 rule 12) A `legal` mark on a docket entry and a `legal` pressure record raise
     it too. An OBLIGATION, never muted. Its producer is `action-producers`' (its R5, was `queue-producers` R19). */
  "litigation-hold":             "a reply the team marked as legal pressure: consider whether to place a litigation "
                              + "hold, and record it in place or released with a reason (op=actionhold to place it, "
                              + "op=actionholdrelease to release it; DEC-61, DEC-113); a legal mark on a docket entry, "
                              + "or a legal pressure record, asks the same — LIVE: action-producers R5",
  /* K921 (R1; filing-templates R9, local-facts R1): two more OBLIGATIONs a named member owes, each leaving by its own act
     (R12's doors) and never by a mute. Their producers are `action-producers`' (its R6, R7; `queue-producers` R20, R21
     until T45). */
  "template-review-requested":   "a member asked you to review a filing template's version (op=templatereview) "
                              + "— LIVE: action-producers R6",
  "local-fact-due":              "a holiday calendar or office hours one of the team's deadlines reads is unconfirmed "
                              + "or due for confirmation (op=factconfirm) — LIVE: action-producers R7",
  /* DEC-102 item 3, K1019 (R1; publication R17): a case edition being prepared reaches an observation the member authored
     and they have chosen no credit level for it. Theirs alone to answer, by choosing one (R12's door, op=attribute), and
     never muted. Its producer is `queue-producers`' (its R23). */
  "attribution-unchosen":        "a case edition being prepared reaches an observation you authored and you have chosen "
                              + "no credit level for it; choose one (op=attribute) — LIVE: queue-producers R23",
  /* DEC-116 item 2 (R1, R50; docket R9): the docket's required core is a To-do for the case's manager until it is done,
     so it is an OBLIGATION, never muted; it leaves by placement or, for a submission, a decline (R50's doors). Its
     producer is `queue-producers`' (its R30). */
  "docket-core-due":             "a case you manage has an item its docket must list: a response or statement from its "
                              + "subject or a holder of standing, a newer edition, or a conflict on a load-bearing finding "
                              + "not disclosed; place it, or decline it (op=docketprepare, op=docketdecline; DEC-116) "
                              + "— LIVE: queue-producers R30",
  /* DEC-121 (1) (R1; wizard-scripts R7, R17): a submitted wizard script's version waits on an owner who may approve it.
     Theirs to answer by approving it (R12's door, op=wizardapprove), and never muted. Its producer is `queue-producers`'
     (its R33). */
  "wizard-approval-requested":   "a member submitted a wizard script's version that you may approve; approve it or leave "
                              + "it (op=wizardapprove; DEC-121) — LIVE: queue-producers R33",
  /* T33-83 (R1; K1505 (15), K1594 (3); inquiry R54–R57): a dated wait a member set on an inquiry has come round. The
     member set it for themselves, so it is theirs to answer, never muted: by recording a look (R12's door,
     op=waitlook), a new date or the wait removed. Its producer is `notice-producers`' (its R6). */
  "inquiry-recheck-due":         "a date you set to look again at a question has come; look again (op=waitlook), set a "
                              + "new date or remove the wait — LIVE: notice-producers R6",
  /* T34-53 (R1; tasks R14, DEC-135 (2)): a project owner asked for a check, by an expertise the member declared or by
     name, on something they can see. A task in `tasks` (R8 reads it as any task), so it leaves by its own act and never
     by a mute: taken and recorded (op=checktake, op=checkrecord), or left (op=taskresolve closes this member's own). */
  "check-requested":             "a project owner asked for a check, by an expertise you declared or by name, on something "
                              + "you can see; take it (op=checktake), or leave it (DEC-135) — LIVE: tasks R14",
  /* T41 (R1; N820, K2418, K2484; notice-producers R17): what a member asked for or set themselves on a step or a
     milestone has come. Theirs alone, never muted: a step past the date they set leaves when the step is ended
     (op=stepend, R52), and a reminder they asked for is answered with another reminder or none, and it is told on its
     day only (steps R12, investigation R3; DEC-94). Their producer is `notice-producers`' (its R17). */
  "step-date-due":               "a step you set a date on has passed that date and is not ended; end it (op=stepend) "
                              + "or set a new date — LIVE: notice-producers R17",
  "step-reminder":               "a reminder you asked for on a step's date; answer it with another reminder or none "
                              + "(op=stepreminder, DEC-94) — LIVE: notice-producers R17",
  "milestone-reminder":          "a reminder you asked for on a milestone (DEC-94); answer it with another reminder or "
                              + "none (op=milestonereminder) — LIVE: notice-producers R17",
  /* T45 (R1, R12; N855, N890; Actions D6d, D27; v0.2 rules 17, 20): what a plan set running, or a date its group set on
     it, now asks of a named member. Each leaves by its own act (R12's doors) and never by a mute. Their producer is
     `action-producers`' (its R10, R12). */
  "watch-keep-or-stop":          "a plan that set a watch running has closed, or every promise it watched is met: keep "
                              + "the watch until a date, or stop it (op=watchanswer) — LIVE: action-producers R10",
  "plan-review-due":             "a review day your team set for a plan has come; record a review "
                              + "(op=planreviewrecord) — LIVE: action-producers R12",
  "plan-look-again":             "a paused plan's look-again date has come; look again, resume it (op=planresume) or "
                              + "close it — LIVE: action-producers R12",
  /* T48 (R1, R12, R54; N1047, K3189; DEC-226 (1); machinery-producers R11): a release of the group's Civicsmith is ready to
     install. Every active administrator is asked, and it leaves every one's list when one of them acts on it, so it is an
     OBLIGATION, never muted; its door is `updatelater` (R12) and its section is "Your team's Civicsmith" (R54). */
  "update-ready":                "a release of your team's Civicsmith is ready to install; read what changes, then update, "
                              + "put it aside, or skip it with a reason — LIVE: machinery-producers R11",
  /* T50 (R1, R12, R57; N1091, N1204; DEC-248, DEC-286): a member is invited to a project, and a member asks to join one.
     Each is a to-do a named member owes and leaves by its own act (R12's doors), never by a mute. Their producers are
     `queue-producers`' (its R41, R42). */
  "project-invitation":          "you are invited to a project; join it or leave it (op=projectjoin) "
                              + "— LIVE: queue-producers R41",
  "project-request":             "a member asks to join a project you own; grant or decline (op=projectrequestanswer) "
                              + "— LIVE: queue-producers R42",
  /* Fix round 10 (R57; queue-producers R54; K5157): a participant asks to leave a project; only an owner removes her. */
  "project-leave":               "a participant asks to leave a project you own; remove them from it (op=projectremove) "
                              + "— LIVE: queue-producers R54",
};

export const QUEUE_FINDING_KINDS = {
  "missing_predecessor":        "a required predecessor stage is absent (D-73) — LIVE: queue-producers/proposals.mjs",
  "overdue_successor":          "a required successor is past its declared deadline (DEC-10) — LIVE: queue-producers/proposals.mjs",
  /* N107 (K147): progressions R31's finding, aggregated one per (progression, stage) by `queue-producers/proposals.mjs` in its
     own words, because it is not "required and absent". It decides nothing about which document belongs. */
  "cardinality_exceeded":       "a stage declared to hold at most one document holds more; noticed, which decides "
                              + "nothing about which of them belongs (framework 8.2) — LIVE: queue-producers/proposals.mjs",
  /* T33-83 (R1; K1466, K1444 (i)): an occurrence of a body's duty a member adopted has come due with nothing the record
     holds meeting it, or may have (between its candidate dates). A question about the body, never a violation. Its
     producer is `notice-producers`' (its R5). */
  "temporal-expectation-due":   "an occurrence of a body's duty you adopted has come due and nothing the record holds "
                              + "shows it met; a question, never a violation (K1466) — LIVE: notice-producers R5",
  "source-modified":            "a monitor tick found the source modified — LIVE: queue-producers #findingsSourceFlagged",
  "source-removed":             "a monitor tick found the source removed (404/410) — LIVE: queue-producers #findingsSourceFlagged",
  "duplicate-document":         localize("queue.queuestate.a_duplicate_document_was_detected", "a duplicate document was detected (D-60)"),
  "link-verdict-changed":       word("queuestate.link_verdict_changed"),
  "reused-asset-changed":       "a reused asset was later found changed, post-hoc (CAP-4)",
  "assistant-surfaced-focus":   "an assistant surfaced a question (D-78, D-82 — must LOOK derived)",
  "grade-improvable":           localize("queue.queuestate.a_connections_grade_is_improvable", "a connection's grade is improvable (D-72)"),
  "objective-gap":              "a gap derived from an objective's satisfaction condition (D-76) — LIVE: queue-producers #findingsObjectiveGap",
  "measure-decay":              localize("queue.queuestate.a_bias_statements_measure_has", "a bias statement's measure has decayed (D-87, D-90 — reports, never blocks)"),
  /* D-52, LIVE 2026-09-23: queue-producers #findingsExportPerformed, derived on read from `export_log`
     and raised to every administrator and to nobody else (Membership v2 §8.1). */
  "export-performed":           "an export was performed; every administrator is notified (D-52 8.1) "
                              + "— LIVE: queue-producers #findingsExportPerformed",
  "audit-finding":              "op=audit found something about the record",
  "register-unbacked":          localize("queue.queuestate.a_register_entrys_bytes_are", "a register entry's bytes are unbacked (D-9, D-45)"),
  /* PL-15 / D-213, ANSWERED 2026-08-06 by Bob and LIVE from this item:
     queue-producers #findingsOutOfInquiryLead. Evidence bearing on inquiry B, met
     while a run was working inquiry A, is CAPTURED — an entry to the store, and
     deliberately NOT an entry to any leg of any claim — and the OBSERVATION
     becomes this item.

     FINDING AND NOT CONDITION, and the distinction is doctrine rather than
     taxonomy. A CONDITION is a fact about our own machinery and is personally
     MUTABLE (D-125, DEC-16); a lead is a fact about the WORLD that a team must
     see, and one member's inbox hygiene must not be able to make it disappear
     for everybody with nothing recorded. It leaves the list the way every
     finding does — adopted, deferred or dismissed through op=proposedispose,
     an authored record act carrying its author and its reason. */
  "out-of-inquiry-lead":        "evidence for ANOTHER question was met while working this one: captured, "
                              + "and deliberately not made part of any claim (D-213, DEC-60) "
                              + "— LIVE: queue-producers #findingsOutOfInquiryLead",
  /* PL-13 / IS-3, MINTED 2026-08-09, and BOTH ARRIVE WITH A PRODUCER. The plan
     row named these two slugs; UI-45 asserted them ABSENT so the gap would have
     an alarm on it rather than be a comment, and this is the item that sets the
     alarm off on purpose. Neither is a word without a generator: see queue-producers'
     `#findingsStanceDiverged` and `#findingsVersionFromAnotherTeam`.

     THEY EXIST BECAUSE D-216's ANSWER IS **PER-PROJECT** (measured 2026-08-08,
     driven through twelve ops, not read). An inquiry shared across projects
     holds NO stance in its own bytes; each project authors its own dated
     pointer, and two projects may stand on two different readings of one
     question SIMULTANEOUSLY with the plane refusing neither. That is the right
     model and it has a cost, which is exactly what these two kinds carry: the
     divergence is now INVISIBLE unless somebody is told, because nothing
     refuses it and nothing reconciles it. A model that permits divergence
     silently is a model that lets a team build a case on a reading its partners
     abandoned a month ago.

     FINDING AND NOT CONDITION, and it is doctrine rather than taxonomy — the
     plan row's own second negative-control arm turns on it. A CONDITION is a
     fact about OUR OWN MACHINERY and is personally MUTABLE (D-125, DEC-16). A
     divergence of stance is a fact about the WORLD OF THE WORK: another team
     reads the shared question differently. One member's inbox hygiene must not
     be able to make that disappear for everybody with nothing recorded.
     Both leave a list the way every finding does — by an authored, attributed
     act. CORRECTED 2026-09-23 (D-125, BOB #26's ruling): a member MAY now mute
     either one for THEMSELVES, because a mute is keyed on the member and moves no
     other member's list; the old `test/current.test.mjs` (deleted in T20) drove exactly that — the mute
     accepted, personal, writing no disposition, the finding still on a second
     member's feed — where it used to drive a refusal; `test/m/queue/feed.test.mjs`' R16 test holds it now. */
  "stance-changed-here-not-elsewhere":
                                "a project moved what it stands on for a SHARED question and the other "
                              + "projects drawing on it did not: one question, two live readings, "
                              + "refused by nothing (§7, D-216 — per-project stance) "
                              + "— LIVE: queue-producers #findingsStanceDiverged",
  "new-version-arrived-from-another-team":
                                "a new reading of a question this project draws on was proposed under "
                              + "ANOTHER project's work, so it arrived without anybody here authoring it "
                              + "(§7, D-216 — one question beneath several projects) "
                              + "— LIVE: queue-producers #findingsVersionFromAnotherTeam",
  /* N172 (reevaluation R14): a newer capture of something a member's reference is pinned to was graded affected or
     undetermined; the member adopts the newer version or keeps the earlier one (reevaluation R15). */
  "newer-capture-affects-reference":
                                "a newer capture of something your reference is pinned to may change what it says; "
                              + "adopt the newer version or keep the earlier one (reevaluation R14, R15) "
                              + "— LIVE: queue-producers #findingsNewerCapture",
  /* REC-124 / INVESTIGATIVE-SESSION.md §7.1 item 3. FINDING for §7's reason:
     another team concluding the question you share is a fact about the work,
     and no member may silence it for the team. */
  "shared-inquiry-concluded-by-another-project":
                                "another project drawing on a SHARED question concluded it, adopting "
                              + "the claim of the reading it stands on; nothing this project stands on "
                              + "or concluded has moved (§7.1 — a conclusion is per-project) "
                              + "— LIVE: queue-producers #findingsConcludedElsewhere",
  /* N345 (R1; DEC-76 item 3, DEC-84 items 1, 3, 7, 13; DEC-85): what the record noticed about conflicts, each leaving a
     list by an attributed act (R46), never by one member's preference alone. Their producers are `queue-producers`'
     (its R4–R7). */
  "contradiction-lead":         "a lead the record noticed: two things it holds may be in conflict (N345)",
  "contradiction-plurality":    "two projects' conclusions that may not both hold (N345)",
  "contradiction-plurality-unseen":
                                "this project's conclusion may not hold together with a conclusion you cannot see (DEC-85)",
  "side-corrected":             "something a finding rests on was marked wrong (N345)",
  "tension-after-publication":  "a published case's finding rests on a conflict found since it was published (N345)",
  /* DEC-116 items 3, 7 (R1, R50; reevaluation R30, docket R12): what a case edition's docket did to something a
     finding rests on. Each leaves as `side-corrected` does, by a recorded re-evaluation (R50). Their producer is
     `queue-producers`' (its R31). */
  "edition-withdrawn":          "something a finding rests on is in a case edition its team has withdrawn (DEC-116) "
                              + "— LIVE: queue-producers R31",
  "edition-contested":          "a response the team filed contests a case edition this finding is part of (DEC-116) "
                              + "— LIVE: queue-producers R31",
  /* DEC-113 (R1; action-holds R5, R8, were actions R56, R59): the administrators and whoever placed the hold are told
     once that it was released. Something the record noticed, which the recipient disposes of (R12's FINDING
     disposition). Its producer is `action-producers`' (its R8, was `queue-producers` R29). */
  "litigation-hold-released":   "a member released a litigation hold: the projects it alone covered may be purged again "
                              + "and their assistant transcripts deleted on schedule (DEC-113) — LIVE: action-producers R8",
  /* DEC-121 (5) (R1; wizard-scripts R13): a script's owner is told once why it was withheld, and when it returns. Each is
     something the record noticed, disposed of by its recipient. Their producer is `queue-producers`' (its R32). */
  "wizard-withdrawn":           "a wizard script you own or wrote no longer matches the screens and is withheld until "
                              + "fixed; its first refusal named (DEC-121) — LIVE: queue-producers R32",
  "wizard-restored":            "a withheld wizard script matches the screens again and is offered again (DEC-121) "
                              + "— LIVE: queue-producers R32",
  /* DEC-101 (3) (R1; reevaluation R33): a case another group published, which your group cites, moved on its publisher's
     docket. Each leaves as `edition-withdrawn` does, by a recorded re-evaluation. Their producer is `queue-producers`'
     (its R34). */
  "cited-newer-edition":        "a case your team cites has a newer edition (DEC-101) — LIVE: queue-producers R34",
  "cited-edition-withdrawn":    "a case edition your team cites has been withdrawn (DEC-101) — LIVE: queue-producers R34",
  /* DEC-101 (3), DEC-116 item 8 (R1; case-import R20): what a followed docket gained or refused, told once to who set the
     watch. Their producer is `queue-producers`' (its R35). */
  "followed-case-entry":        "a docket you follow gained an entry (DEC-101, DEC-116) — LIVE: queue-producers R35",
  "cited-docket-entry-refused": "an entry of a docket you follow failed its checks and was not taken in (DEC-116) "
                              + "— LIVE: queue-producers R35",
  /* T33-83 (R1; K1491, K1481): what the machine pointed at, labelled as the machine's and held in the hypothesis layer,
     never a fact about a person and never moving a finding; a member disposes of it or takes it up as a hunch or
     hypothesis (R12). Shown only once each check's or detector's gate is open (plan Rule 7), which is its owner's to
     judge. Their producer is `notice-producers`' (its R2, R3, R4). */
  "interest-check-noticed":     "the machine noticed a pattern among people's facts that a check you may see describes; "
                              + "labeled as the machine's, not a judgment of anyone (K1491) — LIVE: notice-producers R2",
  "money-detector-noticed":     "the machine noticed a pattern in the money facts that a detector describes; labeled as "
                              + "the machine's (K1491) — LIVE: notice-producers R3",
  "standing-answer":            "your standing question found something new; labeled as the assistant's (K1481) "
                              + "— LIVE: notice-producers R4",
  /* T36-46 (R1; N742, K2038, K2130): what the group's own defences and the policies it follows did, each told once to
     whom it concerns and disposed of by its recipient (R12's default FINDING disposition; with no project home it is
     quieted by the item mute). None names a member. Their producer is `notice-producers`' (its R12–R15). */
  "security-level-high":        "the team's security level became High: an unusual run of refused attempts, or something "
                              + "got through; counts only, naming no one (DEC-165) — LIVE: notice-producers R12",
  "policy-changed-noticed":     "a policy the team follows changed at its address without an announced amendment; "
                              + "review it (DEC-145) — LIVE: notice-producers R13",
  "scan-found":                 "a file you can see was held after a scanner found something in it; its safe view stays "
                              + "open (DEC-169) — LIVE: notice-producers R14",
  "security-tool-off":          "one of the team's security tools was switched off because it did not confirm its private "
                              + "mode (K1929) — LIVE: notice-producers R15",
  /* T40 (R1; N812, K2376 (2), K2394; notice-producers R16): what the AI accounts did, each told to whom it concerns.
     The words members see are the design stream's (`words.json`, read by key by notice-producers); these sentences are
     the catalogue's. None names a member. */
  "explore-ask":                "one of your accounts may explore today; approve it or let the day pass "
                              + "(op=exploreapprove) — LIVE: notice-producers R16",
  "ai-limit-reached":           "a limit of an account you own was reached in this period — LIVE: notice-producers R16",
  "project-account-suspended":  "a project's sign-in account stopped serving because a second member joined "
                              + "— LIVE: notice-producers R16",
  /* T41 (R1; N820, K2418, K2484; notice-producers R17): what the investigation's work noticed, each told once and each
     disposed of by a project (R52), or quieted by its recipient where no project holds it. */
  "question-find":              "the machine found something that may bear on a question you follow; labeled as the "
                              + "machine's work — accept it, hold it as a hypothesis, or plan a step "
                              + "— LIVE: notice-producers R17",
  "step-later-found":           "something a step looked for and did not find has since arrived; the step's look stays "
                              + "as it was, dated — LIVE: notice-producers R17",
  "milestone-overdue":          "a milestone of a project you take part in has passed its date "
                              + "— LIVE: notice-producers R17",
  "project-quiet":              "a project you take part in has gone quiet: its objective, its condition and what the "
                              + "record still lacks; write it up, keep watching, close it with its gaps, or revise the "
                              + "objective — LIVE: notice-producers R17",
  "step-cost-shared":           "a costed step serves questions several projects you own draw on; the sharing projects "
                              + "are named — LIVE: notice-producers R17",
  "step-cost-message":          "an owner of another project sharing a costed step sent you a message about its cost "
                              + "— LIVE: notice-producers R17",
  "review-comment-left-out":    "your comments on a case's review copy were not included in its published edition; you "
                              + "may file a response in its docket — LIVE: notice-producers R17",
  /* T45 (R1, R12; N881; Actions D14; v0.2 rule 18): the project's owners are told once that a member who left had items
     routed to them. No project-scoped decision answers it: its doors are the take-ups its options lead with, and its
     recipient quiets it for themselves (R12). Its producer is `action-producers`' (its R9). */
  "member-left-items":          "a member who left had items of this project routed to them; take up the ones you "
                              + "choose — LIVE: action-producers R9",
  /* T50 (R1, R12, R57; N1204; DEC-304; notice-producers R24): something a member watches changed, told to the watcher alone
     (as `standing-answer` is), so no project decides it and its recipient quiets it for themselves. */
  "watched-changed":            "something you watch changed; open it to see what changed (DEC-304) "
                              + "— LIVE: notice-producers R24",
  /* T51 fix round 7 (R1; G61; B.md:22; K4562; notice-producers R27, R28): a large capture's background fetch was delivered,
     and a money ingest run in the background finished or was stopped, each told once to the member who started it and
     disposed of by its recipient. They were minted by their producers and named nowhere here, so the opener's whole Queue
     was refused `NO_SUCH_KIND`. Code-origin stand-ins; the words members see are the design stream's (rows owed, T52). */
  "fetch-done":                 "a large capture you opened was fetched in the background and is filed "
                              + "— LIVE: notice-producers R27",
  "ingest-done":                "a money ingest you started in the background finished; open it to see the rows taken in "
                              + "— LIVE: notice-producers R28",
  "ingest-stopped":             "a money ingest you started in the background was stopped before it finished "
                              + "— LIVE: notice-producers R28",
  /* T51 fix round 7 (R1; G61; queue-producers R37, R39): what the scheduled edition did, and a wizard script's base that
     moved under a copy; each told once and disposed of by its recipient. */
  "edition-published-as-scheduled":
                                "a case edition signed to publish at a set time was published as scheduled "
                              + "— LIVE: queue-producers R37",
  "scheduled-edition-stopped":  "a case edition signed to publish at a set time was stopped and nothing was published; "
                              + "publishing needs a new signing — LIVE: queue-producers R37",
  "wizard-base-updated":        "the wizard script your copy is based on has a new version; read what changed, or bring it "
                              + "across — LIVE: queue-producers R39",
  /* T51 fix round 9 (R1; G135f; K4933; notice-producers R29): a reading of a document the member supplied finished, ended in
     part or was refused, told once to its opener and disposed of by its recipient. Named nowhere here, it left the
     opener's whole Queue refused `NO_SUCH_KIND` as soon as one reading ended (as G61 did for the fetch and ingest notices). */
  "reading-ended":              "a reading of a document you supplied finished, ended in part or was refused "
                              + "— LIVE: notice-producers R29",
};

/* THE N-NUMBERS — the catalogue's STABLE IDS, allocated when a generator is built and not before
 * (NOTIFICATIONS.md §The catalogue; `N-<n>` beside `C-<n>`). A row here IS the allocation: a generator
 * built later takes the next free number by adding its row here (the old process's `tools/mintid.mjs`,
 * retired with `tools/` in T19, read these rows as its register for `N`).
 *
 * THE SLUG STAYS THE ITEM'S `kind`, AND THAT IS DELIBERATE RATHER THAN UNFINISHED. The item contract's
 * sketch puts the id in `kind`, but every reader of `kind` today — the mint's `classOfKind`, the mute
 * fence, `op=affordances`' vocabularies, the surface's rendered sentence — is keyed on the slug, so
 * moving the id into `kind` is an interface change to every consumer and not a numbering. The id is
 * published BESIDE the kind, as `catalogue_id`, by the producer that took it. A generator built later
 * takes the next number here; a kind with no generator takes none.
 *
 * NOT EXPORTED, AND THAT IS ITS SHAPE RATHER THAN AN ESCAPE (D-52 fix pass, 2026-09-23). Every
 * EXPORTED plain object of this module whose values are all strings is a MEMBER-FACING vocabulary —
 * the texts a surface renders in place of a machine word (R1: every kind has one sentence). This table
 * is not one: its value is a machine id published as `catalogue_id`, the item contract's "stable
 * catalogue id" (NOTIFICATIONS.md §The item contract), which no surface renders (a member reads `summary` and
 * `detail`). A check that reads every exported all-string object as a vocabulary would have counted it as one,
 * whose one term was the token "N-1". So the TABLE stays here, unexported, and what leaves the module is
 * the LOOKUP below, R2's `catalogueIdOf`, which `test/m/queue/catalogue.test.mjs`' R2 test drives. */
const QUEUE_KIND_IDS = {
  "export-performed": "N-1",
};

/* The catalogue id a kind was allocated, or null for a kind that has none — which is most of them
 * (a kind takes an id when its generator is built). Null is not an error: it says no generator has
 * taken a number, and a producer publishes it as such rather than inventing one. */
export function catalogueIdOf(kind) {
  return Object.prototype.hasOwnProperty.call(QUEUE_KIND_IDS, kind) ? QUEUE_KIND_IDS[kind] : null;
}

/* The ONE class lookup. Returns "CONDITION" | "OBLIGATION" | "FINDING", or null
 * for a kind the catalogue does not name — three-valued in the same sense the
 * rest of this record is: unknown is not the same as wrong, and the refusals
 * below say which one happened. */
export function classOfKind(kind) {
  if (typeof kind !== "string" || !kind) return null;
  if (Object.prototype.hasOwnProperty.call(QUEUE_CONDITION_KINDS, kind)) return "CONDITION";
  if (Object.prototype.hasOwnProperty.call(QUEUE_OBLIGATION_KINDS, kind)) return "OBLIGATION";
  if (Object.prototype.hasOwnProperty.call(QUEUE_FINDING_KINDS, kind)) return "FINDING";
  return null;
}

/* How a member is told, in the plane's own words, why a kind may not be muted.
 * Named per class rather than one generic string, because the ANSWER differs:
 * an obligation is resolved and a finding is dismissed, and each of those is a
 * real act on a real surface the member can reach. A refusal that only says no
 * is the gate that pressures somebody into inventing a way past it. */
/* D-125 (BOB #26, 2026-09-22): the FINDING sentence is GONE, because a FINDING is
 * no longer refused — a member may mute one for themselves (DEC-10's (b) and (c)).
 * What it guarded, one member erasing the group's question, a MEMBER-keyed mute
 * cannot do: the finding stays on every other feed and in op=proposals, and it
 * leaves the team's list only by op=proposedispose. OBLIGATION alone is refused. */
export const MUTE_REFUSAL_DETAIL = {
  OBLIGATION: localize("queue.queuestate.a_to_do_is_something", "a to-do is something a named person must do for the record to proceed, and it leaves every list only when it is DONE (op=taskresolve, or the act its item names as `disposition.instead`): record state, not a preference. Quieting it would remove it from the only list that routes it while `tasks` keeps no per-member quiet, so the record would go on believing the question reached a person."),
};

/* The classes a PERSONAL mute may reach, in either form (D-125). A CONDITION and
 * a FINDING; never an OBLIGATION. One list, read by the one write. */
export const PERSONALLY_MUTABLE_CLASSES = ["CONDITION", "FINDING"];

/* D-125's ITEM form (DEC-10 (b)) and D-170's widening: the class of a queue item
 * named by its published id, or null. The id is the item's STABLE IDENTITY as
 * op=queue mints it — `FINDING::<progression>::<stage>` (the key
 * proposal_dispositions already uses), `FINDING::<kind>::…`,
 * `CONDITION::<kind>::…` — so the class is its first segment and nothing is
 * inferred. An OBLIGATION's id is an opaque task id with no class segment, so it
 * answers null here and the store asks `tasks` to name it (the refusal must say
 * OBLIGATION, not merely "unknown"). A segment with nothing after it is not an
 * item id. */
export function itemClassOf(id) {
  if (typeof id !== "string") return null;
  const m = /^(FINDING|CONDITION)::(.+)$/.exec(id.trim());
  return m && m[2].trim() ? m[1] : null;
}

/* The ITEM half of the admission decision: is THIS item muted by id for this
 * member? `itemMutes` is a Set of item ids. An OBLIGATION is never matched even
 * if its id were somehow in the set — the write refuses one, and this read does
 * not trust the column to have been written by that write alone (D-125: an
 * OBLIGATION stays unmutable). Returns true or false. */
export function mutedAsItem(item, itemMutes) {
  if (!item || !itemMutes || itemMutes.size === 0) return false;
  if (!PERSONALLY_MUTABLE_CLASSES.includes(item.class)) return false;
  return typeof item.id === "string" && itemMutes.has(item.id);
}

/* muted_kinds is ONE TEXT column holding a set. Stored as a sorted,
 * comma-separated list: sorted so the same set has one representation and a
 * suite can compare bytes, comma-separated because every kind is a slug and no
 * kind may contain a comma (the write refuses one). JSON would be the other
 * choice and buys nothing here except a parse that can throw. */
export function serializeMutedKinds(kinds) {
  return [...new Set((kinds || []).filter((k) => typeof k === "string" && k))].sort().join(",");
}
export function parseMutedKinds(text) {
  if (typeof text !== "string" || !text) return [];
  return [...new Set(text.split(",").map((k) => k.trim()).filter(Boolean))].sort();
}

/* R55 (T50; N1094): the instants a case's kinds were muted, stored beside `muted_kinds` as one JSON object, kind to
 * instant. A kind muted before they were kept has no entry, and answers no instant: it is never back-filled. Never
 * throws: text that is no such object reads as none held. */
export function parseMutedAt(text) {
  if (typeof text !== "string" || !text) return {};
  try {
    const o = JSON.parse(text);
    if (!o || typeof o !== "object" || Array.isArray(o)) return {};
    return Object.fromEntries(Object.entries(o).filter(([k, v]) => k && typeof v === "string" && v));
  } catch { return {}; }
}
/* Sorted by kind, so one set of instants has one representation; null (not "{}") when none is held. */
export function serializeMutedAt(at) {
  const keys = Object.keys(at || {}).filter((k) => typeof at[k] === "string" && at[k]).sort();
  return keys.length ? JSON.stringify(Object.fromEntries(keys.map((k) => [k, at[k]]))) : null;
}

/* THE ADMISSION DECISION, and the ONLY one. Given a queue item (its kind and
 * the homes REC-20's every-ancestor walk gave it) and this member's mute rows,
 * answer WHICH case suppresses it, or null.
 *
 * `mutes` is a Map case_id -> Set(kind). It is deliberately not the raw rows:
 * building it is the store's business (it reads the table), deciding is this
 * function's, and the separation is what lets the suite ask the question
 * without a Durable Object.
 *
 * THE SCOPE RULE — a mute is scoped to the KINDS PRESENT WHEN IT WAS MADE. It
 * is enforced HERE by the plainest possible mechanism: membership. The mute
 * stores the kinds the member named; a kind that was not named is not in the
 * set; a NEW kind arriving on a muted case is therefore not suppressed and
 * still reaches them. There is no wildcard and no "mute the case" — muting a
 * CASE rather than its kinds is precisely the delete button the doctrine
 * forbids, and the shape of this column is what makes it unavailable.
 *
 * AN UNGROUPED ITEM CANNOT BE MUTED BY CASE, and that is not an oversight.
 * queue_state is keyed (member_id, case_id); an item with no home has no case to
 * mute against, and inventing a pseudo-case for it would be the same invented
 * home REC-20 refuses to give it. Its way out is the ITEM form (`mutedAsItem`
 * above, D-125/D-170), keyed on the item's own id and on no case. */
export function suppressedBy(item, mutes) {
  if (!item || !mutes || mutes.size === 0) return null;
  const kind = item.kind;
  if (typeof kind !== "string" || !kind) return null;
  const homes = (item.case && Array.isArray(item.case.ancestors)) ? item.case.ancestors : [];
  for (const a of homes) {
    const set = mutes.get(a && a.id);
    if (set && set.has(kind)) return a.id;
  }
  return null;
}
