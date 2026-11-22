Length: N lines. Last section: "Changes".

# J09: Checking a claim about the city's performance

Journey page `j09-checking-a-claim-about-the-citys-performance` (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

Status: walkable · Screens used: `capture`, `document`, `project`, `question`, `finder`, `calculation`, `help` · Follows: J28, J06, J07, J08 · Followed by: J17

Sources: the wizard "Check a claim" (`library.json`, nine steps); `mock-journeys.js` journey 9 and `JBRIEF[9]`; `journeys.html` #j9; `PLAN.md` section 3, row 9. The mockups' pothole claim is replaced by a claim about the city's housing repair orders, of which Housing notice 2026-118 is one.

## Goal

"The city tells its council it enforces its repair orders: is that true? I want the claim, the city's own records, our spot-checks and the calculation held together, so anyone can check the answer."

## Who

1. Mai, a member of the project "Roof repairs", signed in, with no AI account (none is needed).

## Before it starts

1. J06 to J08 have been walked on this copy: the project "Roof repairs" exists with Mai as its member and one question.
2. The two documents in Test data are served at addresses the walk can capture from; which addresses, on a development copy, is ARCH's to say (index, section 5). The team holds neither.

## Test data

| Item | Value |
|---|---|
| The claim (step 1) | The city's report to council on its housing repair orders, which states a share of the orders the landlords complied with |
| The question (step 3) | "Do the city's own records support its report to council on repair orders complied with?" Reason: "To check the city's claim." |
| How the claim's words bear (step 4) | "Supports" |
| The narrower question (step 5) | "What does the report count as complied with, and over what period?" Reason: "A share means nothing until we know what was counted." |
| The city's records (step 6) | The city's list of housing repair orders for the period, as a spreadsheet, including Housing notice 2026-118 |
| The count (step 8) | "What you are counting": "Repair orders the list marks as complied with". "From": the first day of the period. "To": its last day. |
| The spot-check (step 11) | Testimony at one drawn order's address: "The repair the order names has not been done." Where: that address. When: no later than now. One photo Mai took there. |
| Reason for counting the visit (step 12) | "I visited the drawn order's address." |
| The conclusion (step 13) | "Your reading": what the records and the visits show, in Mai's words. "What would change it": "A fuller list of orders, or more visits." "Why you are concluding it": "The evidence is in." |

## Steps

1. Mai opens Add (rail "Add"), keeps the tab "From an address" (`capture` S1), types the claim's address, and presses "Capture" (A2).
   - 1.1 `capture` shows S5 with the claim's title, waiting in Held captures; "Open it" (A6) leads to `document`.
2. Mai opens it, reads it, and vouches for it (`document` A2), filling both fields.
   - 2.1 Before: `document` S2, the held banner with A2. After: S1, C3 naming Mai as voucher with the day.
3. Mai opens the project "Roof repairs" and opens the question from Test data (`project` A1, Asks for a reason). `waiting A1`
   - 3.1 `question` opens in S3 for the new question; `project` C7 lists it.
   - 3.2 No screen asks who the question is about (open question A1); a difference is an observation.
   - 3.3 The wizard puts this step after citing the claim; `document` refuses a citation while no question is open (its V1), so the question is opened first here (lane to confirm).
4. On the claim's `document`, Mai selects the words that make the claim, chooses the new question in "Cite in which question" (C8), the role from Test data, and presses "Cite this" (A9).
   - 4.1 The citation points at this copy, its page and the words selected.
   - 4.2 `question` for the question now shows the passage under C4 (Supports): its grade, the quoted words, a link to the claim's `document` at that passage, and Mai as the one who cited it.
5. On the question, Mai presses "Narrow the question" (`question` A12) and gives the narrower question and reason from Test data.
   - 5.1 A new narrower `question` opens, holding the narrower question's words.
   - 5.2 Where the report never says what it counts, the question shows its gap as undetermined, with its "because" line (C3; `every-screen` rule 2). How a member records that the city does not define it is not drawn (design silent: lane to confirm).
6. Mai gets the city's records (the wizard's step through "Get a record", J07): she searches Find for them (`finder` A1), finds none held (S2), follows "Capture it" (A11) to `capture`, and captures the list from its address (A2).
   - 6.1 `finder` S2 offers "Capture it"; `capture` then shows S5 for the list.
