Length: 87 lines. Last section: "Suggestions".

# plan-work: requirements

Next number: 20

**Size (P6).** About 1,800–2,300 lines: per-matter outcome and state, the timeline, reviews, preparation items, comments, where it stands, status reports, taking up, the watch registration, the re-examination driver and the promise-duties read.

## Public

### Purpose

(T45; N855, N881, N890; Actions D14, D21, D27; v0.2 rules 1, 16, 17, 18, 20) The work of managing a plan as it goes and handing it over: what the group wants of each matter and how far it has gone, one timeline, reviews, preparation taken up, comments, "where it stands", status reports, taking up an item, and the re-examination a recorded response sets off. A member does every act; the machine marks and assembles, labelled. Nothing here is published (DEC-25) or scored, and nobody assigns anybody.

### Provides

Terms. A **plan**, its matters (subjects), options, scenarios, phases and checkpoints are `action-plans`' (its Terms); a **matter** is named `{plan, subject}`. A refusal is `{ok: false, reason, ...}`; `NO_SUCH_PLAN` is answered through `action-plans.noSuchPlan` (its R22), and every act refuses a machine or unstamped author `MACHINE_CANNOT_PLAN` first.

**Each matter: matterOutcomeSet, the matter's state** (N890; D27)
- **R1** [met] (T45; N890; Actions D27; v0.2 rule 20) `matterOutcomeSet({plan, subject, text, author, viewer})` (`op=matteroutcomeset`) records the group's intended outcome for a matter, 1 to 1,000 characters (R4's text rule of `action-plans`), each revision kept with who and when. Refusals in order: `MACHINE_CANNOT_PLAN`; `NO_SUCH_PLAN`; `PLAN_CLOSED`; `MATTER_NOT_OF_PLAN`; `PLAN_NO_REASON` for a malformed `text`. Control: a second statement keeps the first in history.
- **R2** [met] (T45; N890; Actions D27; v0.2 rules 17, 19, 20) Each matter's **state** is derived on read, the first that holds of: `ended` (its escalation ended, `escalation.escalationsFor`), `fixed` (a standing cure linked to its determination, `conformance.curesOf`, its R37), `stopped` (its escalation `stopped_pursuing`, `escalation` R31), `acting` (another outward action of the plan sent), `fix_offered` (a `chance_to_fix` communication sent, `filings` R38), `documented` (a `document_infraction` version approved, `filings` R37), else `none`. Never a percentage or score. Control: each state from a fixture, and the order when two hold.

**planTimeline, reviews** (N890; D27)
- **R3** [met] (T45; N890; Actions D27; v0.2 rule 20) `planTimeline({plan, nowMs, viewer})` answers every act the group did on the plan's actions (sendings, receipts, moves) and every coming date (clock entries with basis and `owed_by`, `action-clocks` R3, R18; phase starts and checkpoints; proposed escalation stages, `escalation` R2), in date order, and `next`, the coming dates from `nowMs`, at most 10. What the viewer may not see is withheld whole. Writes nothing.
- **R4** [met] (T45; N890; Actions D27; v0.2 rule 20) `planReviewRhythm({plan, recurrence, author, viewer})` sets or (with `null`) removes a member's repeating review reminder (`civil-time`'s recurrence subset; malformed `REVIEW_RHYTHM_REFUSED`); `planReviewsDue({nowMs, limit?})` answers one item per due review, told once, for `action-producers` (`plan-review-due`); `planReviewOpen({plan, viewer})` answers what changed since the last review entry (responses recorded, dates passed, marks); `planReviewRecord({plan, decided, author, viewer})` records a dated review entry, `decided` 1 to 4,000 characters. No rhythm, no item. Control: a plan with no rhythm is never due.

