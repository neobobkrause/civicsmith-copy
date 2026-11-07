# Requirements: case making and action modules (at tranche 705f8823)

Research for the `publication` design lane (area "Publication & action", K2433). Read-only. Every cite is `path:line` at 705f8823d124a6c134cf5af3aa5aa297c8da18c4 or a requirement id. Paths are relative to the repository root. "Inference" marks what I conclude and the files do not state.

**How to read the marks.** A requirement not yet met is marked right after its id, `*(not yet met: <row>)*` (build/requirements/README.md:9). Ledger entries (`process/ledger/<id>.json`) carry `layer`, `paths`, `tests`, `uses`, `status`, `prior_work`. None of them has a `marks` or `notices` field. Provider notices appear only in `prior_work` text and titles.

**History caveat.** `git log -3` on every file stops at `47d7bf1d` "Merge job PR 361" (4 Nov 2026). That commit has no parent (`git log -1 --format=%P` is empty), so it is the root of this history. Changes before 4 Nov exist only in each file's **Status** line. The commits after it are listed per module.

---

## 1. Per module

### case-account (layer 8)
- **Purpose.** A case's account: the system's drafts of it, which never become the account; a member's own advocacy check; each sentence and the four statements judged against what they cite (build/requirements/case-account.md:24-26).
- **Ledger.** Layer 8, **OPEN** (14:20Z, 6 Nov). Title: "confirm its requirements on layer 8 (ledger entry written at layer 8 open; no unmet mark)". prior_work: run the suite, cite tests, fix reds within its paths (process/ledger/case-account.json).
- **Uses.** record-grammar, record-core, membership, inquiry, content, extraction, publication, case-grammar, ai-runs, case-disclosures, test-support, project-roster, case-checker, basis-versions, setup-words, retrieval.
- **Key ids.**
  - R1: `accountPropose` stores a labelled draft that is never the account (:34-40).
  - R2: `account_check` flags (:41).
  - R3: `accountDrafts` (:42).
  - R4: `accountDraftJudged`. Taking a draft up `as_proposed` is refused `ACCEPT_MUST_REAUTHOR`, and `acceptanceRecorded` records how it was taken up (:46-51).
  - R5: the account's shape (:55-59).
  - R6: `accountJudged` over the sentences, the four statements and carried outcomes, failing closed with `ACCOUNT_CHECK_UNDETERMINED` (:60-66).
  - R7: reviewers' comments, chosen by the publisher. "a reviewer left out may file a response in the case's docket" (:70).
  - R13: advocacy check, kept in her own hidden project, carrying no mark (:74-84).
  - R14: a counsel matter is never evidence (:88).
  - R15/R16/R17: ops and words by key. The left-out count in the signed bytes is frozen per format (:92-101).
  - R8–R12: invariants (:97, :126-129).
- **Open marks.** None.
- **Recent changes.** `47d7bf1d` only. Status: T46 R15/R16 met (K2969); T47 cites re-pointed (:3).

### case-authoring (layer 8)
- **Purpose.** `op=publish`: the owner prepares a case. The module judges the preparation, authors the document text and stores it **unsigned** in `publication`. It runs the signing pre-flight (case-authoring.md:9).
- **Ledger.** Layer 8, COMPLETE (5 Nov 12:36Z). Title: "restate its tests for case-grammar's format /10". Its paths include `docs/requirements-notes/case-authoring.md`. Uses: 48 modules, including publication, ratification, case-import, case-inputs, case-account, case-disclosures, case-tensions, publish-schedule and doorbell.
- **Key ids.**
  - R1–R11: refusal order. R1 machine; R2 authority; R3 authored fields; R4 members; R5 roles; R6 bar; R7 case identity; R8 already a member; R9 draft; R10 freshness; R11 searched section (:17-27).
  - R14: the document's contents. It still names `/7`, and says the format is declared "/9 only when a row carries a sha, else /8" (:30).
  - R15: the answer (:31).
  - R16, R86: citations (:32, :74).
  - R18: synchronous, writes only inside the caller's transaction (:34).
  - R32: `tensionsToDisclose` (:46-49).
  - R34: `publishPreflight`. It runs `ratification.caseRatifyPreflight` and answers `{ready, first, blockers, steps}`, with the steps' words owed to the UX stream (:53).
  - R38: what changed (:138).
  - R40: lens printed (:143).
  - R41/R42: `working_on`, and the "sealed weeks" sentence (:147-148).
  - R55: the disclosures order (:170-186).
  - R56/R57: calculations and timeline. The `we_did` lane is public only (:190-191).
  - R58: `CASE_EDITION_WAITING` (:195).
  - R63–R69: account, review comments, approvals (:213-227).
  - R72: counsel matter never published (:252).
  - R74: carried outcomes (:236).
  - R75: `publish_at` offered at the sign step (:244).
  - R76: `tieAttested` (:248).
  - R77: minutes at signing (:61).
  - R78–R83: draft-filled fields, declared ops, `PUBLISH_NO_FINDING`, `draftEditions` (:65-70).
  - R85: `copyNow` (:73).
  - R88–R91 (T53): ungraded passages listed at signing (never blocks), stated in the document, never refused; R91 names which field was carried forward (:79-82).
