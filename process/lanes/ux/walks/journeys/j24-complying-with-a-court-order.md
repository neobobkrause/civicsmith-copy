Length: N lines. Last section: "Changes".

# J24: Complying with a court order

Journey page `j24-complying-with-a-court-order` (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

Status: walkable (the edition's stamp is design silent) · Screens used: `capture`, `held`, `docket`, `case-editor`, `ceremony`, `published`, `docket-public` · Follows: J15, J23 · Followed by: none

## Goal

"A court ordered us to take something out of our published case; we did it openly, and anyone can see what was removed and why."

## Who

- Mai, the project's owner, signed in on her own device at 1280 px, her signing key in this browser (J15 step 19). The index names an administrator; the design's journey names the project's owner, who alone signs a docket entry and an edition here (design silent on an administrator who is not an owner: lane to confirm).
- Rosa, member of the project, in a second browser, for the acknowledgement.
- A reader with no session, for the end state.
- No assistant: no step needs one.

## Before it starts

1. J15 and J23 have been walked on this copy: the case's latest published edition is Edition 2. Where J23 was not walked, read "Edition 2" below as "Edition 1" and "Edition 3" as "Edition 2".
2. The court order exists as the file in Test data, on the walker's device. It is test data: no court made it.
3. The case has no draft of a next edition.

## Test data

| Item | Value |
|---|---|
| The order's file | `court-order-test.txt`, text: "TEST ORDER. Lakeshore District Court orders Lakeshore Tenants to remove from its case on 14 Lakeshore Row the sentence about tenants' reports, pending a hearing." (made up for this journey) |
| How she got it; where and when | "I was handed it"; "Served at the team's address, today" |
| What it shows | "A court order to remove one sentence from our case's account." |
| Vouch fields | "The copy is the order as served" / "Read it against the paper copy" |
| Docket entry | kind Statement; answers Edition 2; rests on the order; from "Lakeshore District Court"; says "A court ordered us to remove one sentence of the case's account. Edition 3 complies."; goes to "Both" |
| What the next edition covers | "Edition 3 complies with the court's order." |
| The account, after | "The city inspected 14 Lakeshore Row and ordered the repair in notice 2026-118." |
| What changed | "Removed by court order (see the docket): the sentence about tenants' reports." |
| Every other reason asked | "To comply with the court's order." |

## Steps

1. Mai opens `capture` with the rail's "Add" and chooses the tab "A file or photo" (A1).
   - 1.1 `capture` shows S2: C16's drop area, C17's four ways "How you got it", C18's fields.
2. Mai chooses the order's file, "I was handed it", fills "Where and when" and "What it shows", chooses the project in "For which project", and presses A14 ("Capture this file").
   - 2.1 `capture` shows S9: `.file.done` naming `court-order-test.txt` and saying it waits in Held captures.
3. Mai opens `held`, ticks the order, fills the vouch fields, and presses A5.
   - 3.1 `held` shows S4 with a count of 1.
4. Mai opens `docket` from `project` C11 ("Docket").
   - 4.1 `docket` shows S1; C2 lists the entries J23 posted; C5 shows `.order`.
5. Mai fills C3 from Test data, choosing the order under "The document it rests on", and presses A1 ("File a docket entry").
   - 5.1 C2 lists the entry "drafted, not yet posted" (design silent on which of the four kinds an order takes: lane to confirm).
6. Mai presses A2 ("Post it") and signs with her key.
   - 6.1 Before it is done, `act.docketpost.does` shows; the button carries "You sign this" and the outward icon.
   - 6.2 After it: "Posted, signed." (`.posted.said`).
7. Mai ticks Finding 1 in C7, fills "What the next edition covers", and presses A3 with a reason.
   - 7.1 `case-editor` shows S1: "{case} · Edition 3", "Draft · prepared by" Mai.
8. Mai replaces "The account" (C11) with the account after, fills "What changed" (C12) and "What this bias means for this edition" (C8), and presses A2 ("Prepare the draft") with a reason.
   - 8.1 `.prepared` shows; after a reload the account reads as in Test data.
9. Rosa opens `case-editor` and presses A3 with a reason.
   - 9.1 C6 shows "Acknowledged by rosa-l".
10. Mai opens `ceremony` and walks J15 steps 21 to 23 for Edition 3.
    - 10.1 C1 reads "Publish {case}, Edition 3"; the steps end at S4.
11. Mai presses "Open the public page".
    - 11.1 `published` shows Edition 3: C1 with links "Edition 1" and "Edition 2"; C4 counts the corrections since Edition 1 (S3, `.corrections.some`) and names the latest.
    - 11.2 The account holds no sentence about tenants' reports.
    - 11.3 The edition is stamped with what was removed and why (design silent on where `published` shows the stamp: lane to confirm).
12. Mai presses "its docket".
    - 12.1 `docket-public` lists the entry of step 6, dated and "signed", and "Edition 3 published, superseding Edition 2".

## End state

Checked after a reload, in a browser with no session:

1. `published` for the case opens on Edition 3 as in 11.1 and 11.2.
2. `docket-public` lists the entry naming the order and the new edition (12.1).
3. Edition 2 still opens from its link: earlier editions are not removed (the order is complied with in a new edition).
4. Signed in as Mai: `docket` C2 shows the entry "posted"; the order's file is in the record, vouched, on the project's documents (`project` C5).

## Ways it can turn aside

1. Step 2, no file chosen: `capture` V7 ("Choose a file or take a photo first."); a statement missing: V7's `.file.missing`; resume at step 2.
2. Step 3, nothing ticked: `held` V1; resume at step 3.
3. Step 5, "From whom" or "What it says" empty: `docket` V1; resume at step 5.
4. Step 6, cannot be prepared for signing: V2 (`.prepare.failed`), nothing posted; resume at step 6.
5. Step 7, no finding or no scope: V3; nothing started; resume at step 7.
6. Step 10 on a phone: `ceremony` S6; resume on a computer.
7. The order seals rather than removes, or unseals: the design says an unsealing order is captured and named before the material is used (`journeys.html` 24); no screen part names it (design silent: lane to confirm).

## Changes

- 22 Nov 2026: written.
