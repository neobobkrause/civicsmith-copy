Length: 115 lines. Last section: "Changes".

# J20: From a knock to the record

Journey page `j20-from-a-knock-to-the-record` (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

Status: walkable (who sees what is known of a source is `waiting A3`) · Screens used: `doorbell`, `queue`, `inbox`, `about-knocker`, `held` · Follows: J28 · Followed by: none

## Goal

For the outsider: "I have photographs of the roof at 14 Lakeshore Row and I want the tenants' team to have them, without making an account or saying who I am." For the member: "What was handed in becomes evidence, or is set aside with a reason."

## Who

1. The outsider: anyone, with no account, signed out, in a browser that holds no session of the team's Civicsmith (a private window will do).
2. Rosa (`rosa-l`), administrator, signed in on her own device. Any member could do her part (`inbox`, "Who can see it").
3. No AI account; neither `doorbell` nor `inbox` offers the assistant.

## Before it starts

1. J28 has been walked: Lakeshore Tenants exists, with Rosa as administrator and Mai as a member.
2. The team's `inbox` holds no knock (state S1), or the walk notes which knocks it already holds.
3. None of the three files of Test data is held in the record.

## Test data

| Item | Value |
|---|---|
| File 1 | A photograph of a roof, as a JPEG under the doorbell's size limit, named "roof-1.jpg" |
| File 2 | A second, different photograph, named "roof-2.jpg" |
| File 3 | A short PDF on another subject, named "other.pdf" |
| Note with file 1 | "The roof at 14 Lakeshore Row, from the street." |
| Secret phrase | The one the doorbell makes for the outsider at step 2 ("Make one for me"); written down by the walker |
| Discard reason | "Not about 14 Lakeshore Row." |
| What shows it is the same person | "Both knocks presented the same secret phrase." |
| Vouch fields | What you vouch for: "Photographs handed in through the doorbell." What you did to check: "Opened both; each shows a roof." |

## Steps

1. The outsider opens the team's address `/doorbell`, signed out.
   - 1.1 `doorbell` shows state S1 in the public frame: no rail, no masthead, no path, no weight mark (every-screen section 2).
   - 1.2 C1 shows "Lakeshore Tenants" above the heading; C2 and C3's four lines follow.
   - 1.3 The browser tab reads "{page} · Lakeshore Tenants" (`page.title.public`).
   - 1.4 No field asks for a name, an email or an account.
2. The outsider chooses file 1, writes the note from Test data, ticks "Make one for me" (C7) and presses "Hand it over" (A1).
   - 2.1 `doorbell` shows S2, S3 and S4 together: the received line with its date, the fingerprint, the size, "Your reference", "Your pseudonym", and "Your secret phrase" with its note.
   - 2.2 The note and phrase fields are emptied.
   - 2.3 The walker writes down the reference, the fingerprint, the pseudonym and the secret phrase.
3. The outsider reloads the page.
   - 3.1 `doorbell` shows S1; the secret phrase of step 2 is no longer shown anywhere.
4. The outsider chooses file 2, types the secret phrase of step 2 in "A secret phrase (optional)" and presses "Hand it over".
   - 4.1 `doorbell` shows S3: a new reference and fingerprint, and the same pseudonym as in step 2.
   - 4.2 No secret phrase is shown (S4 does not show).
5. The outsider chooses file 3, with no note and no phrase, and presses "Hand it over".
   - 5.1 `doorbell` shows S2 only: no pseudonym, no secret phrase.
6. Rosa opens `queue` from the rail.
   - 6.1 `queue` carries the door "Inbox" (drawn while a knock is new).
7. Rosa opens the door "Inbox".
   - 7.1 `inbox` shows S2: three rows, newest first, each "{size} handed in on" its date, with the size in KB or MB, never bytes.
   - 7.2 Each row's status is "New".
   - 7.3 The row of file 3 shows C5 as `screen.inbox.nonote`; the row of file 1 shows C5 with the note from Test data.
   - 7.4 The rows of files 1 and 2 each show C6, counting 1 other knock; the row of file 3 shows no C6.
8. Rosa opens file 1's row (A6).
   - 8.1 `inbox` shows S3: C8 with the fingerprint written down at step 2, letter for letter.
   - 8.2 C9's ladder marks "Same knocker" as the current rung.
   - 8.3 A1, A2 with the field of V1, and A4 are offered; the knock's id shows only in the folded "Reference" (C12).
9. Rosa presses "See this knocker's other material" (A4).
   - 9.1 C10 lists file 2's knock, as a link, with its two lines saying it is the same knocker and nothing about who they are.
10. Rosa presses "Move into the record" (A1).
    - 10.1 `inbox` shows S6; the knock's status is "In the record".
    - 10.2 A1 and A2 are no longer offered on this knock.
11. Rosa opens file 2's knock from C10 and presses "Move into the record".
    - 11.1 `inbox` shows S6 for file 2; its status is "In the record".
12. Rosa opens file 3's knock, writes the discard reason from Test data in V1's field and presses "Discard with a reason" (A2).
    - 12.1 `inbox` shows S9; the status is "Discarded", and C7 shows the reason.
13. On file 2's knock (now S4), Rosa chooses file 1's source in "The same person as source" (offered as "{source}, the same knocker, who handed in {knock}"), writes the evidence from Test data and presses "Record what is known of the source" (A3). `waiting A3`
    - 13.1 `inbox` shows `screen.inbox.link.done`.
    - 13.2 The ladder stays at "Same knocker": no name and nothing about who they are is recorded or shown.
    - 13.3 Who may read this link is not settled (A3, recommendation: the listed members only); the walk records who can see it as an observation, not a flaw.
14. Rosa follows the link "A source" (C11, A7) on file 2's knock. `waiting A3`
    - 14.1 `about-knocker` shows its C1 and C2, the ladder at "Same knocker".
    - 14.2 C3 lists a row "A link to another source", or the screen shows S1 with no C3 (design silent: lane to confirm whether the link of step 13 is a row here).
    - 14.3 No "Help me write this" button is drawn (S4).
15. Rosa opens `held`, chooses "Everyone's" in "Whose captures", ticks the captures of files 1 and 2, fills the vouch fields from Test data and presses "Vouch for them" (A5).
    - 15.1 Before vouching, `held` lists both captures (C3).
    - 15.2 `held` shows S4, counting 2.

## End state

Checked after a reload, signed in as Rosa.

1. `inbox` lists three knocks: files 1 and 2 "In the record", file 3 "Discarded" with its reason.
2. File 2's knock (S4) shows the link "A source"; `about-knocker` shows the ladder at "Same knocker", and no name.
3. `held` no longer lists files 1 and 2; they are in the record, vouched for by Rosa.
4. Signed out, `/doorbell` shows S1 again, with nothing of the three knocks on it.
5. Signed in as Mai, `inbox` lists the same three knocks; whether Mai sees the source link of step 13 is `waiting A3`.

## Ways it can turn aside

1. **No file.** At step 2, 4 or 5, "Hand it over" with no file: `doorbell` V1 beside the button; nothing is received (S5). Resume at the same step.
2. **Too large.** A file larger than the doorbell takes: V2; nothing received. The walker picks a smaller file; resume.
3. **Short phrase.** At step 4, a phrase under 20 characters: V3; nothing received. Resume at step 4 with the phrase of step 2.
4. **Too many hand-overs.** V4; the walker waits ten minutes and resumes at the same step.
5. **Not kept.** V5: nothing was handed over; resume at the same step.
6. **Phrase lost.** The walker did not write the phrase down at step 2: a reload does not show it again (S4). The journey goes on with file 2 handed over under a new made phrase; step 7.4 and steps 9, 13 then do not apply, and the walk records it.
7. **Discard without a reason.** At step 12, A2 pressed with the reason empty: V1 (`refusal.RESOLVE_NO_REASON`); the knock stays New. Resume at step 12.
8. **Same file again.** A file whose bytes the record holds already is moved in: `inbox` S8, with the holding document as a link; nothing new is written.
9. **Put back.** On file 3's discarded knock (S5), "Put it back" with a reason: S10; its status is "New" again, and the discard and its reason stay on the record.
10. **No other source.** At step 13, no other source exists: `screen.inbox.link.none` in place of the form. The journey ends at step 12's state plus step 15.
11. **Evidence left empty.** At step 13: V2 names the empty field; nothing is recorded. Resume at step 13.
12. **Team out of reach.** The outsider's page or Rosa's screen: `unavailable` (S3 for Rosa); nothing the outsider sent is received until the doorbell shows S2. Resume at the same step.

## Changes

- 22 Nov 2026: written.