**Preparation items and comments** (N890; D27 A, C)
- **R5** [met] (T45; N890; Actions D27 A; v0.2 rule 20) `prepItemAdd({plan, option, text, author, viewer})`, `prepItemTakeUp({plan, item, target?, author, viewer})` (the author takes it up herself, with her own target date) and `prepItemDone({plan, item, author, viewer})`, each visible to whoever sees the plan. A key naming another member, or `assignee`, is refused `OPTION_KEY_REFUSED` (`action-plans` R26). Control: a take-up with `for` naming another member is refused.
- **R6** [met] (T45; N890; Actions D27 C; v0.2 rule 20) `planComment({plan, on: {option} | {action} | {draft}, text, author, viewer})` (1 to 4,000 characters) and `planComments({plan, on?, viewer})`: under the plan's sight, never published, never reachable from any public read. Control: an outsider reads the plan's comments as absent.

**Where it stands; status reports; watches** (N855 (D6d), N881; D14; v0.2 rules 17, 18)
- **R7** [met] (T45; N881; Actions D14; v0.2 rule 18) `whereItStands({plan, nowMs, viewer})` answers each wait with its basis, the next dates (R3), the holds on the plan's actions and project (`action-holds.projectHolds`, `holdsDue`, its R7, R3), overrides with reasons, declined options and set-aside scenarios with reasons, escalations with their state, and the watches with their end dates (R9). At start this module registers it with `action-plans.registerCloseSnapshot` (its R44) as the closing summary. Writes nothing.
- **R8** [met] (T45; N881; Actions D14; v0.2 rule 18) `statusReportDraft({plan, nowMs, viewer})` answers a sourced list assembled by the system from R7, each item naming its source, labelled machine work; no assistant text (its arm is left out of T45). `statusReportSave({plan, text, from?, author, viewer})` keeps a member's report (1 to 8,000 characters) with the plan, never required, never published. Control: a draft carries no sentence that is not one of R7's items.
- **R9** [met] (T45; N855 (D6d), N881; v0.2 rule 17; reconciliation R13) `registerWatchReader(module, fn)`: one registration, filled by `following` (`membership.listenerRefusal`); `fn({plan, viewer})` answers the watches the plan set running with their end dates, read by R7. A reader that throws reads the watches `undetermined`. Control: a second registration is refused.

**Re-examination** (D21; v0.2 rules 1, 16)
- **R10** [met] (T45; Actions D21; v0.2 rules 1, 16; Capability Ladders §2) At start this module registers with `actions.registerResponseListener` (its R95). On each recorded response on an action in a project, it re-examines every open or paused plan of that project and of the projects linked to it by `arose_from` both ways (`action-replies.aroseFrom`, `arisenFrom`, its R2): options whose regulated date or premise changed, phases whose start now holds, the procedure guide's next routes for that kind after that outcome (`reading-guides` R13 over the view's `after`, `jurisdictions` R87 (d)), written through `action-plans.planMark` (its R43, in its mark kinds) only; the chance to fix re-offered is `action-plans` R41's derivation on read, never marked here (K2848). Where AI is enabled, it opens one planning run with `origin: "reexamination"` and the response as `"<action id>#<ord>"` (the action's bundle id and the entry's position in its `correspondence[]`; K2820) (`ai-runs` R77) inside the recording act, on the account Capability Ladders §2 names for it (the project's own account where it holds one, else the recording member's), within its limits and the project's and group's settings. No disposition, scenario, judgement or start changes. Control: a response in an unlinked project marks nothing; dispositions are byte-identical before and after.

**Taking up an item** (N881; D14; v0.2 rule 18)
- **R11** [met] (T45; N881; Actions D14; v0.2 rule 18) `itemTakeUp({item, author, viewer})` (`op=itemtakeup`), `item` one of a clock entry `{action, entry}`, a checkpoint, a proposed escalation stage or a hold: a member who can see it routes its to-dos to herself from then. Refusals: `MACHINE_CANNOT_PLAN`; `NO_SUCH_ITEM` (absent or invisible alike); `OPTION_KEY_REFUSED` for any `for` naming another member. `takeUpsFor({after?, limit?, viewer})` answers the take-ups for `action-producers`. Nobody assigns anybody. Control: a take-up by the member herself lands.

