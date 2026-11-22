Length: 95 lines. Last section: "Changes".

# J30: Getting into a project

Journey page `j30-getting-into-a-project` (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

Status: walkable · Screens used: `projects`, `project`, `front`, `home`, `members` · Follows: J28, J03 · Followed by: J27

## Goal

"I may not start projects of my own. I want to get into the team's projects: one I was invited to, and one I can find and ask to join, with its owner deciding."

## Who

1. Teo (`teo-r`), a member who may contribute and may not start projects (what a member gets unless an administrator chooses otherwise), signed in.
2. Mai (`mai-k`), a member who may start projects, as J28 leaves her, signed in: she starts the three projects and owns them.
3. Rosa (`rosa-l`), the administrator, named by the screens as the one who can let Teo start projects; she acts in no step.

## Before it starts

1. J28 has been walked on this copy: Rosa administers "Lakeshore Tenants"; Mai is a member who may start projects.
2. J03 has been walked on this copy, making Teo (`teo-r`) a member who may not start projects. (J03's Test data: no capability ticked beyond the default.)
3. None of the three projects in Test data exists.

## Test data

| Item | Value |
|---|---|
| Project 1 | "Lakeshore Row heating", findable |
| Project 2 | "Lakeshore bus shelters", findable |
| Project 3 | "Lakeshore Row rent rolls", hidden |
| Owner of all three | Mai (`mai-k`), who starts them |

## Steps

1. Mai opens `projects`, opens the fold "Start a project" (C8), types project 1's title in "What it is about", chooses "Findable: every member of the team sees it in Projects and can ask to join", and presses A6 "Start the project".
   - 1.1 `project` for project 1 opens in S2: its title, "Opened by mai-k on {date}." and the field "Your first question".
   - 1.2 C14's fold "This project's settings" shows it findable (`project.visibility.discoverable`).
2. Mai does the same for project 2 (findable) and for project 3, choosing "Hidden: only the members you invite know it exists".
   - 2.1 `projects` lists all three in its table, with "Ones you own" narrowing to the same three.
   - 2.2 Project 3's C14 shows the hidden line (`project.visibility.hidden`).
3. On project 3, Mai presses A9 "Invite a member to the project" and types `teo-r` in "The member's handle".
   - 3.1 C12 lists "teo-r (invited)".
4. Teo signs in on `front` and lands on `home`.
   - 4.1 `home` shows S3: the team's name (C1); the section "Getting into a project" with `.join.lead`; a row for project 3 with "Join" (A7); rows for projects 1 and 2 with "Ask to join" (A8); and `.join.nocreate` naming the administrators, `rosa-l`.
   - 4.2 No heading "What happened?" (C8) and no button "Start a project" (C9) are drawn, and nothing greyed stands for them.
   - 4.3 Only door A13 "Help for my own situation" is offered.
5. Teo presses "Join" (A7) on project 3's row.
   - 5.1 The row leaves "Getting into a project"; Teo is a member of project 3.
   - 5.2 Opening project 3 shows `project` S2 to him, C12 listing `teo-r` as a member, not invited.
6. Teo presses "Ask to join" (A8) on project 1's row, with a word on why. (design silent: `home` A8 draws no field for a word on why, though the journey's source has one; lane to confirm)
   - 6.1 The row reads "You asked to join on {date}. Its owners decide." with today's date, and offers "Withdraw your request".
7. Teo presses "Ask to join" on project 2's row.
   - 7.1 Project 2's row reads the same line, with "Withdraw your request".
8. Mai opens `home`.
   - 8.1 C3 "Needs you" holds two requests to join, one for project 1 and one for project 2, each naming `teo-r`, each with "Grant" and "Decline" (A6).
9. Mai presses "Grant" on Teo's request for project 1.
   - 9.1 The row leaves C3; the request for project 2 stays.
   - 9.2 Project 1's C12 lists "teo-r (invited)": granting invites him.
10. Teo opens `projects`.
    - 10.1 `projects` shows S3: C1, the table with project 3, the section "Invited" (C4) with project 1 and "Join" (A3), the section "Findable" (C5) with project 2 and "Withdraw your request".
    - 10.2 No fold "Start a project" (C8) is drawn; the note `.nocreate` names the administrators, `rosa-l`.
11. Teo presses "Join" (A3) on project 1.
    - 11.1 Project 1 leaves "Invited" and joins the table.
12. Teo presses "Withdraw your request" on project 2 in "Findable".
    - 12.1 Project 2's row offers "Ask to join" again; the request line is gone.
    - 12.2 Mai's `home` C3 no longer holds Teo's request for project 2 (after a reload).
13. Teo opens `members` from `settings`.
    - 13.1 `members` shows S2: C1, the table with each member, "May do" in words and "Expertise", and C3; no act.
    - 13.2 Rosa's row shows her the administrator; Teo's "May do" does not include starting projects.

## End state

Checked after a reload.

1. `projects`, as Teo, lists projects 1 and 3 in its table, project 2 under "Findable" with "Ask to join", and no "Start a project".
2. Projects 1 and 3, as Teo, show `project` S2 with `teo-r` a member in C12.
3. Project 2, as Teo, shows S4: its title and line, `project.notmember` and "Ask to join"; no documents, questions or members.
4. Mai's `home` C3 holds no request from Teo.
5. Project 3 does not show in "Findable" for a member not invited to it (design: hidden, only its invited members know it exists).

## Ways it can turn aside

1. **Nothing open to him.** If no project is findable and none invites him, `home` shows S4: "Getting into a project" with `.join.none`, and A13 only. The journey ends.
2. **The owner declines** (step 9). Mai presses "Decline": the row leaves C3; Teo's project 1 row offers "Ask to join" again. (design silent: whether Teo is told it was declined; lane to confirm) The journey resumes at step 12 with project 1 not joined.
3. **A hidden project by its address.** Teo opens project 3's address before step 3: `unavailable` S2, "You can't open this". Resume at step 3.
4. **Asking from the project itself.** On project 2's `project` S4, "Ask to join" (A18) does as `home` A8; after asking it reads `projects.request.asked` and offers "Withdraw your request".
5. **A title left empty** (step 1). Beside A6: V1 "Give the project a title first." Resume at step 1.
6. **Who can find it unchosen** (step 1). Beside A6: the shell's refusal (V2). Resume at step 1.
7. **Rosa lets Teo start projects.** If Rosa ticks that capability on his `members` row (A6), Teo's `home` shows "What happened?" and "Start a project", and `projects` shows C8. Not part of this journey.
8. **A read fails.** A block of `home` that cannot be read is drawn failed (S6), never empty. Reload and resume at the same step.

## Changes

- 22 Nov 2026: written.
