Length: 88 lines. Last section: "Changes".

# J18: Asking a standing question

Journey page `j18-asking-a-standing-question` (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

Status: AI (step 5 is AI; its path without the assistant is walked first) · Screens used: `answers`, `capture`, `document`, `queue` · Follows: J28, J06, J07, J08, J09, J17; for its AI step, J04 · Followed by: J19

Sources: the wizard "Keep asking this" (`library.json`, four steps); `mock-journeys.js` journey 18 (its `noai` line) and `JBRIEF[18]`; `journeys.html` #j18; `PLAN.md` section 3, row 18 ("Look": drawn and explained; not run without the assistant).

## Goal

"Keep checking this for me until a date, and tell me once when something new turns up."

## Who

1. Mai, a member of Lakeshore Tenants and of "Roof repairs", signed in.
2. Path without the assistant (walked first): no AI account serves Mai; the search re-runs on schedule and new matches reach her queue as a list, read by no machine.
3. Path with the assistant: an AI account serves Mai (J04); the assistant reads only what is new, on her account and within her limit.
4. Rosa, signed in, for the end state only.

## Before it starts

1. J17 has been walked on this copy: the team holds Housing notice 2026-118, and nothing Mai has asked is kept as a standing question.
2. The document in Test data is served at an address the walk can capture from (ARCH's to say), and the team does not hold it.
3. For step 5 only: J04 has been walked, so an AI account serves Mai.

## Test data

| Item | Value |
|---|---|
| Search words (step 1) | "roof 14 Lakeshore Row" |
| How often, until when (step 2) | The most frequent check offered; until a day four weeks from today |
| New matching document (step 3) | A later city document whose words include "roof" and "14 Lakeshore Row", from the address ARCH gives |

## Steps

Walk without the assistant first: `answers` is then "Find and count" (S5). With the assistant, steps 1 and 2 are taken on "Ask" (S1) and step 5 is AI.

1. Mai opens Find and count (`answers`), types the search words, and presses "Search" (A3).
   - 1.1 `answers` shows S5: C5's heading and line, C6's field and button, and C7 listing Housing notice 2026-118 as found by search.
   - 1.2 C8 offers "Keep asking this" (A5).
   - With the assistant, `answers` shows S1 after "Ask" (A1), as J17 step 2 states, and C4 offers "Keep asking this".
2. Mai presses "Keep asking this" (A5), choosing how often and until when from Test data.
   - 2.1 `answers` shows the kept line with the cadence and the end day (C4's kept line); "Stop asking" (A6) is offered.
   - 2.2 An end day is required, so no question runs forever (wizard step 1). Where and how the cadence and the end day are chosen is not drawn on `answers` (design silent: lane to confirm).
3. Mai captures the new document from Test data (`capture` S1, A2) and vouches for it (`document` A2).
   - 3.1 `capture` shows S5; `document` then shows S1, vouched for by Mai.
4. The search runs again at its next scheduled time. (How a walk reaches that time on a development copy is not said by the design: lane to confirm.)
   - 4.1 Without the assistant, nothing is read by a machine: the new match goes to Mai's queue as a list.
5. **AI.** With the assistant, at that run it reads only what is new, on Mai's account and within her limit.
   - What must be present (hard, every run):
     - 5.1 The answer reaching the queue is labelled as the assistant's, with the machine-work label, and carries the queue item's "Read by the assistant" mark (`queue` C6, against S8).
     - 5.2 Every passage it relies on is a link to `document`, checked by Civicsmith before it was shown.
     - 5.3 It reads only the new document, never one already held before the question was kept.
   - What must never be present:
     - 5.4 A reading of what was not new; a conclusion, a citation or anything sent in Mai's name; an answer seen by any member but Mai; a run beyond her limit.
   - **Without the assistant:** step 6 shows the list as in 6.2, with no "Read by the assistant" mark (`queue` S8).
6. Mai opens her queue (rail "Queue").
   - 6.1 `queue` shows S1 with one standing-question item (C6) for the kept search.
   - 6.2 Without the assistant, the item lists the new match (the document from step 3) and has no mark of being read by the assistant (S8).
   - 6.3 The item reaches her queue once: a reload shows the same single item, and no second item comes for the same match.
7. Mai goes back to `answers` and presses "Stop asking" (A6).
   - 7.1 The kept line goes; "Keep asking this" is offered again.
   - 7.2 Stopping is immediate: nothing further is checked (wizard step 4).

## End state

Checked after a reload:

1. Signed in as Mai, `answers` shows no kept line for the search.
2. Mai's queue holds the one standing-question item from step 6, unless she has acted on it.
3. Signed in as Rosa, her queue (`queue`) holds no item for Mai's standing question: only Mai sees it.
4. The document from step 3 opens on `document` in S1.

## Ways it can turn aside

1. Step 1, nothing matches: `answers` S6. Resumes at step 1 with other words.
2. Step 1, no words: `answers` V1b. Resumes at step 1.
3. Step 2, no end day given: the shell's message for an empty required field; nothing is kept (`every-screen` section 7). Resumes at step 2.
4. Step 3, the address cannot be fetched: `capture` V2 or V3. Resumes at step 3 once ARCH's address answers.
5. Step 4, no new document arrives before the end day: no item reaches the queue; on the end day the question stops by itself. The journey ends at step 7.
6. Step 5, the assistant unreachable, its limit reached, or a use switched off: the queue item comes as the list without the assistant, as in step 6.2 (design silent on whether the queue says why: lane to confirm). Resumes at step 6.
7. Step 6, a feed did not answer: `queue` S7, never "nothing is waiting"; its link to try again. Resumes at step 6.

## Changes

- 22 Nov 2026: written.
