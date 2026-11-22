Length: 97 lines. Last section: "Changes".

# J14: Following a court case or proceeding

Journey page `j14-following-a-court-case-or-proceeding` (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1. Steps follow the wizard "Follow a proceeding" (library.json), walked here without its guide.

Status: walkable · Screens used: `capture`, `held`, `document`, `project`, `proceeding`, `person`, `queue` · Follows: J28, J31, J06 · Followed by: none

## Goal

"There is a court proceeding over the roof at 14 Lakeshore Row: I want its parties, its register and its orders, and the order's dates in our queue."

## Who

1. Mai (`mai-k`), a member of the project "Roof repairs" (J06), who may add work, signed in on her own device.
2. No AI account; nothing in this journey needs the assistant.

## Before it starts

1. J28 has been walked: Lakeshore Tenants exists; Mai is a member who may start projects and contribute.
2. J31 has been walked: the record follows "The landlord of 14 Lakeshore Row".
3. J06 has been walked: the project "Roof repairs" holds the question "Has the landlord been ordered to repair the roof of 14 Lakeshore Row?", and Mai is a member of it.
4. The team holds no court yet for its place, and the project holds no proceeding.

## Test data

| Item | Value |
|---|---|
| The order | An order of a court in a proceeding over the roof of 14 Lakeshore Row, which requires the landlord to do something by a stated date; captured from an address ARCH names for the development copy |
| The court | The court's name as the order's caption prints it |
| Kind of proceeding | The kind the select offers that fits the caption |
| Number | The proceeding's number as the caption prints it |
| Neutral label | "Roof repair proceeding, 14 Lakeshore Row" |
| Party | "The landlord of 14 Lakeshore Row" (J31), in the role the caption gives it |
| Register | The court's register page for the proceeding, at an address ARCH names; or, if it needs a login, none |
| Obligation | The order's paragraph that requires the landlord to act, with its date |
| Vouch fields | What you checked: "The caption, the number and the date match the court's register." What the team does about what remains: "Nothing remains." |
| Reasons (acts that ask for one) | "As the order's caption states." |

## Steps

1. Mai opens `capture` from the rail's "Add", gives the order's address in "Address", chooses the question from Test data in "For which question", and presses A2 ("Capture").
   - 1.1 `capture` shows state S5: `.address.done` naming the order's title and saying it waits in Held captures.
2. Mai follows the S5 line's way to `held` (or opens it from the rail's "Add" place).
   - 2.1 `held` lists the order under "Mine" (C3).
3. Mai presses the order's "Open it" (A4).
   - 3.1 `document` shows state S2, with the banner `document.held.says` and A2.
4. Mai presses A2 ("Vouch for this copy"), fills its two fields from Test data and sends.
   - 4.1 `document` shows state S1, "Vouched for by" Mai and the date.
5. Mai opens the project and follows its C11 link to `proceeding`.
   - 5.1 `proceeding` shows C2: the selects "The court or tribunal" and "The kind of proceeding", and the fold "When no court is held yet" open, since the team holds no court.
   - 5.2 C7's line on procedural facts shows.
6. In that fold Mai types the court's name from Test data and presses "Add a court" (A1).
   - 6.1 The court is offered in "The court or tribunal"; the fold no longer shows.
7. Mai chooses the court and the kind, gives the number and the neutral label from Test data, presses "Register the proceeding" (A1) and sends the reason.
   - 7.1 The fields for the number and the label are not named on the screen page (design silent: lane to confirm).
   - 7.2 C1's heading is the proceeding's name and number; under it the court and the neutral label.
8. Mai presses "Add a party by role" (A2), names the landlord from Test data in its role, and sends the reason.
   - 8.1 C3 "Parties" lists the landlord by role and name.
   - 8.2 The landlord's name is a link (A6).
9. Mai presses "Follow its register" (A3), giving the register's address from Test data.
   - 9.1 C4 "The register" lists the register's filings with their dates, the newest marked new; or, where the register needs a login, the line `.login.note` (design silent: lane to confirm how a member says the register needs a login).
   - 9.2 New filings found later reach Mai's `queue` (A3).
10. Mai presses "Hold an order as obligations" (A4) on the order, holds the paragraph from Test data with its date, and sends the reason.
    - 10.1 C6 lists the obligation as a "To do" with its due date.
    - 10.2 C5 "Dates" shows the date in the lane "The proceeding" or "Our deadlines on it" (design silent: lane to confirm which lane).
    - 10.3 Nothing on the screen advises what to file (C7).
11. Mai opens `queue` from the rail.
    - 11.1 `queue` shows S1, with an item of the kind "To do" for the obligation, showing "Due {date}" with the order's date (C5).
    - 11.2 The item sits under the case it belongs to, or under "Not in a case" (`.nocase`).
12. Mai goes back to `proceeding` and presses the landlord's name (A6).
    - 12.1 `person` opens on "The landlord of 14 Lakeshore Row", state S2.

## End state

Checked after a reload, signed in as Mai.

1. `proceeding` shows the proceeding with its court, number and neutral label, the landlord in C3, the register in C4 and the obligation in C6.
2. The project's C11 link to `proceeding` leads to it.
3. `queue` holds the "To do" with the order's due date.
4. The order shows `document` S1, vouched for by Mai.
5. Nothing on these screens carries the machine-work label.

## Ways it can turn aside

1. **Capture refused.** At step 1, a bad or unreachable address: `capture` V2 or V3 beside "Address"; nothing filed. Resume at step 1.
2. **Already held.** At step 1, the order was captured before: `capture` S6 with "Open it"; resume at step 4 if the copy is still held, else at step 5.
3. **A court is held.** At step 5, the team already holds a court: the fold does not show; Mai chooses the court and goes on at step 7.
4. **Empty reason.** Any act that asks for a reason, sent empty: `shell.reason.needed`; nothing is sent. Resume at the same step.
5. **Missing field.** At step 7 or 8, a needed field empty: the act's refusal beside it by its code (every-screen section 7); nothing is registered. Resume at the same step.
6. **Register needs a login.** At step 9: `.login.note` shows; new filings come only by a member's own capture (`capture` S1). The journey goes on at step 10.
7. **Not an order.** At step 10, the captured document is not an order: A4 is not offered (offered only for "an order captured"). The journey stops; the walk records which document was captured.
8. **Team out of reach.** `unavailable` S3; resume at the same step.

## Changes

- 22 Nov 2026: written.