- **Open marks.** No `*(not yet met)*` line. **F2 is open** (:277-279): the real `op=publish` document lacks the `ungraded_passages`/`typed_passages` blocks, so ratification's gate finds `UNGRADED_PASSAGES_MISMATCH` on every real publish. Eight store-request tests are red at tranche. The cause is located at `bio-plane/src/case-authoring/document.mjs:183-184`.
- **Recent changes.**
  - `d48c0cee` 5 Nov: R88/R89/R90.
  - `37fb882e` 5 Nov: consolidated under the cap. Notes moved to `docs/requirements-notes/case-authoring.md`; ids unchanged.
  - `47d7bf1d`.

### case-catalogue (layer 8)
- **Purpose.** The pure case-document catalogue: C-41.1–C-41.19 and the case arms of C-2.8, C-3.1 and C-21.1. `ratification` registers it and runs it at its gates (case-catalogue.md:11).
- **Ledger.** Layer 8, COMPLETE (4 Nov). Uses: record-grammar, strength, case-grammar, setup-words, text-chain.
- **Key ids.**
  - R1: `checkCaseDocument`; C-41.16 checks "What changed" (:15).
  - R2: the case-member arm (:16).
  - R3: `working_on` (:17).
  - R6: member references (:18).
  - R7: C-41.18 `UNGRADED_PASSAGES_MISMATCH`, its translation the UX stream's words (:22).
  - R8: C-41.19 `TYPED_PASSAGES_MISMATCH` (:23).
- **Open marks.** None. "Open for Bob: None" (:55-57).
- **Recent changes.** `47d7bf1d` only.

### case-grammar (layer 8)
- **Purpose.** The one spelling of the case document: formats and predicates, blocks, section locators, signed citations, the case file and the complete edition (case-grammar.md:11).
- **Ledger.** Layer 8, COMPLETE (4 Nov). Title: "its unmet T53 requirements, R1, R35, R36, R37, R38, R39". Uses: record-grammar, calc-grammar, strength, setup-words, text-chain.
- **Key ids.**
  - R1: formats `/1`–`/9` and the predicates (:17).
  - R2/R3: attribution and section locators (:21-22).
  - R8/R9: what changed; lens (:31-32).
  - R12–R14: materials, case file `bio-case-file/3`, and the complete edition. Its words are the UX stream's (:43-99).
  - R15: standing line (:100-105).
  - R23–R26: account, bias applications, review comments, approvals (:141-144).
  - R29: outcomes block. Its heading key is `case.outcomes.head` (:176-182).
  - R33: `/8` "team" words, frozen per version (:184-195).
  - R34: basis version (:196).
  - R35: `/10`; "`caseDocumentFormatFor` answers `/10` always" (:200).
  - R36: ungraded block. Its sentences are frozen per version, with keys `case.ungraded.*` (:201).
  - R37: typed passages and credit levels (:202).
  - R38/R39: register extracts and use limits (:203-204).
- **Open marks.** None in the body. Status (:3) still says "marked not yet met (T51)" (stale; inference).
- **Recent changes.** `47d7bf1d` only.

### case-import (layer 8)
- **Purpose.** Import another group's case file into a read-only project. It recreates each finding, and lets the group accept or flag editions, regrade under a lens, rerun, and **watch the publisher's docket** (case-import.md:11, :21-25).
- **Ledger.** Layer 8, COMPLETE (4 Nov). Title: "answer its provider notice strength:176 (R46, R47) and meet any unmet mark". Uses include signatures, docket, reevaluation, accepted-work and public-read.
- **Key ids.**
  - R1: import (:29-36).
  - R2: read-only (:37).
  - R4: reads, `group_fields` (:44-58).
  - R6–R9: accept, withdraw, flag (:66-83).
  - R16/R24: registrations with accepted-work (:109-117).
  - R17: watch and docket address, `op=docketpublic&case=…&captures=omit` (:123-129).
  - R18: `recordDocketRead`. It verifies the digest, the form, `verifySshsig(… docketStatement(case, seq, digest), NS_DOCKET …)` and the chain. `key_listed: false` is kept, not refused (:133-146).
  - R19: `docket_unreadable`, "never that nothing changed" (:150-155).
  - R20: `watchItems` (:156-161).
  - R21: calculations recreated (:40).
  - R22/R23: whole-case acceptance; importer lens (:87-88).
  - R27–R33: regrade, rerun, pairing, declared ops (:92-105).
  - R34/R35: ungraded statement imported (:167-168).
- **Open marks.** **R36** *(not yet met: T53)*: "the source's ungrading is not this group's" (:202). Status (:3) claims R16, R17, R24, R25–R33 are marked not yet met; the body carries no such marks (stale; inference).
- **Recent changes.** `47d7bf1d` only.

### case-inputs (layer 8)
- **Purpose.** What other acts record before the next edition, which `op=publish` reads in (case-inputs.md:29):
  - statement acknowledgements and the statement's writer;
  - "what changed" drafts;
  - the **open-requests source at signing**, filled by action-replies;
  - **carried outcomes**, from consequences;
  - the **minutes comparisons**, filled by filings;
  - the case's standard details, which never enter the signed document.
