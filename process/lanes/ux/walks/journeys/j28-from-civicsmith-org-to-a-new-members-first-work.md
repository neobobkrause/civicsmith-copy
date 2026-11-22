Length: 171 lines. Last section: "Changes".

# J28: From civicsmith.org to a new member's first work

Journey page `j28-from-civicsmith-org-to-a-new-members-first-work` (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

Status: partly not built (the account check on `install`) · Screens used: `site`, `install`, `setup`, `home`, `members`, `join`, `account`, `capture`, `held`, `open-file`, `front`, `published` (another team's), the shell menu (every-screen) · Follows: none: a fresh copy · Followed by: J02, J03, J33, J35, and every journey that starts from the founding copy.

## Goal

"We go from hearing about Civicsmith to our own team's Civicsmith running, and our first new member has done her first piece of work, with no break between."

## Who

1. Rosa, the founder: not signed in anywhere at the start; holds the development Cloudflare account's sign-in (the walk's stand-in for the team's account, with Rosa added to it). After step 12 she is the team's first administrator.
2. Mai, a new member: no account until step 20; then a member who may contribute and start projects.
3. A visitor's view (no account) on `site`, `install` and `join`.

## Before it starts

1. The development Cloudflare account named for the walk holds no Civicsmith (a fresh copy). If it holds one, `install` shows S16 at step 9 and the walk stops there (see "Ways it can turn aside", 3).
2. civicsmith.org (`site`) and the installer (`install`) are served at the addresses ARCH gives for the development copy.
3. Rosa uses a desktop browser (1280 px wide) with no Civicsmith session. Mai uses a second desktop browser with no session, and later a phone-width browser (390 px) with no session.
4. No AI account is connected anywhere: the walk has no assistant.

## Test data

| Item | Value |
|---|---|
| Short name | `lakeshore-tenants` |
| Team's name | "Lakeshore Tenants" |
| The team's place on `install` | the place the development installer offers for Lakeshore; where it offers none, its last choice, "None of these" (design silent: lane to confirm which ARCH serves) |
| Founder's handle | `rosa-l` |
| Founder's password | 12 characters or more, chosen by the walking session; kept for later journeys, never written into a report |
| Invitation for Mai | short id `mai`; cover "Mai, from flat 4"; she may also start projects |
| Mai's handle | `mai-k` |
| Mai's password | 12 characters or more, chosen by the walking session; kept like Rosa's |
| Mai's expertise | "Interpreting, Spanish and English" |
| Mai's testimony | words "Water has come through the ceiling of flat 4 since Monday; reported twice."; where "Flat 4, 14 Lakeshore Row"; when: yesterday; a photo she made (any small JPEG the walk makes) |
| Recovery codes | Rosa's ten and Mai's ten, saved by the walking session as each is shown, for J35 and later journeys |

## Steps

1. Rosa opens civicsmith.org at `/` (`site`).
   - 1.1 `site` shows S1: its heading, A1, A2, and the sections S1 lists.
   - 1.2 The section "One team's work" names one case with its link (A3).
   - 1.3 No page asks for an account or a sign-in.
2. Rosa opens that case (A3), reads it, and goes back to `site` S1.
   - 2.1 The case opens as `published` at its own team's address, in the published frame, with no session (design silent: lane to confirm which case a development site names).
   - 2.2 Going back shows `site` S1 again.
3. Rosa follows A1 to Start a team.
   - 3.1 `site` shows S2 at `/start`, with its sections in S2's order.
   - 3.2 "What you need" names the Cloudflare account and the time, and says what is not needed.
   - 3.3 A4 and A5 are offered.
4. Rosa chooses "Create your team" (A4).
   - 4.1 `install` opens at the installer's address in S1, with A1 and A2 (design silent: lane to confirm; `site` A4 names `install` S3, while `install`'s states and the design journey open on S1).
   - 4.2 C2's six questions are offered closed.
5. Rosa answers that she has a Cloudflare account (A1).
   - 5.1 `install` shows S2: the short name field, the places choice, A3 and A4.
6. `not built` Rosa checks her account (A12).
   - 6.1 `install` shows S5 or S6: one row per line, each "Ready" or "Not ready yet" with its fix.
   - 6.2 A14 is offered only when every line is ready (S6).
   - 6.3 The page says checking created nothing in the account.
   - Until built, the walk records this step not walked and goes on at step 7.
7. Rosa types the short name, chooses the place (Test data), and presses Continue (A4).
   - 7.1 S4's dialog names `lakeshore-tenants` as permanent, with A5 and A6.
   - 7.2 A4 carries the Irreversible weight mark.
8. Rosa continues with this short name (A5).
   - 8.1 `install` shows S11, naming `lakeshore-tenants`.
   - 8.2 S11's two sections are shown: what Cloudflare will ask to allow, and that whoever can sign in to the account controls the team's Civicsmith.
   - 8.3 A9 and A10 are offered.
9. Rosa continues to Cloudflare (A9), signs in there with the development account, and allows.
   - 9.1 Cloudflare's own permission page opens, outside Civicsmith.
   - 9.2 After she allows, `install` shows S14 (or first S12 or S13, where she chooses the development account or presses A15, and then S14).
   - 9.3 S14 names the Cloudflare account, and each step row moves from "Now" to "Done".
10. Rosa waits until every step is done.
    - 10.1 `install` shows S18, with the one-time password field and A20, the address field, the closed probe-key disclosure, and A21.
    - 10.2 No row reads "Not done"; S15 was not shown.
11. Rosa copies the one-time password (A20), keeps it, and follows A21.
    - 11.1 `setup` opens at the new address in S1, with the one-time password field already filled.
    - 11.2 Parts 2 to 8 are shown closed and cannot be opened.
12. Rosa types handle `rosa-l` and her password twice, and claims (A1).
    - 12.1 `setup` shows S2: part 1 reads "Done", with the claimed line naming `rosa-l`.
    - 12.2 The ten recovery codes are shown, "Shown once", with the buttons to copy them and save them as a file.
    - 12.3 Parts 2 to 8 can now be opened.
13. Rosa saves her ten codes as a file.
    - 13.1 A file holding the ten codes is saved on her device.
    - 13.2 After a reload, `setup` S2 no longer shows the codes (design silent: lane to confirm; S2 says "Shown once").
14. Rosa opens part 2, "Your team", types the team's name and presses A4.
    - 14.1 Part 2 shows "Saved. Your team is now called Lakeshore Tenants."
    - 14.2 C1 shows the team's name in place of the short name.
    - 14.3 Parts 3 to 8 keep their safe choices; none is marked "Done".
15. Rosa follows A19, "Open your team's Civicsmith".
    - 15.1 `home` shows S5: heading "Lakeshore Tenants"; the ready section with A18, A19, A20; C8's doors; C9.
    - 15.2 The masthead shows the team's name and "You: rosa-l", and no "Assistant" button.
16. Rosa follows A19, "Invite your first members", and makes Mai's invitation (C6): the short id, the cover, and the choice to let her start projects; then A1.
    - 16.1 `members` shows S1, with C4's one-administrator note.
    - 16.2 C7 shows the invitation link once, with `.invite.noemail`.
    - 16.3 The roster lists the invitation as "Not joined yet".
17. Rosa sends Mai the link herself, outside Civicsmith; Mai opens it in her own browser.
    - 17.1 `join` shows S1: C1 names Lakeshore Tenants, who invited her, and "You were invited as Mai, from flat 4".
    - 17.2 C2 offers her language, starting from the device's setting.
    - 17.3 The address no longer holds the invitation.
18. Mai types `mai-k` and asks whether it is free (A1).
    - 18.1 C4 says `mai-k` is free in Lakeshore Tenants (S1).
19. Mai types her password twice and joins (A2).
    - 19.1 `join` shows S6: joined, signed in as `mai-k` on this device.
    - 19.2 Her ten recovery codes are shown, with the buttons to save and copy them, and A6.
20. Mai saves her ten codes as a file and follows A6.
    - 20.1 `home` shows S2 for her: the welcome with A15, C8's doors, C9.
    - 20.2 The masthead shows "You: mai-k".
21. Mai continues the guided welcome (A15).
    - 21.1 The guide of the wizard "Welcome a new member" opens beside Home (every-screen, section 5). Its steps are J03's; she leaves it here (design silent: lane to confirm how the guide is left).
22. Mai opens "Your account" from the shell menu (every-screen 3.4).
    - 22.1 `account` shows S1: C2 shows `mai-k` and that a handle can't be changed.
    - 22.2 C3 shows the language she chose at step 17.
23. Mai declares her expertise (C5, A4).
    - 23.1 C5 shows "Declared: Interpreting, Spanish and English".
24. Mai goes to Home and chooses the door "A problem I live with" (A12).
    - 24.1 `home` shows the heading "What happened?" above the doors (C8).
    - 24.2 The door's offer opens in place: its suggested wizards, `door.front.matching` and `door.front.blank`.
25. Mai opens Add, chooses the tab "What I saw or heard" (A1), fills in her testimony with its photo, and records it (A16).
    - 25.1 `capture` shows S3: C19 and C20.
    - 25.2 After A16, S10 says it is recorded as her testimony, with its id.
    - 25.3 No "Help me write this" is drawn (S11).
26. `waiting A4` Mai opens the photo she added, from `held` (its thumbnail, A2), and shows its safe view (A2 on `open-file`).
    - 26.1 `open-file` shows S4: "High risk" with `.high.yours`, and "What to do next".
    - 26.2 After A2, the safe view (C3) opens on the page, marked derived.
    - (design silent: lane to confirm that a testimony's photo is listed in `held`.)
27. Mai signs out from the shell menu ("Sign out").
    - 27.1 `front` shows S4: the panel opens with `session.signedout`.
    - 27.2 Opening `/app` in that browser shows `front`, not `home`.
28. Next morning, on her phone (390 px), Mai opens the team's address, signs in with her handle and password, keeping "My own" (C6), and presses A1.
    - 28.1 Before signing in, `front` shows S1 at phone width, the sign-in panel below C3 to C5, "My own" already chosen.
    - 28.2 After A1, `home` opens, with the phone's tabs in place of the rail.

## End state

Checked after a reload, each in the browser named.

1. Signed out, the team's address `/` shows `front` headed "Lakeshore Tenants".
2. Rosa's `members` shows "Active members: 2 · Administrators: 1": `rosa-l` first, founder and administrator; `mai-k`, a member who may contribute and start projects, expertise "Interpreting, Spanish and English".
3. Rosa's and Mai's `recovery` each read 10 of 10 unused; the walking session holds both sets of codes.
4. Rosa's `setup` shows parts 1 and 2 "Done" and the team's name; parts 3 to 8 are not done.
5. Mai's testimony is held in the record as hers.
6. Mai is signed in on her phone and signed out in her first browser; Rosa is signed in in hers.
7. The team has no project, no question and no vouched document; `group-identity` is in S3 (nothing said yet).
8. The one-time password is spent: opening `setup` with it again shows S4.

## Ways it can turn aside

1. Step 7, the short name is already taken in the account: `install` V1 names it and offers a free one; resume at step 7 with the name of Test data only on a fresh account.
2. Step 9 or 10, a step stops: `install` S15 names it and says what to do, and that nothing was created; A11 returns to S2; resume at step 7.
3. Step 9, the account already holds a Civicsmith: `install` S16, saying nothing was created; the copy is not fresh, and the walk stops and reports it.
4. Step 12, the passwords differ or are short: `setup` V3 or V4 beside A1, nothing sent; resume at step 12. The one-time password emptied: V1.
5. Step 11, the one-time password already used: `setup` S4 with A23; the walk stops and reports it.
6. Step 14, the name left empty: V5; resume at step 14.
7. Step 16, the short id or cover left empty: `members` V1, nothing sent; resume at step 16.
8. Step 18, the handle taken or with characters it can't have: `join` S2 or S3; she types another; resume at step 18.
9. The invitation opened a second time: `join` S5, with no form.
10. Step 25, a field missing or "When" after now: `capture` V9; resume at step 25.
11. Step 28, a wrong password: `front` S2, handle kept, password cleared; resume at step 28.
12. The assistant unreachable: nothing changes; no step here needs it.

## Where the product's walker differs

The walker (`bio-plane/src/journey-check/journeys.mjs`) does not open the published case (step 2) or the account check (step 6); goes to `capture`'s "What I saw" tab by its address after the door, and records the testimony without a photo, so it walks no step 26; adds a first look at `security` (J29's step) and the idle lock and unlock on the phone (J33's).

## Changes

- 22 Nov 2026: written.