7. Mai opens the list on `document` and vouches for it (A2).
   - 7.1 `document` shows S1; C9 shows the spreadsheet fold with its rows read.
8. Mai searches Find for the list's words, and on its result presses "Count" (`finder` A8), filling the three fields from Test data.
   - 8.1 The count shows on `finder` (A8's counted line).
9. Mai opens the project's calculation from "This project's work" (`project` C11).
   - 9.1 `calculation` shows its one state: C1 the computed fact's name, the line that it is computed with its method shown, and the result as a number of a total, with its share and what it counts.
   - 9.2 C2, under "Method": the formula, its input (the list) with its capture date and grade.
   - 9.3 C5 shows only "Draw a random sample".
   - 9.4 That a count made on `finder` opens here is not drawn on either page (design silent: lane to confirm).
10. Mai presses "Draw a random sample" (`calculation` A5).
    - 10.1 C5 shows "The draw" with its seed, and which orders were drawn.
    - 10.2 C5's link "How spot-checks work" (A7) leads to `help`, which shows its five headings 2 (C2).
11. Mai visits one drawn order's address and records what she finds: Add, the tab for what she saw (`capture` S3), C20 filled from Test data with her photo, and "Record what you saw" (A16). `waiting A4`
    - 11.1 `capture` shows S10, her testimony recorded with its id.
    - 11.2 Whether Mai can look at her own photo inside Civicsmith is open question A4; a difference is an observation.
12. Back on `calculation`, Mai presses "Count it for the drawn report" (A6, Asks for a reason) for that order, with the reason from Test data.
    - 12.1 C5's rows "What members found" and "What it estimates" are counted again, with the counts and the exact range, and what it does not say.
13. On the question from step 3, Mai opens "Conclude" (C12), chooses to write the reading herself, fills the three fields from Test data, and presses "Conclude" (A11, Asks for a reason).
    - 13.1 `question` shows S8: heading 2 "Concluded", who concluded it and when, the reading marked as written by Mai, and what would change it with its strength.
    - 13.2 S7's buttons are offered: "Prepare a case from this", "Plan what to do", "Withdraw the conclusion…".

## End state

Checked after a reload, signed in as Mai:

1. `project` "Roof repairs" C7 lists the claim question, concluded, and the narrower question.
2. The claim question's `question` shows S8, with the cited claim passage under C4.
3. `calculation` shows the result, its method, the draw with its seed, and the members' finding from step 12.
4. The claim and the list open on `document` in S1, vouched for by Mai; the claim's C18 lists the question that cites it.
5. Mai's spot-check testimony is held as hers.

## Ways it can turn aside

1. Step 1 or 6, the address cannot be fetched: `capture` V2 or V3 beside the address; nothing is captured. Resumes at the same step once ARCH's address answers.
2. Step 4, no question chosen, or no role chosen: `document` V1, or the role's message; nothing is cited. Resumes at step 4.
3. Step 4, the passage cannot be cited yet: `document` V2, with the steps that make it citable. Resumes at step 4.
4. Step 5, a field left empty: `question` V4. Resumes at step 5.
5. Step 6, the records are not public: Mai requests them as in J07 steps 2 to 8; this journey waits for the office's reply (recorded as in J08 step 8, with the reply's document captured), then resumes at step 7.
6. Step 8, nothing picked or no words: `finder` V1 or V2. Resumes at step 8.
7. Step 9, Mai binds her own spreadsheet instead: "Bind your spreadsheet" and "Tie an input to the record" (`calculation` A4); C4 lists the binding. Resumes at step 10.
8. Step 11, "When" after now or a field missing: `capture` V9. Resumes at step 11.
9. Step 13, no reason given: `question` V1; nothing is concluded. Resumes at step 13.

## Changes

- 22 Nov 2026: written.