- **Ledger.** Layer 8, COMPLETE (4 Nov). Title: "answer its provider notice case-grammar:202".
- **Key ids.**
  - R1–R5: acknowledgements (:37-41).
  - R6/R7: what-changed drafts (:45-46).
  - R8: `registerOpenRequests`/`openRequestsOn` (:50-57).
  - R9: `carryOutcome` … `pendingOutcomes` (:61-73).
  - R10/R17/R18: sign-step lines by key, including `signing.openrequest.noquote` (:77-98).
  - R19: `registerMinutesComparisons` (:102).
  - R20–R29: case details and the public read `casedetailspublic` (:106-120).
  - R16: instance and ops (:124).
- **Open marks.** None in the body. Status (:3) says T47/T48/T51 items are "marked not yet met" (stale; inference).
- **Recent changes.** `47d7bf1d` only.

### case-tensions (layer 8)
- **Purpose.** What a case says about the record after it is signed: case relation, revision flags, post-publication tensions, and attribution levels (case-tensions.md:25).
- **Ledger.** Layer 8, COMPLETE (4 Nov).
- **Key ids.**
  - R1: `caseRelation` (:33).
  - R2: flags and `dischargeCaseFlags` (:34).
  - R3: `caseFlags` (:35).
  - R4: `caseTensions`, "discloses, never blocks" (:39).
  - R5–R7: attribution, re-authoring through `publication.reauthorSection` (:43-45).
  - R12: declared op `attribute` (:87).
- **Open marks.** None. Suggestions still carry "Open for BOB: the seam runs both ways" (:80). R1/R4 read publication's tables, and R5/R7 call `publication.reauthorSection` from a module placed before publication.
- **Recent changes.** `47d7bf1d` only.

### actions (layer 9)
- **Purpose.** The Action object (State Rules §4.4): kind, risk tier, addressee, clock, basis legs, lifecycle and correspondence ledger. A member decides every move; a machine never advances one (actions.md:11).
- **Ledger.** Layer 9, COMPLETE (5 Nov 05:12Z). Title: "answer action-grammar R31 shape (acts.test.mjs:108)". Uses: 26 modules.
- **Key ids.**
  - Terms and lifecycle (:15).
  - R1/R2: write fences (:18-19).
  - R8: breach rests on a live **noncompliant** determination, or an open override (:25).
  - R9: addressee arms; never a private person (:26).
  - R12: `clock_overdue` on the local day (:31).
  - R13/R14: `actionMove` (:34-35).
  - R15–R17: `actionCorrespond` (:38-40).
  - R18: `actionLaws` (:43).
  - R23/R24: risk tier (:52-53).
  - R25: the read (:56).
  - R26: the action's own outcome (:57).
  - R43: `noSuchAction` (:72).
  - R66: event source. Under `audience: "public"` it answers only outward acts, marked `public: true`, for the case timeline; confidential and counsel-matter actions are excluded (:96).
  - R74–R76: override ground, disclosures, `basis_void` (:106-108).
  - R82: `reply_owed` (:119).
  - R95: response listeners (:123).
  - R100: `actionZone` (:138).
  - R108: minutes on a public comment (:153).
- **Open marks.** All T53:
  - R112: two laws, two clocks (:159).
  - R113: governing law stored with its layer (:160).
  - R114: records law with its layer (:161).
  - R115: office with its layer (:162).
  - R116: "move to `resolved` with no resolution refused naming it" (:163).
- **Recent changes.**
  - `f13d019e` 5 Nov: F1, the replaced list in R31's shape (:164).
  - `47d7bf1d`.

### action-clocks (layer 9)
- **Purpose.** Deadlines across actions: pending and overdue reads, proposals from profile rules (stored apart), reminders only as asked, the iCal file, and the group's own lateness (action-clocks.md:11).
- **Ledger.** Layer 9, COMPLETE (4 Nov). Title: "answer jurisdictions' notice (R119, PR 40: federal FOIA offices)".
- **Key ids.**
  - R1: `pendingClocks` (:18).
  - R2: `clockPropose`, counted from receipt or service (:21).
  - R3: `overdueClocks`, "a question about a date, never a finding" (:24).
  - R4–R6: reminders (:27-29).
  - R7: every deadline names its basis; `stated` is never legal (:85).
  - R8: nothing reminds unasked (:86).
  - R13: `clockAdopt` (:39).
  - R15: lateness, only the group's own (:41).
  - R16–R18: one date, one reminder; `owed_by` (:44-46).
  - R21–R23: zone, `dueAtOf`, venue (:51-53).
  - R24: `clocksRunning` (:56).
  - R26: `remindersfor` (:119).
  - R27–R29 (T53): layered lists and rules (:60-62).
- **Open marks.** None in the body. R27–R29 carry no marks. Status (:3) still says "not yet met (T47)" (stale; inference).
- **Recent changes.** `47d7bf1d` only.

