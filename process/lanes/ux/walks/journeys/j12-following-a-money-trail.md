Length: 94 lines. Last section: "Changes".

# J12: Following a money trail

Journey page `j12-following-a-money-trail` (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1. Steps follow the wizard "Follow the money" (library.json), walked here without its guide.

Status: walkable (the period of a figure is `waiting A2`) · Screens used: `capture`, `held`, `document`, `project`, `money` · Follows: J28, J06 · Followed by: none

## Goal

"I want to see what the city set aside for housing inspections and what it reports, each figure with its stage and period, and where two sources differ, the difference named."

## Who

1. Mai (`mai-k`), a member of the project "Roof repairs" (J06), who may add work, signed in on her own device.
2. No AI account; nothing in this journey needs the assistant.

## Before it starts

1. J28 has been walked: Lakeshore Tenants exists; Mai is a member who may start projects and contribute.
2. J06 has been walked: the project "Roof repairs" holds the question "Has the landlord been ordered to repair the roof of 14 Lakeshore Row?", and Mai is a member of it.
3. The project holds no money trail, and neither document of Test data is in the record.

## Test data

| Item | Value |
|---|---|
| Document 1 | Lakeshore's adopted budget (the city's own document), captured from an address ARCH names for the development copy |
| Document 2 | Lakeshore's annual financial report for the same year, captured the same way |
| The figure | The line for housing code inspections (or the nearest line the budget prints for housing enforcement): its amount exactly as printed |
| Stage, document 1 | adopted |
| Stage, document 2 | actual (as reported) |
| Period | The fiscal year the document states for the figure (`waiting A2`: whose fiscal year) |
| Trail name | "Housing inspections, Lakeshore" |
| Vouch fields | What you checked: "The address is the city's, and the title page matches." What the team does about what remains: "Nothing remains." |
| Reasons (acts that ask for one) | Include: "This line pays for the inspections that issue housing notices." Compare: "Two sources of one figure." |

## Steps

1. Mai opens `capture` from the rail's "Add", gives document 1's address in "Address", chooses the question from Test data in "For which question", and presses A2 ("Capture").
   - 1.1 While it is fetched, A2 shows working (every-screen section 6).
   - 1.2 `capture` shows state S5: the line `.address.done` naming the document's title and saying it waits in Held captures.
2. Mai follows the S5 line's way to `held` (or opens it from the rail's "Add" place).
   - 2.1 `held` lists document 1 under "Mine", with "No project yet" or the project's name (C3).
3. Mai presses document 1's "Open it" (A4).
   - 3.1 `document` opens in state S2: the banner `document.held.says` and A2.
4. Mai presses A2 ("Vouch for this copy"), fills its two fields from Test data and sends.
   - 4.1 `document` shows state S1, with C3 "Vouched for by" Mai and the date.
   - 4.2 Document 1 is among the project's documents (`project` C5) (design silent: lane to confirm that capturing for the question files it in the project).
5. Mai opens the project and follows its C11 link "Money trail".
   - 5.1 `money` shows C1 and C2 and an empty table (no trail yet).
6. Mai presses "Read a figure" (C2) and reads the figure from document 1: its amount as printed, stage "adopted", and its period. `waiting A2`
   - 6.1 The figure form asks the figure's kind, its stage, the amount and currency, its period, and the passage it is read from (design silent: lane to confirm the form; the screen page names no field, `find-in` C9 names the like fields).
   - 6.2 C5 gains a row: "Stage" adopted, "Period" as Mai gave it, "Amount" as printed, "Source" document 1.
   - 6.3 A column the document does not state reads "Undetermined: …" with the evidence that would settle it, never a guess.
   - 6.4 Opened, the figure shows who read it from which passage, and the budget note `.budget.about`.
   - 6.5 Whose fiscal year the period counts in is not settled (A2); the walk records which year the screen shows and how it names it, as an observation, not a flaw.
7. Mai presses "Start a money trail" (C2) and names it from Test data.
   - 7.1 The new trail's `money` page opens with C1 heading "Housing inspections, Lakeshore" and who started it.
8. Mai opens the figure of step 6, presses "Include with a reason" and sends the reason from Test data.
   - 8.1 The figure's "In this trail?" column shows it included, with the reason.
9. Mai captures and vouches for document 2 as in steps 1 to 4.
   - 9.1 Document 2 is vouched for and among the project's documents.
10. On the trail's `money` page Mai presses "Read a figure" and reads the same line from document 2: its amount as printed, stage "actual", and its period. `waiting A2`
    - 10.1 C5 gains a second row with document 2 as its source; the row of step 6 is unchanged.
11. Mai opens the figure of step 6, presses "Compare two sources", chooses the figure of step 10 and sends the reason from Test data.
    - 11.1 The comparison shows on the same screen, naming each figure's source, stage and period.
    - 11.2 Where the two amounts differ, the difference is named by its kind (basis, period or rounding) or as not explained; where they agree, it says so (design silent: lane to confirm the words).
    - 11.3 Both figures stay in C5; neither replaces the other (C8).

## End state

Checked after a reload of the trail's `money` page, signed in as Mai.

1. The trail "Housing inspections, Lakeshore" exists, started by Mai.
2. C5 holds the two figures, each with its stage, period, amount and source; the first is included with its reason.
3. The comparison of step 11 can be seen again on the figure (design silent: lane to confirm it is kept).
4. Documents 1 and 2 show `document` S1, vouched for by Mai.
5. Nothing on the screen carries the machine-work label.

## Ways it can turn aside

1. **Bad address.** At step 1, an address that is not https or has spaces: `capture` V2 beside "Address"; nothing captured. Resume at step 1.
2. **Fetch refused.** At step 1, the site refuses, does not answer, takes over 25 seconds, is empty or too large: one of `capture` V3 beside the address; nothing filed. Resume at step 1 once ARCH's address answers.
3. **Already held.** At step 1 or 9, the same document was captured before: `capture` S6 with "Open it" (A6); the journey resumes at step 4 with that document if it is still held (`document` S2), else at step 5.
4. **Vouch fields empty.** At step 4: `document` V3; the copy stays held. Resume at step 4.
5. **Not read yet.** At step 6, the document is still being read (`document` S4): no passage can be cited; wait for `.reading.done`, then resume at step 6.
6. **Reason empty.** At step 8 or 11: `shell.reason.needed`; nothing changes. Resume at the same step.
7. **Period undetermined.** At step 6, the budget does not state its period: "Period" reads "Undetermined: …" with what would settle it; the journey goes on. `waiting A2`
8. **Team out of reach.** `unavailable` S3; resume at the same step.

## Changes

- 22 Nov 2026: written.
