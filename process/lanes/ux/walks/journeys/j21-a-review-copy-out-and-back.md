Length: N lines. Last section: "Changes".

# J21: A review copy, out and back

Journey page `j21-a-review-copy-out-and-back` (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

Status: walkable · Screens used: `review-copy`, `review-outside`, `case-editor`, `ceremony` · Follows: J28, then J15 steps 1 to 17 (a prepared draft, not yet signed) · Followed by: J15 from step 18 (the ceremony)

## Goal

"Before we publish, a housing-law professor outside the team reads our draft and tells us what to fix, and then she can't read it any more."

## Who

- Mai, the project's owner (J15), signed in on her own device at 1280 px.
- The reviewer, a named person outside the team, with no account, in a separate browser with no session.
- No assistant: neither `review-copy` nor `review-outside` has an assistant part.

## Before it starts

1. J15 has been walked to the end of its step 17 on this copy: project "Roof repairs at 14 Lakeshore Row" holds Edition 1 of its case as a prepared draft, acknowledged by Rosa; nothing is signed.
2. The team's time zone is set (else `review-copy` S4; turn-aside 1).
3. No review link has been made for the project.

## Test data

| Item | Value |
|---|---|
| The reader's name | "Noor Hale" (made up for this journey) |
| Their role | "Housing-law professor" |
| Until | 14 days after the day of the walk |
| Reason for sharing | "A housing-law check before we publish." |
| The reviewer's note on what the case does not cover | "Agreed: the repair itself is outside this case." |
| The reviewer's comment | "Say which department issued the notice." |
| Mai's reply | "Thank you: the scope now names the housing department." |
| The revised scope | "Whether the city's housing department has ordered the repair of the roof of 14 Lakeshore Row" |

## Steps

1. Mai opens `review-copy` from `project` C11 ("Review copies").
   - 1.1 `review-copy` shows S1: C1 heading "Share this edition for review" and `.sub`; the path strip at "Shared for review".
   - 1.2 C3 lists no reader; C5 lists no live link.
2. Mai presses A1 ("Share with a named reader") and fills the reader's name, role, "Until" and the reason from Test data.
   - 2.1 Before it is done, `act.reviewgrant.does` and `mark.path.shared-for-review.means` show; the button carries "Asks for a reason" and the outward icon.
   - 2.2 After it: C6 shows the reader's link (`…/app/review#grant=…`), `.link.line` naming Noor Hale and the end date, and `.link.once`.
   - 2.3 C3 lists Noor Hale, her role, and "can read until {until}"; the band reads "1 people outside the team can read this until {date}" (`.band`) (design silent on the count's form at 1: lane to confirm).
3. Mai presses "Copy the link" and gives the link to the reviewer's browser (Civicsmith sends no email).
   - 3.1 The link is on the clipboard; C6 says it is shown once.
4. The reviewer opens the link in her browser, with no session.
   - 4.1 `review-outside` shows S1 in the published frame (no rail, no masthead): C1 heading "A review copy from Lakeshore Tenants", `.sub` and `.until` with the end date.
   - 4.2 C2 (`.comments.go`) shows; C3 heading "The case: {case}, Edition 1 (draft)".
5. The reviewer presses "Read the whole draft" (A3).
   - 5.1 The whole draft shows on the same screen, its scope among it.
6. The reviewer types her note in C4's "Your note" and presses A2 ("Acknowledge it") with a reason.
   - 6.1 The acknowledgement is recorded; C4 no longer offers A2 (design silent: lane to confirm).
7. The reviewer types her comment in C5 and presses A1 ("Send your comment").
   - 7.1 `review-outside` shows S3: "Sent to the team." (`.sent`).
8. Mai reloads `review-copy`.
   - 8.1 C7 lists the comment, "Noor Hale, an outside reader", with today's date and "Reply" (A3).
   - 8.2 C7 shows `.acked` naming Noor Hale and today.
   - 8.3 C5 lists the link with "1 comment".
9. Mai presses "Reply", types her reply in "Your reply", and sends it.
   - 9.1 C7 shows her reply under the comment.
10. Mai opens `case-editor` from C2's live-links line, changes the Scope to the revised scope, and presses A2 ("Prepare the draft") with a reason.
    - 10.1 `.prepared` shows; C2's choice "Which draft" lists two drafts, the newer marked "newest".
    - 10.2 C2 reads "1 review links are live, 1 of them on an earlier draft." (`.links.live.one`).
    - 10.3 C3 shows the link "Read what outside readers said (1)".
11. Mai opens `review-copy` and presses A2 ("Stop sharing") on Noor Hale's link, then "Confirm".
    - 11.1 Before it is done, the dialog shows `act.reviewrevoke.does`; the button carries "Ends something".
    - 11.2 After it: C3 reads "could read Edition 1 until {until}: ended" (`.reads.ended`); C5 lists no live link.
12. The reviewer reloads her link.
    - 12.1 `review-outside` no longer shows the draft: it shows the refusal for a stopped link, as an alert with words, not a code (design silent on its words: lane to confirm).
13. Mai opens `ceremony` from `project` C11 ("Publishing").
    - 13.1 `ceremony` shows S5, as at J15 step 18.1; its choice "Which draft" (C3) has the newest draft chosen, the one prepared after the review (design silent on whether C3 shows in S5, and on how the edition names the draft that was reviewed: lane to confirm).
    - 13.2 The journey goes on at J15 step 18.

## End state

Checked after a reload:

1. `review-copy` C3 lists Noor Hale with `.reads.ended`; C7 holds her comment, Mai's reply and `.acked`; C5 holds no live link.
2. `case-editor` C2 lists both drafts, the newest with the revised scope; C3's link reads "Read what outside readers said (1)".
3. The reviewer's link, opened with no session, shows no part of the draft.
4. Nothing of the case is public: `published` for the project's case does not exist until J15 step 23.

## Ways it can turn aside

1. Step 1, the team's time zone not set: `review-copy` S4 (`.until.nozone` to an administrator, `.until.nozone.member` to Mai), no A1; Rosa sets the zone under Settings; resume at step 1.
2. Step 2, a field empty: V1 (`.reader.needed`); a past "Until": V2 (`.until.bad`); nothing shared; resume at step 2.
3. Step 4, the link opened with its `#grant=…` part lost: `review-outside` S2 (`.nolink`); resume at step 4 with the whole link.
4. Step 6, "Your note" empty: the shell's refusal beside the act ("Fill in {field} first. Nothing was sent."); resume at step 6.
5. Step 7, the comment empty: V1 (`.comment.needed`); resume at step 7.
6. Step 9, the reply empty: V3 (`.reply.needed`); resume at step 9.
7. Mai saves a stamped file instead (A4, "Save as a file"): S2 with "A file can't be recalled" and the tick box; the file is saved in the browser and cannot be stopped by step 11. Not part of this journey; resume at step 11.
8. No draft prepared (J15 not walked to step 17): `review-copy` S3 with "Make a draft" to `case-editor`; walk J15 to step 17 first.

## Changes

- 22 Nov 2026: written.