### action-grammar (layer 9)
- **Purpose.** The pure grammar of an action document: vocabularies, the C-2.10/C-6.1/C-11.1 arms, the readers `actions` answers with, the phrasing lists and finder, and the rows (action-grammar.md:11).
- **Ledger.** Layer 9, COMPLETE (5 Nov). Title: "its unmet requirements (T53)". prior_work is null.
- **Key ids.**
  - R2: vocabularies, `RESOLUTIONS` (:19).
  - R5: lifecycle grammar (:28).
  - R6: a request for comment names its inquiries and a window (:31).
  - R7: audit arm (:34).
  - R15: override ground (:41).
  - R16–R19: phrasings, `pointOut`, assertion resolutions (:44-47).
  - R24: `bearingFindings` (:54).
  - R26: words by key; four rows returned to BOB (:57).
  - R30: no field or code names in member text (:84).
  - R31 (T53): readers keep `layer` (:61).
- **Open marks.** None.
- **Recent changes.**
  - `d0def7c5` 5 Nov: R31.
  - `47d7bf1d`.

### action-holds (layer 9 per build/modules.json:151; **no ledger entry**)
- **Purpose.** Litigation holds and pressure. Members:
  - mark pressure;
  - place and release holds at an action, entry or project;
  - record that the hold notice was sent.

  A hold stops a purge, a scheduled publication and a doorbell clearance. Nothing records a member's compliance (action-holds.md:11).
- **Uses** (modules.json:151). actions, record-core, membership, provenance, civil-time, **docket**, **publication**, project-roster, doorbell, **ratification**, action-grammar, record-grammar, action-records, local-facts, setup-words, test-support.
- **Key ids.**
  - R1: pressure mark (:18).
  - R2: hold at a place, `from` a pressure mark, pressure record, docket `legal` mark (`docket.docketPressureOf`) or counsel matter (:19).
  - R3: `holdsDue`, including docket marks (:20).
  - R4: doorbell reader (:21).
  - R5/R6: release and preview (:22-23).
  - R9: `purgeHeld` (:31-37).
  - R10: `ratification.registerHoldReader`, so a hold stops a scheduled publication (:38).
  - R11: `holdNoticeSent` (:41).
  - R12: `pressureRecord` (:42).
  - R18: profile fact on a `threat_letter`, "legal information, not legal advice" (:53).
  - R22: `holdsPlaced` (:55).
- **Open marks.** None in the body. Status (:3) says not yet met through T51 (stale; inference).
- **Recent changes.** `47d7bf1d` only.

### action-plans (layer 9)
- **Purpose.** A project's plan for its matters: options (proposed or added), choice, scenarios, checkpoints, starting an action, pause and close. It is never published (action-plans.md:11).
- **Ledger.** Layer 9, COMPLETE (4 Nov). Title: "answer its provider notices" (ai-runs:96, `principal_ai`).
- **Key ids.**
  - R1–R3: open (:18-20).
  - R9–R12: options and proposals (:32-35).
  - R13: dispositions (:38).
  - R14–R17, R38: scenarios and checkpoints (:41-45).
  - R18: `optionStart` composes and promotes the action and sets reminders (:48).
  - R37: preview (:51).
  - R19: checks inform, never refuse (:54).
  - R20: close, with summary and lessons (:57).
  - R29: reminders (:63).
  - R30–R34: planning run, tray, disclosure (:66-69).
  - R39–R45: set-aside, paused, infraction offers, "document first, never a gate", machine marks (:72-78).
  - R51: `planAsk` (:88-92).
  - R54: start records the option's tier on the action (:181).
  - R25: never published (:132).
- **Open marks.**
  - **R55** (idem retries) and **R56** (`produced_by`), both *(not yet met: T53)* (:102-103).
- **Recent changes.** `47d7bf1d` only.

### action-producers (layer 11)
- **Purpose.** The feed's Action-layer to-dos. They are derived on read and routed to the member who took the thing up or set it; nobody assigns anybody (action-producers.md:11).
- **Ledger.** Layer 11, COMPLETE (4 Nov). Title: "answer action-clocks' notice (R27-R29, PR 60: layered calendar paths)".
- **Key ids.**
  - R1: `action-clock-overdue`, in canon's words "Noticed: no reply recorded by <date>", never "overdue/violation" (:21-26).
  - R2: checkpoints (:27).
  - R3: escalation stage (:28).
  - R4: reminders (:29).
  - R5: litigation hold, including the **docket** and pressure-record arms (:30-36).
  - R8: released hold (:37-41).
  - R9: member who left (:47-55).
  - R10: watch keep or stop (:56).
  - R11: doors (:58-70).
  - R12: plan review and look-again (:71).
  - R21: met-or-waived door (:75).
  - R23/R24: words by key; four sentences returned to BOB (:77-90).
  - R25: `request-unsent` (:99).
  - R26: an action is named by its title, never its id (:100).
- **Open marks.** None.
- **Recent changes.** `47d7bf1d` only.

### action-records (layer 9)
- **Purpose.** The group's side records about an action, apart from its document:
  - proposals of laws, tier and what a request seeks;
  - receipt or service;
  - confidential scope;
  - promises;
  - stake;
  - opening a question from an action.

  It also holds the single-site judgments (action-records.md:25).
