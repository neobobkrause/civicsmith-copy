Length: 98 lines. Last section: "Changes".

# J19: The daily queue

Journey page `j19-the-daily-queue` (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

Status: walkable (step 5 is AI: the queue's machine hints arrive only while the assistant is reachable, `queue` S8) · Screens used: `queue`, `document`, `front`, `updates`, `update` · Follows: J28, J06, J07, J08, J09, J17, J18 · Followed by: none named

Sources: `mock-journeys.js` journey 19 and `JBRIEF[19]`; `journeys.html` #j19; `PLAN.md` section 3, row 19 (items are real, each opens the thing to act on and is resolved by the act; empty states are quiet; Updates shows the running release and what is new).

## Goal

"Show me, in one list, what is waiting on me today, and let me deal with each thing where I stand."

## Who

1. Mai, a member of Lakeshore Tenants and of "Roof repairs", signed in, with no AI account (step 5 only: with one).
2. Rosa, the team's administrator, who installed the team's Civicsmith in J28 and holds its Cloudflare account, for steps 7 to 9.

## Before it starts

1. J18 has been walked on this copy: Mai's queue holds the item for her standing question's answer.
2. J09 has been walked: Mai has cited a passage of the city's report to council (the claim) in a question.
3. ARCH has arranged that the claim's address now serves a changed copy (index, section 5: which address serves it is ARCH's to say).
4. For step 4: a records request of Mai's whose due date has passed with no reply recorded. J08 recorded a reply, so none exists unless one is made and its date passes; how a walk reaches a passed date on a development copy is not said by the design (design silent: lane to confirm). Without it, step 4 shows no such item (turn-aside 3).
5. For steps 7 to 9: a release newer than the one the copy runs is ready, as a development pre-release ARCH publishes.

## Test data

| Item | Value |
|---|---|
| Reason for adopting the newer version (step 3) | "The report was reissued; I checked the changed words." |
| Remind me again on (step 4) | Three days from today |
| Reason for dismissing a hint (step 5) | "Not about this project's question." |
| Snooze until (step 6) | Seven days from today |

## Steps

1. Mai opens her queue (rail "Queue").
   - 1.1 `queue` shows S1: C1's heading, the count of items, grouped by case, and the sort choices.
   - 1.2 C4's note on the three kinds shows, marked as shown once.
   - 1.3 A section for "Roof repairs" (C5); each item shows its kind in words (C5), not by colour alone.
   - 1.4 The rail's "Queue" carries the count of items waiting (`every-screen` section 3.1).
2. Mai reloads the queue.
   - 2.1 C4's note no longer shows; every item from step 1 still does.
3. On the claim's `document`, Mai presses "Check for a new version now" (A16); then, in her queue, on the item for the newer version, she presses "Adopt the newer version" (`queue` A1) and gives the reason from Test data.
   - 3.1 `document` shows its checked line, and C14 lists a newer copy beside the one cited (whether the check captures the newer copy itself is not drawn: design silent: lane to confirm).
   - 3.2 The queue holds an item for the newer version, with "Adopt the newer version" and "Keep the version you cited" (A1).
   - 3.3 After the reason is sent: C2's done line names what was done, and the item has left the queue.
4. Where an office's due date has passed with no reply recorded, Mai presses "Remind me again on…" (A5) on its item and chooses the day from Test data.
   - 4.1 The item says once that no reply was recorded by that date, as a fact, never as legal advice (C6; `action` S2).
   - 4.2 A5 opens the field "Remind me again on (optional)"; after it is set, the item leaves until that day.
5. **AI.** An item the machine marked worth a look shows; Mai opens "How was this found?" (C7) and presses "Dismiss with a reason" (A9) with the reason from Test data.
   - What must be present (hard, every run):
     - 5.1 The item carries the hint's machine-work mark, how it was found and out of how many (C6, C7), and C7's four parts: what was matched, how it was found, how far to trust it, what it is not.
     - 5.2 After the reason is sent, the item leaves; it shows in S6 ("What you answered", A17), in its set-aside section.
   - What must never be present:
     - 5.3 A hint drawn as a finding, or without its fold; a hint of a kind switched off for the project.
   - **Without the assistant:** no hint item arrives (`queue` S8); Mai goes on to step 6.
6. On the item for her standing question's answer (from J18), Mai presses "Snooze to a date" (A10) and chooses the day from Test data.
   - 6.1 A10 opens the field "Until which day"; after it is set, the item leaves the queue.
   - 6.2 Through "What you answered" (A17), S6 shows the item in its snoozed section, with the day it comes back and button "Bring back".
7. Mai signs out (shell menu, "Sign out"); Rosa signs in on `front` and opens her queue.
   - 7.1 `front` shows its signed-out state after Mai's sign-out (`every-screen` section 4).
   - 7.2 Rosa's `queue` shows C8, the section for the team's Civicsmith: an update is ready, with the release and its date; "See what changes" and "Not now" (A11).
   - 7.3 None of Mai's items (her standing question's answer, her newer version) shows in Rosa's queue.
8. Rosa presses "See what changes" (A11).
   - 8.1 `updates` shows S2: in its ready section the release and its date, the security mark where the release is a security fix, and the line that the release is signed; its notes in three parts, for members, for administrators, and what an administrator must do.
   - 8.2 Buttons "Update" and "Not now" are offered; there is no hand-off of the link (that is S1).
   - 8.3 C2 names the release running now.
9. Rosa presses "Update" (`updates` A1).
   - 9.1 A new tab opens the installer's `update` page, set to that release. The walk stops there: updating is not part of this journey.

## End state

Checked after a reload:

1. Signed in as Mai, `queue` holds neither the newer-version item nor the standing question's answer; S6 lists the answer in its snoozed section with its day, and the adoption in its answered section.
2. The claim question's citation is on the newer copy (`document` C15 shows it moved, by Mai, with the day).
3. Signed in as Rosa, `queue` C8 still shows the release ready (it was not installed), and `updates` shows S2.
4. Where step 4 was walked, the passed-date item is gone from Mai's queue until the reminder day.

## Ways it can turn aside

1. Step 1, nothing waits on Mai: `queue` S2, quiet: its line, the three rows for the kinds each with its second sentence, the up-to-date line, and the links "Go to Home" and "What you answered". The journey cannot go on; the walk records it.
2. Step 1, a feed did not answer: `queue` S7, never S2's line; link "Try again". Resumes at step 1.
3. Step 4, no passed due date on the copy: no such item shows. Resumes at step 5.
4. Step 3, Mai keeps her version: "Keep the version you cited" (A1); the item leaves; the citation stays on the earlier copy. Resumes at step 4.
5. Step 3 or 5, a reason sent empty: the shell's message for an empty reason, and nothing is sent. Resumes at the same step.
6. Step 6 or 4, no day chosen: `queue` V1. Resumes at the same step.
7. Step 7, no release ready: `queue` has no C8; `updates` shows S3. The journey ends.
8. Step 7, Rosa does not hold the Cloudflare account: `updates` S1, with the link to pass on and "Copy the link" (A4) in place of "Update"; she copies it for whoever holds the account. The journey ends there.
9. Step 8, Rosa puts it aside with "Not now" (A2 on `updates`, or A11 on `queue`): the release is put aside for every administrator and returns later. The journey ends.
10. Step 7, a member who is not an administrator opens `updates`: S4, naming the administrators, and nothing else.

## Changes

- 22 Nov 2026: written.
