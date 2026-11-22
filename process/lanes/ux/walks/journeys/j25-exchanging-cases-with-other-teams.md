Length: 86 lines. Last section: "Changes".

# J25: Exchanging cases with other teams

Journey page `j25-exchanging-cases-with-other-teams` (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

Status: walkable once a second team's case file exists (see "Before it starts") · Screens used: `projects`, `imported`, `question` · Follows: J28, J15 (for step 7 only); and a second team's published case · Followed by: none

The steps are the wizard "Use another team's case" (`library.json`, journey 25), step for step: import (steps 1 to 2), watch each finding's mark (step 3), accept with a reason (step 5), watch the publisher's docket (step 6). Steps 4, 7 and 8 add what the settled journey says (whose stake, building on it, read-only).

## Goal

"We brought in another team's published case, checked what Civicsmith could recreate, and rest our own work on what held."

## Who

- Mai, a member (J28), signed in on her own device at 1280 px.
- The other team: no person acts in this journey; only its published case file and its public address are used.
- No assistant: `imported` S4 draws no "Help me write this", and no step needs one.

## Before it starts

1. J28 has been walked on this copy; for step 7, J15 too (the team holds a concluded question).
2. A case file published by another team is on the walker's device: the file that team's `published` A2 ("Download the complete edition") saves. On a development copy this needs a second team's Civicsmith, deployed apart from this one, walked through J28 and J15 with the Test data below, and its published case's address. Where the second copy runs is ARCH's to say. This team's own published case is no stand-in: `imported` is for another team's case (its purpose, and its band "Another team's case").
3. No case has been imported on this copy (`imported` S3).

## Test data

| Item | Value |
|---|---|
| The other team | "Harbour Tenants" (made up for this journey), on its own development copy |
| Its case | Edition 1 of a case published there by its own J15, with at least one finding |
| The case file | the file its `published` A2 saved |
| The publisher's address | the https address of that team's `docket-public` for the case |
| What you checked | "Each finding's mark, and the recreated calculations." |
| Why your team may rely on it | "Its findings recreated here from its own evidence." |
| Note when resting our question on it | "Their case found the same order." |
| Every other reason asked | "To use Harbour Tenants' case." |

## Steps

1. Mai opens `projects` with the rail and presses the link "Imported cases" (A7).
   - 1.1 `imported` shows S3: heading "Imported cases", `.list.none`, and "Import a case" (A1).
2. Mai presses "Import a case", chooses the case file under "The case file", and gives a reason.
   - 2.1 `imported` shows S1 for the new import: the band "Another team's case: Harbour Tenants · Edition 1 · read-only · {recreated} of {findings} …" (`.band`).
   - 2.2 C1: the case's title, and "From Harbour Tenants · Edition 1 · imported by" Mai with today's date (`.from`).
3. Mai reads C3, "Its findings, recreated here".
   - 3.1 Each finding carries exactly one of "Recreated", "Recreated in part", "Did not recreate".
   - 3.2 The band's first count equals the number of findings marked "Recreated".
   - 3.3 No finding offers an edit control: the case is read-only.
4. Mai reads C2, "Whose stake this states".
   - 4.1 It shows Harbour Tenants' identity and stake, marked unsigned, or the disclosure "When they were not recorded".
5. Mai presses A2 ("Accept what recreated"), fills "What you checked" and "Why your team may rely on it", and sends it.
   - 5.1 C7 "Accepted by your team" lists "accepted by" Mai, today, with her reason.
   - 5.2 C3's marks and grades are unchanged (accepting names one edition and changes no grade).
6. Mai presses A4 ("Watch the publisher's docket") and gives the publisher's address.
   - 6.1 Under A4, `imported` names the publisher's address now watched (C9, no word row; `not built`: the code shows only the button's done state).
7. Mai opens C8, "Rest one of your team's questions on this", chooses the J15 question, "It supports the question", and the note, and presses its button (A8).
   - 7.1 A8's button shows done (every-screen rule 15); the question's resting on the case is shown on `question` (7.2). Pressing A8 again for the same question and finding shows "This question already rests on that finding." (`.citeimp.already`).
   - 7.2 `question` for that question shows the finding marked "Another team's" (`.citeimp.origin`) with `.citeimp.origin.meta`. The question's own sections to cite or take back another team's finding (C5) are `not built`.
8. Mai opens `imported` at `/app/imported`.
   - 8.1 `imported` shows S2: one row "Harbour Tenants · Edition 1 · imported by" Mai, today, with its count, as a link to S1; no band.

## End state

Checked after a reload:

1. `imported` S2 lists the import; its S1 shows the band, C3's marks as in step 3, and C7's acceptance by Mai.
2. `question` for the J15 question shows the finding marked "Another team's".
3. On the other team's copy nothing has changed: its `docket-public` for the case, opened with no session, lists the same entries as before step 2 (importing sends nothing to the publisher, `journeys.html` 25).

## Ways it can turn aside

1. Step 2, no file chosen: V1 ("Choose the case file first."); resume at step 2.
2. Step 2, a file that is not a case file: beside A1, as an alert, "What was given is not a case file your team's Civicsmith can read: each way it departs from the case-file format is named. Nothing was imported." (`refusal.IMPORT_NOT_A_CASE_FILE`), each departure in its words (for example `refusal.IMPORT_NOT_A_CASE_FILE.manifest`); resume at step 2 with the right file. A case file whose signature does not check is imported, and C1 says its signature did not check (C10, no word row; `not built`); the walk records it and resumes at step 2 with the right file.
3. Step 3, a finding "Did not recreate": it stays shown with that mark; step 5 accepts only what recreated; the journey goes on.
4. Step 5, "What you checked" empty: V2 ("Say what you checked first."); resume at step 5.
5. Step 6, not an https address: V4 ("Give the publisher's https address."); resume at step 6.
6. Step 7, the finding not accepted: V6 (`.citeimp.ref.notaccepted1`); resume at step 5.
7. Mai withdraws the acceptance (A5, "Ends something", with a reason): C7 shows it withdrawn; a second withdrawal shows V7. Not part of this journey's end.
8. No second team's case exists: the journey cannot start; record it as not walked, naming "Before it starts" item 2.

## Changes

- 22 Nov 2026: written.
- 22 Nov 2026: design-silent lines settled (decisions.md section 3).