- **Ledger.** Layer 9, COMPLETE (5 Nov). Title: "answer provider notice action-grammar:396".
- **Key ids.**
  - R1–R3: proposals stored apart (:33-35).
  - R4: receipt and service (:39).
  - R5: confidential scope. A change never alters a signed edition (:40).
  - R6: promises; nothing published carries one (:41).
  - R7–R10: single sites (:45-48).
  - R16: the correspondence entry's one site (:52, :56-62).
  - R17: `actionStake` (:53).
  - R18: `noSuchAction` moved here (:54).
  - R19: `actionInquiry` (:55).
- **Open marks.** **R21** *(not yet met: T53)*: a proposed law keeps its layer (:70).
- **Recent changes.** `47d7bf1d` only.

### action-replies (layer 9 per build/modules.json:153; **no ledger entry**)
- **Purpose.** What a reply did: a member lays it out claim by claim, links `arose_from`, and records that a reply asks not to be quoted. It fills case-inputs' **open requests at signing** (action-replies.md:11).
- **Uses** (modules.json:153). actions, action-clocks, action-grammar, **case-authoring**, membership, record-core, record-grammar, **case-inputs**, setup-words.
- **Key ids.**
  - R1: `actionReplyBearing` and propose (:18).
  - R2/R6: `aroseFromLink` (:21, :28).
  - R3: registers `openRequestsOn` with case-inputs R8. It throws when it cannot read, so signing says "undetermined", never `[]` (:24).
  - R8: `replied` (:30).
  - R10: `actionReplyQuoting` (:34-39).
  - R11: `quotable` in each open-request row (:40).
- **Open marks.** None in the body. Status (:3) says not yet met through T48 (stale; inference).
- **Recent changes.** `47d7bf1d` only.

### screens-action (layer 11)
- **Purpose.** The Action layer's working screens:
  - `start-send`
  - `request`
  - `action`
  - `actionnew`
  - `dash-action`
  - `hold`
  - `holdnotice`
  - `counsel`
  - `help-records`
  - `due-date` (linked)

  The member decides and sends; Civicsmith "sends nothing" (screens-action.md:9). Plan and matter moved to screens-plan and screens-matter (:3).
- **Ledger.** Layer 11, COMPLETE (5 Nov). Title: "consolidate its requirements under the cap, then answer its provider notices". Its paths include `docs/requirements-notes/screens-action.md`.
- **Key ids.**
  - R2/R3: start and send. Approving fixes the text; "I have sent it · record the sending"; join first (:19-20).
  - R4: request flow (:23).
  - R5: action page. A passed date is drawn as canon's question, never "overdue" (:26).
  - R16/R17: law and risk (:59-72).
  - R19: words by key from `docs/development/ux-substrate/screens/words-reads.json` (:77).
  - R21: stake at preparation, "never a gate" (:82).
  - R24: `actionnew` (:88-95).
  - R27: read-only sentence (:98).
  - R30: `dash-action`, with several REPORTs to BOB (:101-105).
  - R31: guide, templates, pressure (:106).
  - R32–R34: hold, holdnotice, counsel (:107-109).
  - R38: reply form (:116).
  - R42: assertion resolutions at approval (:120).
  - R55: minutes fold (:133).
- **Open marks.** All T53: R60, R61, R62, R63, R64, R65, R66, R70, R72, R73, R74, R75, R76, R77, R78, R79, R80, R81 (:140-161). F1 is met (:162).
- **Recent changes.**
  - `f31e02c0` 5 Nov: F1.
  - `47d7bf1d`.

---

## 2. Cross-cutting

### (a) Where case making hands to publication, ratification and docket

**Publication (storage and sections).**
- `publishCase` stores the unsigned document through `publication.storeCaseDocument`, never over a signed one (case-authoring.md:30).
- Re-authoring goes only through `publication.reauthorSection`: acknowledgements (case-inputs.md:38) and attribution (case-tensions.md:43, :45).
- `publication`'s review provider is the draft door (case-authoring R9, :25).
- case-inputs reads `publication`'s `cases`/`case_documents` read contracts. An outcome is "pending" until a **ratified** edition's signed document holds it (case-inputs.md:69).
- `casedetailspublic` is registered with `public-read` R18 and answers `NOT_PUBLISHED` for an unsigned case (case-inputs.md:115).

**Ratification (gate and signing).**
- The pre-flight runs `ratification.caseRatifyPreflight`, with `author` as signer and machine fences. `first` is exactly what `op=publish` would refuse (case-authoring R34, :53).
- The sign step reads `publish_at` from that same call: "Publish at…" against "Publish now" (R75, :244).
- Approvals are matched by `approvalSubjectSha` through `ratification.approvalsInForce` (R68, :218; case-grammar R26, :144).
- The C-41 catalogue is registered and run by ratification at its gates (case-catalogue.md:11).
- `caseRatifyStatement` signs `bio-ratify-case <case> <edition> <docSha>` (signatures.md:27-30). `NS_RATIFY` is one of the five namespaces (signatures.md:15-16). No case or action requirement names `NS_RATIFY` directly (grep over these 16 files). The namespace a case signature uses is ratification's, not read here (inference).
- **Live break:** F2. Every real `op=publish` document fails ratification's C-41.18 gate, because case-authoring does not write `/10`'s blocks (case-authoring.md:279; case-catalogue R7, :22; case-grammar R35/R36, :200-201).
- A hold stops a scheduled publication: action-holds R10 registers `holdsOn` with `ratification.registerHoldReader` (action-holds.md:38).
- `publish-schedule`'s waiting edition refuses a new preparation (`CASE_EDITION_WAITING`, case-authoring R58, :195).
- R42: publishing opens a project's sealed weeks; the sentence is owed to the UX stream (:148).

