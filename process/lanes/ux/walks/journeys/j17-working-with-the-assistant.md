Length: 95 lines. Last section: "Changes".

# J17: Working with the assistant

Journey page `j17-working-with-the-assistant` (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

Status: AI, partly not built (step 3's suggested questions) · Screens used: `question`, `assistant`, `answers`, `project`, `document`, `home`, `finder` · Follows: J28, J06, J07, J08, J09; for its AI steps, J04 · Followed by: J18

Sources: `mock-journeys.js` journey 17 and `JBRIEF[17]`; `journeys.html` #j17; `PLAN.md` section 3, row 17 ("Look": the dock and Ask draw their states and refusals in words; the search form without the assistant works). The assistant runs on whichever AI account serves the member (the first beta connects providers of any kind, DEC-420).

## Goal

"I want to ask for help finding, reading, answering and checking, and decide myself what to keep; and if no assistant serves me, every step stays open without it."

## Who

1. Mai, a member of the project "Roof repairs", signed in.
2. Path without the assistant (walked first): no AI account serves Mai. The assistant is absent, not greyed (`every-screen` section 5).
3. Path with the assistant: an AI account serves Mai (her own, connected in J04), and the team has the assistant installed and on.

## Before it starts

1. J06 has been walked on this copy: "Roof repairs" holds the question "Has the landlord been ordered to repair the roof of 14 Lakeshore Row?", and the team holds Housing notice 2026-118, vouched for. J09 has left a second, concluded question in the project.
2. For the AI steps only: J04 has been walked, so an AI account serves Mai. Without it, each AI step is recorded not walked and its step **without the assistant** is taken.

## Test data

| Item | Value |
|---|---|
| Asked in plain words (step 2) | "Which documents we hold say when the roof of 14 Lakeshore Row must be repaired?" Reason: "To find the deadline." |
| Search words (step 2, without the assistant) | "roof" |
| The question kept (step 3) | "Has the city inspected the roof of 14 Lakeshore Row since Housing notice 2026-118?" Reason: "The next thing to know." |

## Steps

Walk the path without the assistant first: at each **AI** step take its step **without the assistant**, and take step 5. Then, where an AI account serves Mai, walk steps 1 to 4 as AI steps.

1. **AI.** On the question about the roof (`question`), Mai presses the masthead button "Assistant".
   - What must be present (hard, every run):
     - 1.1 The panel `assistant` opens beside `question` in its dock (S1): its header with the machine mark, the line saying which account serves her (her own account) and that it works for her alone (C2), C3 with no run yet, and C7's field and buttons.
     - 1.2 The daily use line (C1) shows only if Mai owns the paying account.
   - What must never be present:
     - 1.3 A panel that runs on another member's account without saying so; a blank panel.
   - **Without the assistant:** Mai opens the same question. `question` shows S13 (here as S3 or S1, as the record stands): no masthead button "Assistant", no dock, and no "Ask the assistant to look", "Read in my language" or "Help me write this", with nothing greyed or explained in their place.
2. **AI.** Mai opens Ask (`answers`), types the words from Test data in "Your question", and presses "Ask" (A1), giving the reason.
   - What must be present (hard, every run):
     - 2.1 `answers` shows S2 while it works (progress rows, no answer words), then S1.
     - 2.2 The answer carries the machine-work label; each sentence is followed by links to the passages it rests on, each opening `document` at that passage; "Where it looked" gives its lines; the line that Civicsmith checked it before it was shown (C3).
     - 2.3 Where it says what the notice requires, the "Legal information, not legal advice." line (C3).
     - 2.4 Where nothing held answers, the answer says so: the "Not established" line, where it looked, and what would find it.
     - 2.5 On a test instance, the untested label.
   - What must never be present:
     - 2.6 A source the team does not hold; a quotation not in the cited passage; legal advice; the answer drawn as Mai's words or as evidence; a single confidence score.
   - **Without the assistant:** `answers` shows S5, its heading "Find and count". Mai types "roof" and presses "Search" (A3): C7 lists Housing notice 2026-118, its title a link to `document`, marked as found by search. She presses "Show how this was counted" (A4) where a count shows: the value with its basis, or what is not held (A4). No "Ask" and no field "Your question" is drawn.
3. **AI.** `not built` On `project` "Roof repairs", with suggestions turned on, a suggested question shows under "Suggested questions" (C15), with its machine-work label; Mai opens the one that matches Test data's question with "Open this question".
   - What must be present (hard, every run):
     - 3.1 Each suggestion carries the machine-work label and says who asked; it opens a question only on Mai's act.
   - What must never be present:
     - 3.2 A question opened, a reading accepted, a conclusion, a signature or anything sent without Mai's act.
   - **Without the assistant:** Mai types the question from Test data in "The question, in plain words" and presses "Open a question" (`project` A1, Asks for a reason). `question` opens in S3 for it; `project` C7 lists it. No section "Suggested questions" is drawn.
4. **AI.** On the new question, Mai presses "Ask the assistant to work on this" (`assistant` A2), then "Stop the run" (A4) before it ends.
   - What must be present (hard, every run):
     - 4.1 After A2: the started line, then S2: "Working on this" with its step count, and the line that the run is hers (C3); "Stop the run" offered.
     - 4.2 To the owner of the paying account only: the daily use line in C1 and the cost so far in C3.
     - 4.3 After A4: S3, the run ended because she stopped it; what it produced stays labelled as its draft (C4). `question` shows S10.
   - What must never be present:
     - 4.4 A reading accepted or a conclusion made by the run; a cost line to a member who does not own the paying account.
   - **Without the assistant:** there is no run to start or stop and no limit to see: no use line, no cost line and no "Stop the run" is drawn on any screen.
5. **Without the assistant.** Mai goes through Home, the project, the new question, and Find.
   - 5.1 On `home`, `project`, `question` and `finder` no masthead button "Assistant", no dock, no suggestion and no control that only the assistant answers is drawn (`home` S7; `project`, state "Assistant not reachable"; `question` S13; `finder` S7).
   - 5.2 Nothing on any of them says the assistant exists or reminds her to connect one.

## End state

Checked after a reload, signed in as Mai:

1. `project` "Roof repairs" C7 lists the question from Test data, opened by Mai (either path).
2. That question's `question` shows S3: nothing cited, no reading accepted, nothing concluded by the assistant.
3. With the assistant: what the stopped run produced shows only as its labelled draft; no reading is accepted on the question.
4. Without the assistant: no screen visited shows any sign of the assistant.

## Ways it can turn aside

1. Step 1 or 4, the run cannot start: `assistant` S4, its reason from C5, never blank, saying nothing was sent. The steps without the assistant still work. Resumes at step 2.
2. Step 2, the assistant's connection has not passed its check: `answers` S4 with a link to `connect`. Resumes at step 2's path without the assistant.
3. Step 2, the check finds a cited passage not as quoted: `answers` S3, with its line to ask again or search. Resumes at step 2.
4. Step 2, the team keeps its material away from the assistant, the part is not deployed, or a limit is reached: `answers` V2, V3 or V4. Find and count still work. Resumes at step 2's path without the assistant.
5. Step 2 without the assistant, nothing matches: `answers` S6. Resumes at step 2 with other words.
6. Step 3, the question left empty: `project` V1. Resumes at step 3.
7. Step 4, the paying account's limit reached: `question` S6, with its other reasons fold and its link to `connect`. Resumes at step 5.
8. Step 4, the screen served is neither a question nor a project: `assistant` S5. Resumes at step 4 on the question.

## Changes

- 22 Nov 2026: written.
