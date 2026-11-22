Length: N lines. Last section: "Changes".

# J22: From suspicion to a closed plan

Journey page `j22-from-suspicion-to-a-closed-plan` (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

Status: AI (step 4 only; the path without the assistant is walkable and is walked first) · Screens used: `question`, `plan`, `start-send`, `action`, `matter` · Follows: J15, J26 · Followed by: J23

This journey absorbs the earlier "Acting on a finding" (DEC-137).

## Goal

"We decided what to do about the roof, asked the city for its records, followed the answer, and closed the plan with how it ended."

## Who

- Mai, the project's owner (J15), signed in on her own device at 1280 px. She acts alone.
- The assistant: step 4 only, and only when an AI account serves Mai. Without one it is absent, not greyed (`every-screen` section 5).

## Before it starts

1. J15 has been walked on this copy: project "Roof repairs at 14 Lakeshore Row" holds the concluded question and the published Edition 1 of its case, whose Finding 1 is relied on.
2. The project has no action plan (`plan` S3 at the project's address).
3. For the walk with the assistant only: an AI account serves Mai (J04 or J32).

## Test data

| Item | Value |
|---|---|
| The plan's title | "Get the roof repaired" (the product walker's) |
| Option 1: line; kind | "Ask the housing department for its inspection records of 14 Lakeshore Row"; Legal |
| Option 1: directed to | role "Records officer", body "City of Lakeshore housing department"; "How careful to be": "Not assessed yet" |
| Option 2: line; kind | "Complain to the housing department about the roof"; Other |
| Option 2: directed to | role "Housing inspector", body "City of Lakeshore housing department" |
| Why option 2 is declined | "The notice already orders the repair; we ask for the records first." |
| Scenario; phase; check back after; checkpoint | "Records first"; "Ask for the records"; 20 days; "The department sent the records" |
| What the team sends | "Please send the inspection records of 14 Lakeshore Row that led to notice 2026-118." |
| How it was sent | "By hand at the city's records counter" |
| The reply | "The department sent the inspection report"; came by post, from the records officer; account "The inspection report arrived by post." |
| The act; the determination | "The housing department's follow-up of notice 2026-118"; Noncompliant |
| Why not escalate now | "We wait to read the inspection report first." |
| How the plan ended | "The records came back; the team watches the repair." |
| Every other reason asked | "For the roof plan." |

## Steps

1. Mai opens the question on `question` (S8) and presses "Plan what to do" (A12), giving the plan's title and a reason.
   - 1.1 `plan` shows S1: C1 the title, "Open" and "opened {date} by" Mai.
   - 1.2 C3 lists one matter, "from the question "{title}" ({status}, {date})" (`.subject.from`) (design silent on whether opening from a question adds it as a matter: lane to confirm; if C3 lists none, Mai adds it with A1 "Add a matter" first).
2. Mai opens "Add an option" (C5), fills option 1 from Test data, ticks the matter under "The matters it serves", and presses A2 with a reason.
   - 2.1 C4 lists option 1, category Legal, disposition "undecided" (design silent on which kind makes `start-send` a records request, S1: lane to confirm).
3. Mai adds option 2 the same way.
   - 3.1 C4 lists option 2, category Other, "undecided".
4. **AI.** Mai presses A3 ("Ask the assistant for options"), waits for the tray, and presses A4 ("Adopt") on one suggestion with a reason.
   - Present in any proper result (hard, every run):
     - 4.1 While it works, S5 shows `.ask.running`; then `.ask.ended`.
     - 4.2 A tray "Suggested by the assistant · not yet in the plan" (`.suggested`) holds each suggestion, each with the machine-work label and its own "Adopt"; on a test instance, `ai.label.untested`.
     - 4.3 After "Adopt", the suggestion is a row of C4, "undecided", labelled as adopted from machine work (design silent on the label's place: lane to confirm).
   - Never present:
     - 4.4 An option in C4 that no member adopted or added; a disposition other than "undecided" set by the assistant; an option directed to a private individual (V6's rule); a sentence that says what the team must do in law; the assistant's cost to anyone but the paying account's owners.
   - **Without the assistant:** Mai takes no step here. `plan` shows S6: no tray, no A3, no "Help me write this", nothing greyed. C4 holds options 1 and 2 only, and the journey goes on at step 5.
5. Mai ticks option 1, opens "Decide the options you picked" (C6), chooses "Choose them", and presses A5 with a reason.
   - 5.1 C4 shows option 1 "chosen".
6. Mai ticks option 2, chooses "Decline them", writes the why from Test data, and presses A5.
   - 6.1 C4 shows option 2 "declined" with the reason.
7. Mai opens "Lay out a scenario" (C8), fills the scenario and one phase from Test data with option 1 in it, and presses A7 with a reason.
   - 7.1 C8 shows a tab "Records first"; the phase line `.phase.checkpoint` names the checkpoint, and "You can judge this checkpoint from {date}." (`.judge.notdue`) gives a date 20 days on.
8. Mai ticks option 1 and presses A6 ("Start…").
   - 8.1 `start-send` shows S1: C1 heading "Start “{option 1}”" and `.nothingruns`; C2 "Step 1 · Start" with "Kind", "Addressed to", "Rests on", "Clock" and "Asserts a breach".
9. Mai presses A3 ("Start the action") with a reason.
   - 9.1 `start-send` shows S3: heading "The action started"; Step 2 open.
10. Mai presses A4 ("Prepare what is sent"), writes the text from Test data in "What the team sends" (C5), and presses A6 ("Approve this text"), then "Confirm".
    - 10.1 Before it is done, `consequence.filingapprove` and `act.filingapprove.does` show; the button carries "Ends something".
    - 10.2 After it: the text is fixed; C9 shows `.approvefixes` and `.nosend`.
11. Mai fills "The day you sent it" (today) and "How you sent it" in C10 and presses A8 ("I have sent it · record the sending") with a reason.
    - 11.1 Before it is done, C10's tag "Outward · seen outside your team", `.outward.says` and `act.filingrecordsent.does` show.
    - 11.2 After it: S5, "Recorded as sent on {date}" and the link "Open the action".
12. Mai presses "Open the action".
    - 12.1 `action` shows S1: C1 the kind and option 1's title, "to {office}", "sent {date} by" Mai; C4 lists no reply.
    - 12.2 Where C2 of `start-send` named a clock, C2 shows "Response due {date}" and C3 lists that date "pending"; where it showed `.noclock`, C3 lists no date (design silent: lane to confirm what a development copy's profile gives).
13. Mai fills the reply form (C4) from Test data, with today as its day, and presses A1 ("Record a reply") with a reason.
    - 13.1 C4 lists the reply, dated today, "received".
    - 13.2 Where C3 lists a due date, it shows "met".
14. Mai opens "How it ended" (C10), chooses "The office complied", and presses A11 ("Move the action") with a reason.
    - 14.1 `action` shows S6: "Resolved: the office complied." (`.resolution.said.*`).
15. Mai opens `plan`, then the matter in C3.
    - 15.1 `matter` shows S2: "No determination yet" and A1 "Record a determination".
16. Mai presses A1, fills S3's form (the act from Test data; Finding 1 of the published case under "What it rests on"; the rule the form offers; "Noncompliant"), and presses "Record this determination" with a reason.
    - 16.1 Before it is done, `.this_cannot_be_edited_afterward` shows.
    - 16.2 `matter` shows S1: C1 "noncompliant · {support} · against {rule}", "Recorded by" Mai, and `.it_is_your_team_s_judgment_not`; C3 the ladder with the current stage marked (design silent on which rule a development copy offers: lane to confirm).
17. Mai presses A4 ("Decline to escalate, with a reason") with the why from Test data.
    - 17.1 C1 shows "The team declined to escalate: {reason}" (`.declined`).
18. Mai opens `plan` and presses A10 ("Close plan…"), says how it ended, and presses "Confirm".
    - 18.1 Before it is done, `act.planclose.does` shows; the button carries "Ends something".
    - 18.2 `plan` shows S4: "Closed" and "Closed: {reason}" (`.closedwhy`); no add, decide, start, scenario or close control.

## End state

Checked after a reload:

1. `plan` for "Get the roof repaired" shows S4 with the reason; C4 lists option 1 "chosen", option 2 "declined" with its reason (and, with the assistant, the adopted option, "undecided"); C9 lists option 1's action, resolved.
2. `action` shows S6 and the reply in C4; the sending recorded in step 11 is on it, dated.
3. `matter` shows S1, noncompliant, and `.declined` with the reason.
4. `plan` at the project's address lists the plan, "Closed" (S2).

## Ways it can turn aside

1. Step 2, the line empty or over 200 characters: `plan` V1; no matter ticked: V2; a tier on option 2: V3. The option is not added; resume at step 2.
2. Step 6, declining without a why: `plan` V8; nothing recorded; resume at step 6.
3. Step 4, the assistant unreachable (no account, or the run cannot start): no A3 is drawn, or the tray says why in words; the journey goes on at step 5 as without the assistant.
4. Step 9, the start would be refused: C4 "Would be refused" with the reason and `.resolve`; Mai puts it right or proceeds with a reason in `.override`; resume at step 9.
5. Step 10, the text empty: `start-send` V2; step 11, a field empty: V3 or V4; resume at that step.
6. Step 11, the project needs a second approval: S4 with `.waitsecond`; another member of the project presses A7 ("Give the second approval"); resume at step 11.
7. Step 13, neither a document nor an account given: `action` V2; resume at step 13.
8. Step 16, no rule binds, or the finding is not published: the refusal under its "When …" disclosure ending "Nothing was recorded."; walk J15 to its end first, or record "Unclear", and the journey stops: step 17 needs Noncompliant.
9. Step 12, the reply date passes with none recorded: `action` S2 "No reply recorded by {date}" with "Open a question from this"; resume at step 13.

## Changes

- 22 Nov 2026: written.