**Docket.**

*In (case-import):*
- A member watches an imported case's publisher docket at `publisher?op=docketpublic&case=…&captures=omit` (R17, case-import.md:129).
- `monitoring` fetches it and `recordDocketRead` verifies each entry (R18, :137-142):
  - digest and form: `civicsmith-docket-entry/1` or `civicos-docket-entry/1`;
  - signature: `signatures.verifySshsig(signature, docketStatement(case, seq, digest), NS_DOCKET, …)`. `docketStatement` is `bio-docket <caseId> <seq> <sha>\n` (signatures.md:35-36), and `NS_DOCKET` is `"bio-docket"` (signatures.md:18);
  - chain: `previous`.
- Unlisted keys are kept, labelled `key_listed: false` (:139).
- Moves (`edition`, `withdrawal`) call `reevaluation.citedCaseMoved` (:144).
- A failed read says `DOCKET_UNREADABLE`'s sentence, never "nothing changed" (R19, :152).

*Out (this group's own docket):*
- case-account R7 tells a reader that a reviewer left out "may file a response in the case's docket" (case-account.md:70).
- case-authoring R57 states that leaving deliberation, confidential acts and counsel matters out of the `we_did` timeline is the producers' job (`actions` R66, `docket` R26), "never a filter here" (:191).
- Docket `legal` pressure marks (`docket.docketPressureOf`/`docketPressureMarks`, its R27) can carry a litigation hold. They appear in `holdsDue` and become the `litigation-hold::docket::<entry>` to-do (action-holds R2/R3, :19-20; action-producers R5, :31-32).

**Action → case (what actions feed into the next edition).**
- Open requests for comment, read at signing: action-replies R3 → case-inputs R8 → case-authoring R34. They are never a blocker or `first` (case-authoring.md:53; case-inputs.md:50-57).
- Minutes comparisons: `filings` → case-inputs R19 → case-authoring R77 (:61).
- Carried outcomes: `consequences` `op=outcomecarry` → case-inputs R9 → case-authoring R74, judged by case-account R6 as `kind: outcome` (case-inputs.md:62; case-authoring.md:236; case-account.md:66).
- Public `we_did` timeline items come from actions R66 with `public: true` (actions.md:96; case-authoring.md:191). A confidential scope (action-records R5) changes R66 from then on and never a signed edition (action-records.md:40).

### (b) The action lifecycle as the requirements define it

1. **Plan** (optional).
   1. `planOpen` on matters (R1–R3).
   2. Options: added, proposed (stored apart and labelled), or adopted (R9–R11).
   3. `optionDispose` `chosen`, with reminders the member sees (R13, R29).
   4. Scenarios and checkpoints judged by a member (R14–R16).
   5. A "document the infraction first" reason is required for other outward options (R42).

   Source: action-plans.md:18-63, :75.
2. **Start.**
   1. `optionStartPreview`, then `optionStart`, which composes an action document: kind, addressee, clock from the option's regulated dates, `rests_on` legs, plan and option link (action-plans R18/R37, :48-51).
   2. Or directly: `actionCreate` (actions R47, :76), drawn on `actionnew` and `request` (screens-action R24, R4).
   3. A breach action needs a live noncompliant determination, or an override `{ground, reason}` that every prepared text discloses (actions R8, R74, R75, :25, :106-107).
3. **States.** `planned → active | abandoned`; `active → awaiting_response | resolved | abandoned`; `awaiting_response → active | resolved | abandoned`. `resolved` and `abandoned` are final (actions.md:15). Moved only by `actionMove` with a reason (R13/R14, :34-35). `resolved` needs one of `complied, denied, escalated, withdrawn, completed` (R7, :24); R116 (T53) has not met its "no default" requirement (:163).
4. **Prepare and send.**
   1. `communicationprepare` / `filingprepare`.
   2. `filingapprove`, which fixes the text, and a second approval where asked.
   3. `filingrecordsent`: the member sends by the office's means.

   Source: screens-action R3 (:20). Recording the sending is a `sent` correspondence entry (actions R15, :38).
5. **Clock.**
   - Entries name their basis: `rule | commitment | dependency | window | stated` (action-clocks R7, :85).
   - Profile rules are proposed apart and adopted by a member (R2, R13).
   - A rule counts from the receipt or service recorded (action-records R4, :39; action-clocks R2, :21).
   - Overdue is derived on read, in the action's one zone (actions R12, R100).
   - The only machine write is `pending → overdue` (actions R33/R98, :194-195).
   - The feed says "Noticed: no reply recorded by <date>" (action-producers R1, :25).
   - Reminders fire only as asked (action-clocks R4–R8).
6. **Replies.**
   - `received` entries carry stage, outcome, quote, `office_status` and `found_elsewhere` (actions R15, R81, R83; action-grammar R4/R5/R22).
   - A member lays the reply out claim by claim; the reply may be marked not quotable (action-replies R1, R10).
   - A recorded response triggers re-examination through registered listeners (actions R95 → plan-work R10). That writes only machine marks on the plan (action-plans R43, :76).
   - `reply_owed: false` stops non-response entries (actions R82).
7. **Follow-ons.**
   - `follows_action` (actions R86).
   - Escalation (action-producers R3).
   - `arose_from` (action-replies R2).
   - `actionInquiry` (action-records R19).
   - Pressure and holds (action-holds).
8. **Outcome.** The action's own outcome (actions R26). A success record can be carried into the case's next edition (case-inputs R9 → case-authoring R74).

### (c) Owed to design (UX stream, a design lane, publication-design)

**Lane facts.**
- `process/config.json:38-42` lists the lane `publication` with dir `docs/development/publication-design/` and module `publication-design`.
- There is **no** `build/requirements/publication-design.md` and no ledger entry for it; only `ux-design.json` exists among design ledgers.
- No case or action requirement names `publication-design` or any design lane. They all say "UX stream", "design stream" or UX-DESIGN.
- The folder's README says this lane owns it and qualifies through `docs/development/publication-design-research/` (docs/development/publication-design/README.md:3-9).

**Words and screens the requirements say are the stream's.**
- **case-authoring**
  - R34: the "what becomes permanent" steps and republication sentence (:53).
  - R34: `signing.openrequest.*` keys (:53).
  - R42: the sealed-weeks sentence (:148).
  - R89: the fixed "published with these passages not graded" sentence (:80).
  - Suggestions: the pre-signing preview screen (H9b, :262) and the timeline's set (T33-69, "the design stream's", :264).
  - R29: `STANDARDS_USE_REFUSED`'s member words (:124).
  - C-44.6's words (:205).
- **case-grammar**
  - R14: the complete edition's words and headings (:84, :93).
  - R15: the standing line (:105).
  - R29: `case.outcomes.head` and `case.outcome.*` (:180).
  - R36: `case.ungraded.*` (:201).
  - R37: `case.typed.*` and the per-level credit phrases (:202).
  - R31: the design stream may re-word the `obscured` labels (:59).
  - All of R36/R37's words are frozen per format once given (R33's rule, :187).