**A matter's promise-duties** (reconciliation R18)
- **R13** [met] (T45; N855 (D6d); Actions D6d, D7; v0.2 rule 17; reconciliation R18) `matterPromiseDuties({plan, matter, viewer})` answers the adopted duties arising in the captures of the `received` entries of the plan's actions serving the matter, through `duties.dutiesArisingIn` (its R31), with its `all_met` and `partial`; `MATTER_NOT_OF_PLAN` for a matter the plan does not hold. `following` reads it for the once-only watch question. Writes nothing; never throws. Control: a matter with no promise answers `all_met: false` with no duties.

**The assistant's status report; when the promises were met** (T46)
- **R14** [met] (T46; N920; amends R8; `build/plan/study-T46-assistant.md` §2) R8's assistant arm: `statusReportAssist({plan, nowMs, viewer})` (`op=statusreportassist`, an `ownread`, apart from `statusreportdraft`, R8's system list) gathers the items the assistant drafts a status report from: past sight (a plan the viewer may not see answers `NO_SUCH_PLAN`, absent alike) it answers R8's items, each with its source, exactly as `statusReportDraft` assembles them, and nothing else. This module answers no AI refusal, drafts nothing itself, calls no model and has no edge to `run-rules`: the plane's draft door gates the draft (its part, flag, account and limits; `store-assembly` R50) and answers its refusals, `AI_PART_NOT_DEPLOYED` among them, then hands these items to the assistant. `statusReportSave`'s `from` records that the text began as the assistant's draft, labelled machine work (`record-grammar`'s `proposalLabel`); the report kept is the member's, never required, never published (R8). Control: a plan the viewer sees answers exactly R8's items; one she does not see answers `NO_SUCH_PLAN`.
- **R15** [met] (T46; N921; amends R13; `following` R24) `matterPromiseDuties` also answers `met_at`: when `all_met`, the instant the last of those duties was read met (the latest of their occurrences' `met` or `met_late` readings, as `duties` answers their recorded transitions, its R9), else null; so `following` R24's `promises_met` reads one source here, never deriving it from `duties.occurrencesOf`. Control: two duties met on different days answer the later instant; with one unmet, null.
**The report's label; the promises' instant; a due review's facts** (T47)
- **R16** [met] (T47; N956; amends R14, R8; `record-grammar` R61) A status report that began as the assistant's draft (`statusReportSave`'s `from`) is labelled `record-grammar`'s `proposalLabel(by, "status_report")`, its state and sentence that subject's (a draft of a status report kept with the plan, never published; for a machine, the assistant's draft, machine work), at its one site, in place of the interim label (K2978). The report kept stays the member's, never required, never published. Control: a report saved from the assistant's draft reads `machine_proposed` with `record-grammar`'s `status_report` sentence; one written by the member alone carries no draft label.
- **R17** [met] (T47; N966; amends R13, R15) `matterPromiseDuties({plan, matter, nowMs?, viewer})` takes `nowMs`, the instant the duties are read as of (`duties.dutiesArisingIn`'s `asOf`; this module's clock when absent). R15's `met_at` is, for each occurrence of the duties, the `as_of` of the first reading of the unbroken run of `met` or `met_late` readings that ends its recorded transitions (`duties.transitionsOf`, its R13, R14), and of those the latest; it is never an instant taken from the derivation. When `all_met` holds but `met_at` cannot be stated (an occurrence whose recorded readings do not end met, or readings that cannot be read), the answer carries `met_at: null` and `met_at_why`, a sentence saying why; `met_at_why` is absent whenever `met_at` is an instant or `all_met` is false. Controls: an occurrence read `overdue`, then `met`, then `met` again answers the first `met` reading's `as_of`; one whose last reading is `overdue` answers `met_at: null` with its why.
- **R18** [met] (T47; N968; amends R4; `action-producers` R12, `queue.plan-review-due.detail`) Each item `planReviewsDue` answers also carries `recurrence`, the rhythm as the member set it (R4's recurrence, with who set it and when), and `since`, `{day, from}`: the local day of the plan's last review entry (`from: "review"`), else the local day the rhythm was set (`from: "rhythm_set"`), each in the rhythm's zone. Its other fields, its order and its "told once" are unchanged. Controls: a plan reviewed once answers that review's day; one never reviewed answers the day its rhythm was set.

## Private

### Uses

- `action-plans` (L9, earlier): `planRead`, `noSuchPlan`, `planMark`, `registerCloseSnapshot`, the offers (its R6, R22, R43, R44, R41).
- `actions`: `actionRead`, `actionsFor`, `registerResponseListener` (its R95; R3, R10).
- `action-holds`: `projectHolds`, `holdsDue` (its R7, R3; R7).
- `action-replies`: `aroseFrom`, `arisenFrom` (its R2; R10).
- `action-clocks`: `overdueClocks`, `ourDeadlines` (its R3, R18; R3, R7).
- `escalation`: `escalationsFor`, `escalationRead` (its R22, R2; R2, R3).
- `filings`: `filingsFor` (its R13; R2's `documented`, `fix_offered`).
- `conformance`: `curesOf` (its R37; R2).
- `duties`: `dutiesArisingIn` (its R31; R13); `transitionsOf` (its R13, R14; R15's `met_at`, K2980, K2993).
- `reading-guides`: the procedure guide (its R13; R10).
- `ai-runs`: `open` with `origin: "reexamination"` (its R77; R10).
- `civil-time`: the recurrence subset, `localDay` (R4).
- `membership`: `viewerPredicate`, `listenerRefusal` (R9). `record-core`: `transact`, `stampInstant`, `declarePurge`. `record-grammar`: `isMachineIdentity`, `proposalLabel` (R8).

Every edge points earlier (this module 127). `following` (L10) registers with R9 and reads R13; `action-producers` (L11) reads R4, R11 and `action-plans` R40.

### Invariants

- **R12** [met] (T45; v0.2 rule 1; DEC-25) A machine writes nothing here but R10's marks (through `action-plans` R43) and labelled assemblies (R8); every table is append-only and declared to purge (K23); no field holds a cost, hours, assignee or score; nothing is reachable from publication or any public read; no place is named in this module's behaviour or outward text.

### Satisfies

- `BIO_Action_v0_2.md` §3 (action plan), §4 rules 1, 16, 17, 18, 20 (K2780; T45, N893): per-matter outcome and state (R1, R2), the timeline and reviews (R3, R4), preparation and comments (R5, R6), where it stands and status reports (R7, R8), the watches (R9), re-examination on each response (R10), taking up (R11), promise-duties for the watch question (R13); Actions D14, D21, D27.

### Suggestions

- Rows: this module's refusals (`MATTER_NOT_OF_PLAN`, `REVIEW_RHYTHM_REFUSED`, `NO_SUCH_ITEM`) take a new family at the job's stamp, translations BOB's drafts, the UX stream's to revise.
- N881's assistant status report (`statusreportdraft`, its `run-rules` reach and grant op; R8's assistant arm) joins T46 (plan, "Left out").
- Tests: each refusal with its control; R2 each state; R10 marks only, and the run on the recording member's account when the project holds none.

- **R19** [met] (T51; K4168; the T51 declaration pass; op-declarations R80, R81; op-grades R49, R50; test-support R15) **The module declares the ops it serves that the screens send.** `DECLARED_OPS` is exported beside the ops map: a frozen object keyed by the op's door name, each row `{classes, machineClasses?, mutating, weight, description, fields: {accepts, requires}}`, its class, weight and description copied from the op's existing rows and its fields read from the arm whole (the stamps and the shell's `reason` are not accepts unless the arm reads a `reason` of its own): `itemtakeup`. Test: `declaredOpHolds` for each, with only its requires, without each, and with a field outside its accepts (`declared-ops.test.mjs`).
