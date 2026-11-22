Length: 100 lines. Last section: "Changes".

# J03: A member joins and finds their footing

Journey page `j03-a-member-joins-and-finds-their-footing` (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

Status: walkable · Screens used: `members`, `join`, `home`, `question`, `connect`, `ties`, `capture`, the wizard guide (every-screen, section 5) · Follows: J28, J02 · Followed by: none named yet.

The member's steps are those of the wizard "Welcome a new member" (7 steps), opened by `join` A6; the administrator's invitation comes first. The guide shows the step it is on as step {n} of 7 with the library's "what" and "why" for it; its own controls (next, stop, a side trip's skip) are not on a Screens page yet (design silent: lane to confirm their words).

## Goal

"I open the invitation I was sent, join in my own language, and take a first useful step."

## Who

1. Rosa, signed in, the administrator (from J28), who makes the invitation.
2. Teo, a reporter, the newcomer: no account at the start; after step 4 a member with what a member gets by default (may contribute, may not start projects).

## Before it starts

1. J28 has been walked on this copy (team "Lakeshore Tenants"; Rosa `rosa-l` its administrator; Mai `mai-k` a member), and J02 (the team has said who it is, for members only).
2. The team has no project and no question.
3. Rosa is signed in in a desktop browser; Teo uses another desktop browser with no session.
4. No AI account is connected.

## Test data

| Item | Value |
|---|---|
| Invitation | short id `teo`; cover "Teo, from flat 9"; no capability ticked beyond the default |
| Teo's language | English |
| Teo's handle | `teo-n` |
| Teo's password | 12 characters or more, chosen by the walking session, never reported |
| Teo's first step | capture housing notice 2026-118 from its address (served on the development copy where ARCH says) |

## Steps

1. Rosa opens `members` and makes the invitation (C6: the short id and cover; no capability ticked), then A1.
   - 1.1 C7 shows the invitation link once, with `.invite.noemail`.
   - 1.2 The roster lists the invitation as "Not joined yet".
2. Teo opens the link Rosa sent him (outside Civicsmith).
   - 2.1 `join` shows S1: "You're invited to Lakeshore Tenants", who invited him, and "You were invited as Teo, from flat 9" (C1).
   - 2.2 The address no longer holds the invitation.
3. Teo chooses his language (C2; wizard step 1).
   - 3.1 The choice starts from his device's setting and lists each language in its own name.
   - 3.2 After choosing, the page reads in that language.
4. Teo types his handle and checks it (A1), then his password twice, and joins (A2) (wizard step 2).
   - 4.1 While he types, C4 says `teo-n` is free in Lakeshore Tenants (S1), under C3's line that a handle can't be changed.
   - 4.2 After A2, `join` shows S6: joined, signed in as `teo-n` on this device; his ten recovery codes, with the buttons to save and copy them.
5. Teo saves his ten codes as a file and follows A6, "Go to your team's home" (wizard step 3).
   - 5.1 `home` opens in S4 (may not start projects, nothing open to him): C1 with the team's name and its description; "Getting into a project" with `.join.none`; A13. No "What happened?" doors (C8) and no "Start a project" (C9).
   - 5.2 The guide "Welcome a new member" is open beside Home at step 3 of 7.
   - 5.3 The masthead shows "You: teo-n" and no "Assistant" button.
6. Teo goes to the guide's next step (wizard step 4: a question's strength against its bar, and "Undetermined").
   - 6.1 The guide is at step 4 of 7.
   - 6.2 With no question in the team, what the step opens (design silent: lane to confirm; the wizard names "your team's most recent question").
7. Teo goes on to step 5, the side trip to connect his own Claude account, and skips it.
   - 7.1 The guide is at step 5 of 7 and offers the side trip "Connect your Claude account" as optional (J04).
   - 7.2 Skipping it returns him to the welcome at step 5; nothing is connected; `connect` is not changed.
8. Teo goes on to step 6, the side trip to tell the team his own ties, and skips it.
   - 8.1 The guide is at step 6 of 7 and offers the side trip "Your ties" as optional (J05).
   - 8.2 Skipping it returns him to the welcome at step 6; `ties` stays in S2 (none yet).
9. Teo goes on to step 7, "Take a first step".
   - 9.1 The guide is at step 7 of 7, back on `home`.
10. As his first step, Teo opens Add (rail), types the notice's address on "From an address" (S1), and captures it (A2).
    - 10.1 `capture` shows S1 with C5's address field.
    - 10.2 After A2, S5: "Captured: {title}. It waits in Held captures …".
11. Teo finishes the welcome from the guide.
    - 11.1 The guide closes; the welcome is no longer running.

## End state

Checked after a reload.

1. Rosa's `members` shows "Active members: 3 · Administrators: 1", with `teo-n` (cover "Teo, from flat 9"), a member who may contribute, no expertise.
2. Teo's `home` shows S4 with no guide open (design silent: lane to confirm Home's state once his capture waits; C3 "Needs you" may list it to vouch).
3. Teo's `held` ("Mine") lists the captured notice; opened (A4), its `document` shows S2, held until he vouches, only he seeing the copy.
4. Teo's `connect` and `ties` are as before he joined: nothing connected, no tie.
5. Teo's `recovery` reads 10 of 10 unused; the walking session holds his codes.
6. Opening the invitation link again shows `join` S5.

## Ways it can turn aside

1. Step 4, the handle taken: C4 `handle.taken` with a suggestion (S2); or with capitals or spaces, `handle.characters` (S3); he types another; resume at step 4.
2. Step 4, passwords differ or are short: V4 or V5, nothing sent; resume at step 4.
3. Step 4, many handles checked quickly: V7; he waits the minutes it names; resume at step 4.
4. The link used again, expired or withdrawn: `join` S5, heading "This link no longer works", no form; the journey cannot resume from it, and Rosa makes a new invitation (step 1).
5. Step 2, Teo already a member: C7 with A4 leads to `front`.
6. Step 7, Teo chooses to connect instead: J04, an AI journey, recorded not walked; the welcome resumes at step 5 when he stops.
7. Step 10, the address not fetchable or refused: `capture` V2 or V3 beside the address, nothing saved; he may record what he saw instead (the tab "What I saw or heard"); resume at step 11.
8. The assistant unreachable: nothing changes; skipping the connection is a real choice and the welcome does not mention it again.

## Where the product's walker differs

The walker (`walkWelcome`) types the handle and password together and joins without a separate check, and moves through steps 4 to 7 with the guide's next control, stopping each offered side trip; it takes no first step at step 7 before finishing.

## Changes

- 22 Nov 2026: written.