- **case-catalogue.** R7's C-41.18 translation: "BOB's draft, UX stream's words" (:22).
- **case-import.** Origin marks and "recreating is not endorsing" (:20); the C-130.17+ key list (:198).
- **case-inputs.** `signing.openrequest.noquote` asked of UX-DESIGN (:3); the details sheet's labels and outward-act note (:119).
- **action-producers.**
  - `queue.action-clock-overdue.ours/theirs` words (:25).
  - Four keyed sentences returned to BOB (:84).
  - The `venue: null` arm returned "to BOB for the design stream" (:88).
  - `door.clockentrystate` name returned to the design stream (:83).
- **actions / action-grammar.**
  - C-8's UI half "went to UX-DESIGN by NOTICE" (actions.md:221).
  - Translations are "the UX stream's to revise" (action-grammar.md:76).
  - Four rows returned to BOB (action-grammar R26, :57).
- **action-plans.** The start sketch's screen (:162).
- **screens-action.**
  - R14: an ASK to UX-DESIGN for undrawn elements (:48).
  - R19: keys from `docs/development/ux-substrate/screens/words-reads.json` (:77).
  - R24: REPORTs to BOB on one "Who" field against R9's arms, and on the missing `description` field (:90, :94).
  - R30: REPORTs on readings with no key, an undefined "replies to read", and `dash-action` doors not written (:101-103).
  - R74, R80: "Words owed" (:154, :160).
  - R61: tagged UX-DESIGN (:141).

### (d) Contradictions and gaps across modules

1. **Format in force.** case-authoring R14 still describes `/7`, with the format declared "/9 only when a row carries a sha, else /8" (case-authoring.md:30). case-grammar R35 says `/10` "always" (case-grammar.md:200). F2 confirms the code still writes the old document (case-authoring.md:279).
2. **Inside case-grammar.**
   - R35 says `caseDocumentFormatFor` "answers `/10` always" (:200).
   - R38 says a document with no extract field "keeps `/8` or `/9` and its bytes", and one with an extract "declares the next case-document format (`/10`)" (:203).
   - Both cannot hold.
3. **R89 has no mark, but F2 shows it unmet.** case-authoring R88–R90 carry no `*(not yet met)*` mark (:79-81), yet F2 says the real document lacks the block (:279). The ledger entry for case-authoring is COMPLETE, and its prior_work names only the `/10` test restatement (process/ledger/case-authoring.json).
4. **Stale status lines.** The status lines of these files claim "not yet met" ids that carry no mark in the body:
   - case-grammar.md:3
   - case-import.md:3
   - case-inputs.md:3
   - action-clocks.md:3
   - action-holds.md:3
   - action-replies.md:3
   - actions.md:3
   - action-records.md:3

   Either the status lines are stale or marks were dropped (inference: stale).
