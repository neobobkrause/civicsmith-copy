Length: N lines. Last section: "Changes".

# J08: Checking a deadline's basis

Journey page `j08-checking-a-deadlines-basis` (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

Status: walkable · Screens used: `action`, `due-date`, `queue` · Follows: J28, J06, J07 · Followed by: J09

Sources: `mock-journeys.js` journey 8 and `JBRIEF[8]`; the wizard "Get a record" (`library.json`), its step 9, which names journeys 7 and 8; `journeys.html` #j8; `PLAN.md` section 3, row 8.

## Goal

"The city has a date by which it must answer my request: I want to see where that date comes from and how it was counted, confirm it, and later see whether it was met."

## Who

1. Mai, a member of the project "Roof repairs", signed in, with no AI account (none is needed).

## Before it starts

1. J07 has been walked on this copy: the records request for the roof of 14 Lakeshore Row was approved and its sending recorded; its action shows a due date pending (J07 step 9).
2. The due date has not passed and the office's reply is not recorded.

## Test data

| Item | Value |
|---|---|
| "Why this date is right, in your words" (step 4) | "Counted from the day we sent it, under the law the request goes under." |
| "Remind me on" (step 6) | The day before the due date |
| The office's reply (step 8) | How it came: through the office's portal. Who it came from: the office. The day it came: today. "Your account of the reply": "The office acknowledged the request and says it is gathering the records." No document. Reason: "The office answered through its portal." |

## Steps

1. Mai opens the project "Roof repairs", its link "Actions" (`project` C11), and the records request.
   - 1.1 `action` shows S1, as J07 left it: C1's kind and title, the office and the sending day.
   - 1.2 C2 shows the response due date and the line that the action waits on the office's reply.
   - 1.3 C3 lists that date in its pending state, as a link to `due-date`.
2. Mai opens the due date from C3.
   - 2.1 `due-date` shows S1. C1: heading 1 the due date, with whose reply it is (the office's).
   - 2.2 C2, under its heading 2: the basis (the law chosen in J07 step 5); either the day the office received it, or that it is counted from the sending day because receipt is not recorded; how many days were counted, and in what units; each weekend or holiday skipped, or the day rolled forward, each on its own line; and the day it falls due, with the team's time zone.
   - 2.3 The date in C1 is the date in `action` C2.
   - 2.4 C5 says that once confirmed the date goes into the queue, and that the queue says once if no reply comes by then.
3. Mai presses "Work out the due date" (`due-date` A1).
   - 3.1 C2 is drawn again; it holds the same basis, counting and date as in step 2. Nothing else changes.
4. Mai types the reason from Test data in C3's field and presses "Confirm the due date" (A2, Asks for a reason).
   - 4.1 The button is marked busy, then done (`every-screen` section 6).
   - 4.2 The date is confirmed, and it enters Mai's queue (A2). How `due-date` marks a confirmed date is not drawn (design silent: lane to confirm).
5. Mai presses the link "Download to my calendar" (A4).
   - 5.1 The browser saves a calendar file; `due-date` is unchanged.
6. Mai types the day from Test data in "Remind me on" (C4) and presses "Remind me" (A3).
   - 6.1 `due-date` shows S2, naming the day chosen.
7. Mai opens her queue (rail "Queue").
   - 7.1 `queue` shows S1. Under the section for the case (or, where the request is in none, the section for no case: C5), an item for the request's due date, showing its kind and its due day (C5).
8. Mai goes back to the action, records the office's reply from Test data in C4's reply form, and presses "Record a reply" (`action` A1, Asks for a reason).
   - 8.1 C4 lists the reply, dated today, as received, with Mai's account of it.
   - 8.2 C4's note says a recorded reply stays and is never edited or removed.
   - 8.3 C3 shows the due date in its met state.
9. Mai opens her queue again.
   - 9.1 The queue shows the date as met, as facts and never legal advice; no "no reply recorded" line shows for it. (How the queue draws a met date is not on `queue`'s page: design silent: lane to confirm.)

## End state

Checked after a reload, signed in as Mai:

1. `action` for the request shows the reply under C4 and the due date in its met state under C3.
2. `due-date` for that date shows the same basis and counting as in step 2, and the reminder day (S2) where the screen redraws it.
3. No passed-date item for this request is in Mai's queue.

## Ways it can turn aside

1. Step 2, the places' rules state no deadline for this kind of action: `due-date` S3, with "A deadline your rules list" and "Work out the due date". Mai picks the deadline the rules list and presses it: resumes at step 3. Where the places list no deadline at all: S4; the journey stops (a team rule is drafted and confirmed by a second member on `grouprules`, outside this journey).
2. Step 2, a needed date is not recorded: S5's line in C2; nothing can be confirmed. The journey stops; the walk records it.
3. Step 2, the law leaves the day uncertain: the date shows as undetermined, with its "because" line and both candidate dates (`journeys.html` #j8; `every-screen` rule 2). How `due-date` draws the two dates is not on its page (design silent: lane to confirm). Resumes at step 4 on the earlier date.
4. Step 4, the reason left empty: the shell's message for an empty reason; nothing is confirmed. Resumes at step 4.
5. Step 6, no day chosen: `due-date` V1. Resumes at step 6.
6. Step 8, the reply form incomplete or inconsistent (for example both a document and none, or the day not a real day): one of `action` V1 to V10 beside the form; nothing is recorded. Resumes at step 8.
7. Step 8, the due date passes before any reply is recorded: `action` shows S2, with "Open a question from this" (A3); the queue says once that no reply was recorded (J19 step 4). Recording a late reply then shows the date as met late (`journeys.html` #j8; met late is not among `action` C3's states: design silent: lane to confirm). Resumes at step 9.

## Changes

- 22 Nov 2026: written.
