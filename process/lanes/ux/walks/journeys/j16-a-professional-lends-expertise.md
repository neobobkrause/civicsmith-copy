Length: 111 lines. Last section: "Changes".

# J16: A professional lends expertise

Journey page `j16-a-professional-lends-expertise` (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

Status: walkable · Screens used: `members`, `join`, `home`, `account`, `project`, `projects`, `question`, `queue`, `calculation` · Follows: J28, J09 · Followed by: none

## Goal

"I am an accountant. I want to join, say what I know, and check the team's sums when someone asks me, so readers know who looked."

## Who

1. Ana, a new member, an accountant. Signed out until she joins; then signed in as `ana-p`. She may contribute, as a member gets unless an administrator chooses otherwise.
2. Rosa (`rosa-l`), the administrator, signed in: she invites Ana and confirms her expertise.
3. Mai (`mai-k`), a member of the project J09 leaves, signed in: she brings Ana into the project and asks for the check.

## Before it starts

1. J28 has been walked on this copy: Rosa administers "Lakeshore Tenants"; Mai is a member.
2. J09 has been walked by Mai on this copy: a project Mai is in holds a question citing a calculation (a computed fact on `calculation`) that Mai made, its result accepted. J09's Test data names the project, the question and the calculation; this page calls them "J09's project", "J09's question" and "J09's calculation".
3. Ana is not a member: `members` lists no `ana-p`.

## Test data

| Item | Value |
|---|---|
| Invitation's short id | `ana` |
| Cover the team knows her by | "Ana, the accountant" |
| Ana's handle | `ana-p` |
| Ana's password | A password of 12 or more characters ARCH holds, never printed |
| Ana's expertise | "Certified public accountant (CPA)" |
| Expertise Mai asks for | "Accounting" |
| What Mai asks to check | "Check the sum and its inputs on J09's calculation." |
| Ana's reason for her check | "Recomputed from the cited inputs; the sum and the share agree." |

## Steps

1. Rosa opens `members`, fills "Invite a member" (C6) with the short id and the cover from Test data, ticks no further capability, and presses A1 "Create the invitation link".
   - 1.1 C7 shows `.invite.shown` and the invitation link, once; C6 shows `.invite.noemail`.
   - 1.2 C2 lists a row for Ana's cover with the status "Not joined yet".
2. Ana opens the invitation link, which Rosa passed to her outside Civicsmith, and types `ana-p` in "Your handle", then presses A1 "See whether a handle is free".
   - 2.1 `join` shows S1: C1 names Rosa, the link's expiry and "You were invited as" her cover.
   - 2.2 C4 reads "ana-p is free in Lakeshore Tenants" (`handle.free`).
3. Ana types her password twice and presses A2 "Join with a handle and password".
   - 3.1 `join` shows S6: "You have joined, signed in as ana-p on this device." and her ten recovery codes, with "Save them as a file" and "Copy them".
4. Ana presses A6 "Go to your team's home", then "Not now" on the welcome.
   - 4.1 `home` shows S3 (she may not start projects): the welcome, then "Getting into a project".
5. Ana opens `account` (shell menu "Your account"), types her expertise from Test data in "Your expertise (optional)" (C5) and presses A4 "Declare your expertise".
   - 5.1 C5 shows "Declared: Certified public accountant (CPA)" and `.expertise.declared`.
   - 5.2 After a reload, C5 still shows it.
6. Rosa opens `members`.
   - 6.1 C2's row for `ana-p` shows the status of a joined member and, under "Expertise", her declared expertise.
   - 6.2 Rosa's `home` C3 or `queue` holds a routed to-do "Confirm expertise" for it. (design silent: whether declaring raises such a to-do; `home` A16 and `queue` A14 draw one when routed; lane to confirm)
7. Rosa opens Ana's row panel (A16, `/app/members/ana-p`) and presses A10 "Confirm declared expertise".
   - 7.1 The row's "Expertise" reads "confirmed: Certified public accountant (CPA)".
   - 7.2 Any routed to-do for it has left Rosa's `home` and `queue`.
8. Ana reloads `account`.
   - 8.1 C5 shows `.expertise.confirmed`.
9. Mai opens J09's project and presses A9 "Invite a member to the project", typing `ana-p` in "The member's handle".
   - 9.1 C12 lists "ana-p (invited)".
10. Ana opens `projects` and presses "Join" (A3) on J09's project in "Invited" (C4).
    - 10.1 J09's project leaves "Invited" and is listed in the table (C3).
    - 10.2 Opening it shows `project` S1; C12 lists `ana-p` as a member.
11. Mai opens J09's question and presses A12 "Ask for a check by expertise", naming the expertise and what to check from Test data, and sends it.
    - 11.1 The request is sent; `question` shows no refusal. (design silent: the line `question` draws once a check is asked for; lane to confirm)
12. Ana opens `queue` from the rail.
    - 12.1 `queue` is in S1 and lists one item of the kind "To do" for the check, in J09's project's case group or "Not in a case".
    - 12.2 The item offers A8 "Open the check" and "Pass it to another member".
13. Ana presses "Open the check" (A8).
    - 13.1 J09's question opens (the screen the check concerns), its C4 listing the cited calculation with a link to it.
14. Ana opens J09's calculation from that link.
    - 14.1 `calculation` shows C1 (the fact's name, `.sub` and its result) and C2 "Method": the formula, each input with its capture date and grade, and who checked it so far.
    - 14.2 C3 offers A2 "Record a second member's check", with the weight "Asks for a reason": Ana is not its author.
15. Ana presses A2 and sends it with her reason from Test data.
    - 15.1 The reason field opens beside A2 (page "Every screen", section 6); after sending, the button shows done.
    - 15.2 C2 names Ana's check: `ana-p` and today's date.
    - 15.3 The check's item has left Ana's `queue`. (design silent: whether an act on another screen settles the queue item; lane to confirm)
16. Mai reloads J09's question and opens its calculation.
    - 16.1 `calculation` C2 names Ana's check, by `ana-p`, with today's date.
    - 16.2 Beside Ana's check her confirmed expertise is shown, on `calculation` and on `question`. (design silent: the part of `question` or `calculation` that shows a checker's expertise; journeys.html J16 says "Their declared expertise shows beside their checks"; lane to confirm)

## End state

Checked after a reload.

1. `members`, as Rosa, lists `ana-p` joined, "Expertise" "confirmed: Certified public accountant (CPA)"; as Mai (S2), the "Expertise" column shows the same.
2. `account`, as Ana, shows `.expertise.confirmed`.
3. J09's project lists `ana-p` as a member (C12).
4. J09's calculation, opened by any member of the project, names Ana's check with her handle and date in C2.
5. Ana's `queue` holds no item for the check.

## Ways it can turn aside

1. **Handle taken** (step 2). C4 reads `handle.taken` with a suggestion; on A2, V2. Resume at step 2 with another handle, kept in Test data.
2. **Passwords differ or too short** (step 3). V4 `screen.entry.differ` or V5 `screen.entry.short`; nothing is sent. Resume at step 3.
3. **A used or expired link** (step 2). `join` S5 "This link no longer works"; no form. Rosa withdraws it (A12) and resumes at step 1.
4. **Expertise left empty** (step 5). Beside A4: V2 "Say what you know first. Nothing was sent." Resume at step 5.
5. **Confirming refused** (step 7). Beside A10, the refusal in the words of the fold "When confirming or withdrawing an expertise is refused" (C5). The expertise stays declared; the journey goes on from step 9, and the end state reads "Declared".
6. **Not confirmed.** Confirmation gates nothing: without step 7, steps 9 to 16 go on, and the expertise reads declared, not confirmed.
7. **Check request left empty** (step 11). Beside A12: V5 "Name the expertise needed and say what to check." Resume at step 11.
8. **Nobody holds that expertise** (step 11). (design silent: what `question` shows when no member has declared the expertise asked for; lane to confirm)
9. **Ana is the calculation's author.** A2 is not offered on `calculation` (A2: "a member other than its author"); another member must check.
10. **Ana not in the project** (step 14). `calculation` is not hers to see: `unavailable` S2. Resume at step 9.
11. **Reason left empty** (step 15). Beside A2: `shell.reason.needed`; nothing is sent. Resume at step 15.
12. **Ana passes it on** (step 12). "Pass it to another member" opens "Forward to (the member's handle)"; the item leaves her queue for theirs, and the journey ends without her check.

## Changes

- 22 Nov 2026: written.
