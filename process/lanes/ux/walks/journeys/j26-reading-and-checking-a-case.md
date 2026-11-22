Length: 92 lines. Last section: "Changes".

# J26: Reading and checking a case

Journey page `j26-reading-and-checking-a-case` (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

Status: walkable, signed out · Screens used: `published`, `docket-public` · Follows: J15 · Followed by: J22, J23 (walk this before J23, which adds a second edition)

## Goal

"I found this tenants' team's case, understood how strong each finding is, and checked for myself that it is what they signed."

## Who

- A reader: anyone, with no account and no session, in a fresh browser at 1280 px and then at 390 px. Nothing on these pages assumes an account.
- No assistant: `published` and `docket-public` have no assistant part.

## Before it starts

1. J15 has been walked on this copy: Edition 1 of the case of project "Roof repairs at 14 Lakeshore Row" is published; its address is the one J15 step 24 noted.
2. The case has no docket entry and one edition (J23 not walked yet).
3. The reader's browser has never signed in to this copy, and has a folder to save a file in.

## Test data

| Item | Value |
|---|---|
| The case's address | `/app/published/<case id>` from J15 step 24 |
| Minimum strengths chosen | "How well the documents are held": "A only"; "How firmly they are linked": "A only" |
| The file to check | the file saved at step 9 |

## Steps

1. The reader opens the case's address.
   - 1.1 `published` shows S1 in the published frame: no rail, masthead, path or weight mark; the team's name "Lakeshore Tenants" at the head; the foot "lakeshore-tenants · signed by an owner of the project · {fingerprint}" and "Made with Civicsmith" (`every-screen` section 2).
   - 1.2 C1: the case's title, "Edition 1 · signed {date} · published {date}".
   - 1.3 C2: "This case is the work of Lakeshore Tenants." and `.howtoread`.
2. The reader reads the findings (C3) and the parts below them.
   - 2.1 C3 lists "Finding 1", its text from J15 step 13, "Relied on", and its two strengths in words with their letters (capture, connection), in `.meets` or `.below`; a link "the evidence".
   - 2.2 C4: "None since it was published." and `.corrections` with "its docket" as a link.
   - 2.3 C7 holds the statement of what the case leaves out, "Written by {writer} and published by {publisher}, {date}.", and "Who else read this statement" naming Rosa.
   - 2.4 C9 holds the team's lens statement.
   - 2.5 C5 lists no person (J15 named none) (design silent on its words when none is named: lane to confirm). The design's journey shows the timeline in two lanes; this screen's page names no timeline part (design silent: lane to confirm).
   - 2.6 No address or phone number of anyone shows anywhere on the page.
3. The reader opens "Finding 1" (A7).
   - 3.1 `published` shows S6: heading "Finding 1", the line "{case} · Edition 1 · Back to the whole case", "What would overturn it" with J15's "The city withdrawing or amending notice 2026-118", and "What it rests on" with "Leg 1" · "supports it".
4. The reader presses "Back to the whole case" (A4).
   - 4.1 S1 shows again.
5. The reader chooses the minimum strengths from Test data in C11 and presses A3 ("Show only findings this strong").
   - 5.1 S5: the box "A filtered view you built." with `.the.team.s.signature.covers`; either Finding 1, or the disclosure "When no finding meets the minimum".
   - 5.2 No request leaves the browser (the filter is done in the browser).
6. The reader presses "Back to the whole case".
   - 6.1 S1 shows Finding 1 again.
7. The reader presses A1 ("Check the signature").
   - 7.1 "The signature checks: this is what the team published." (`.verify.ok`).
8. The reader presses A8 ("Details of this work").
   - 8.1 C6 shows the four details, each "Stated" or "Not stated", and `.details.pub.current1`.
9. The reader presses A2 ("Download the complete edition") and saves the file.
   - 9.1 "The complete edition is downloaded." (`.download.done`); a file is in the folder.
10. The reader chooses that file in C12 ("Choose the file") and presses A6 ("Check it").
    - 10.1 C12 shows "Its fingerprint, worked out on your computer: {fingerprint}", then `published.check.yes` (design silent on whether the downloaded edition is the file this check expects: lane to confirm).
11. The reader presses A5 ("Print the case").
    - 11.1 S7 on screen (`.this.is.what.comes.out`), and the browser's print dialog opens.
    - 11.2 The print preview holds the title, "Edition 1 · published {date} · by Lakeshore Tenants", Finding 1, "Signed for {team} by {member} on {date}, with the key whose fingerprint is …" naming Mai, "Signature: ______" and "Printed in full: no minimum strength was set."
12. The reader closes the print dialog, presses "Back to the whole case", then the link "its docket" in C4.
    - 12.1 `docket-public`: heading "{case} · Docket", `.sub`, an empty list, and "Back to the case" (A1).
13. The reader presses "Back to the case".
    - 13.1 `published` S1 for the case.
14. The reader narrows the browser to 390 px and reads the page again.
    - 14.1 Nothing is cut off, the page does not scroll sideways, and every control of steps 3 to 12 is reachable.

## End state

Checked after a reload, still with no session:

1. `published` at the case's address shows S1 as in 1.1 to 2.6; A1 again gives `.verify.ok`.
2. The browser holds no session: opening `/app` shows `front`, not Home.
3. Nothing the reader did is recorded on the copy: no sign-in, no member, no docket entry.

## Ways it can turn aside

1. Step 1, a mistyped address: "Nothing is here. This address doesn't lead to any page of this Civicsmith." (`unavailable.public`); resume at step 1 with the right address.
2. Step 1, the edition's files are not built yet: S8 with one of `.casefile.*`; wait and reload; resume at step 1.
3. Step 2, the docket cannot be read: S4, C4 holds only `.corrections` with the link; the journey goes on.
4. Step 7, the signature does not check: `.verify.no` (or `.verify.none`); record it as a flaw and go on.
5. Step 10, nothing chosen: V1; a file the browser cannot read: V2; a browser that cannot work out fingerprints: V3 ("paste one instead"); resume at step 10.
6. Walked after J23: C1 links "Edition 1" and C4 shows S2 (`.corrections.some.one`); the journey goes on, the end state reading Edition 2.
7. The reader wants to recreate the case without the team, with the open checker: the design names it (`journeys.html` 26), but no part of this screen leads to it (design silent: lane to confirm).

## Changes

- 22 Nov 2026: written.