5. **No ledger entries.** action-holds and action-replies are layer-9 modules in build/modules.json:151, :153 with no `process/ledger/*.json`. The process has never recorded them (inference). case-account had the same gap and got an entry only at layer 8 open (process/ledger/case-account.json prior_work).
6. **Retired R14 still cited.** action-holds R14 is retired: a release where no hold stands is accepted (action-holds.md:49). Two places still speak as if it refused:
   - action-holds R15: "R14 also refuses with it a release where no hold was placed" (:50).
   - action-producers R23: "a release where no hold was placed is refused, `action-holds` R14" (action-producers.md:84).
7. **Row families stale.** These say rows "stay in action-grammar's C-117 until this module's own family is BOB's":
   - action-holds.md:52
   - action-replies.md:65

   But action-grammar R9 says holds are C-149 and replies C-150 (action-grammar.md:76), and action-holds R15 and action-replies R7 use C-149 and C-150.
8. **action-replies uses.** Its Uses says `case-authoring` "leaves `uses`" (action-replies.md:49), but build/modules.json:153 still lists `case-authoring`.
9. **Tier at start, possible conflict.**
   - action-plans R54: starting an option "records that tier on the action as its first risk-tier history entry … in the same transaction" (action-plans.md:181).
   - actions R1: a creation that states a history "other than through R24's act" is refused `RISK_TIER_REWRITTEN` (actions.md:18).

   Whether R54 goes through R24 is not stated (inference: possible conflict).
10. **action-plans states.** The Suggestions still say "states `open` and `closed`, one edge" (action-plans.md:159). R40 adds `paused` (:73).
11. **action-records R16 list split.** The bullets of R16 (:52) are split by R17–R19 (:53-55) and resume at :56–:62. This is editorial only, but a test reader may miss them.
12. **case-tensions seam still open.** The seam with publication is "Open for BOB" (case-tensions.md:80), though the module is in force and met (:3).
13. **dash-action cannot read what it needs.**
    - `approvedUnsent` and `checkpointsDue` are services, not ops (screens-action.md:101).
    - The doors to dash-action are not written in interface-shell R81 (:101).
    - "replies to read" has no definition in the record (:102).
    - R72 (T53) asks for a "needs you" tier that is true for every action (:152).
14. **Ungrading across groups.** case-import R36 is unmet: an own case resting on accepted work must not list the source's ungraded passages (case-import.md:202). It must agree with case-authoring R88: "An accepted or imported finding is not listed" (case-authoring.md:79). Consistent in words, but untested.
15. **"Overdue" wording is consistent.** It is never shown before a member determines noncompliance:
    - action-producers R1 (:25)
    - screens-action R5 (:26), R30 (:105)
    - action-clocks R3 (:24)

    The `queue.action-clock-overdue.theirs.detail` sentence is returned as untrue in one case (action-producers.md:84).

---

## 3. Open questions, and whose call

| # | Question | Whose call |
|---|---|---|
| 1 | Fix F2 (case-authoring writes `/10`'s `ungraded_passages`/`typed_passages`) and mark R89 unmet until then? It blocks every real publish at ratification's gate. | Bob/BOB: a requirement and job matter, not design. The lane should know publishing is red at tranche. |
| 2 | case-grammar R35 against R38: is `/10` always the format, or only with an extract? | Bob/BOB. |
| 3 | The fixed sentences for ungraded and typed passages: case-authoring R89, and case-grammar R36/R37 (`case.ungraded.*`, `case.typed.*`, the credit phrases). Once given they are frozen per format. | Lane: design wording, inside the frozen-bytes rule. |
| 4 | The signing ceremony's step words: "what becomes permanent", the republication sentence, sealed weeks, open requests (`signing.openrequest.*`), minutes, "Publish at…". | Lane: design and wording. |
| 5 | The complete edition's words and headings, the standing line, and the outcomes heading. | Lane, with the byte-pinning rule (case-grammar R33). |
| 6 | Does the case file or complete edition print the timeline and calculations, and where? Can the owner widen or narrow the timeline set? (case-grammar.md:248; case-authoring.md:264) | Lane proposes; BOB/Bob decide the requirement. |
| 7 | The `dash-action` gaps: ops for `approvedUnsent` and `checkpointsDue`, "replies to read", and the doors from Home and the shell. | Bob/BOB for ops and requirements; lane for the drawing and words. |
| 8 | `actionnew`: one "Who" field against `actions` R9's arms, and the missing `description` field (screens-action R24 REPORTs). | Lane for the form; BOB if R9 must change. |
| 9 | The returned sentences: action-producers' four keys and its venue-null arm, action-grammar's four rows, and `door.clockentrystate`. | Lane for words; BOB to re-mark once words agree. |
| 10 | Stale status lines, the retired R14 still cited, row-family text, the action-replies uses edge, and the action-records R16 layout. | BOB: editorial requirement fixes. |
| 11 | Ledger entries for action-holds and action-replies. | BOB/process. |
| 12 | action-plans R54 against actions R1 on the first tier history entry. | BOB. |
| 13 | The case-tensions seam (a/b/c, case-tensions.md:80). | Bob/BOB. |
| 14 | The docket's member-facing surface on the publishing side: what a reader sees of "file a response in the case's docket" (case-account R7). These requirements give no screen requirement for it. | Lane: design of the docket's reader view, with the publication and docket requirements, not read here. |
