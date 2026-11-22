Length: 95 lines. Last section: "Changes".

# J33: Arriving, signing in and signing out

Journey page `j33-arriving-signing-in-and-signing-out` (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

Status: walkable · Screens used: `front`, `tour`, `home`, `projects`, the shell menu and the idle lock (every-screen, sections 3.4 and 4) · Follows: J28 · Followed by: none named yet (J35 may follow; it needs nothing this journey makes).

From the earlier walk plan's row "Arrive, sign in, sign out" (`build/plan/lane-journeys/PLAN.md`, section 3): the team's page tells a stranger what this is; a wrong password gets a kind message; an address opened signed out asks for sign-in and returns to it after; reloads and many page loads stay signed in; signing out ends the session.

## Goal

"I can tell from the team's page what it is, sign in on my own device, stay signed in while I work, and sign out when I am done."

## Who

1. A visitor with no session (the same browser before Mai signs in).
2. Mai (`mai-k`), a member (from J28), signed out at the start, on a desktop browser she calls her own.

## Before it starts

1. J28 has been walked on this copy: team "Lakeshore Tenants", Rosa (`rosa-l`) administrator, Mai (`mai-k`) a member with a password the walking session holds.
2. The browser used has no session for the team; no AI account is connected.
3. The walk can let 30 minutes pass without input in that browser (a real wait, or the browser's clock moved on).

## Test data

| Item | Value |
|---|---|
| Mai's handle; password | `mai-k`; the password J28 set (kept by the walking session) |
| A wrong password | any 12 characters that are not hers |
| The address opened signed out | `/app/projects` |
| Page loads | 40, by the rail's places in turn |

## Steps

1. The visitor opens the team's address `/`.
   - 1.1 `front` shows S1: C1 the team's name as heading; C4, C5, C6 and C7; no C3 (nothing published).
   - 1.2 C6's choice "This device is" has "My own" chosen.
   - 1.3 The tab is titled with the team's page and the team's name (C8); no rail, masthead or path (public frame).
2. The visitor follows "See how it works, step by step" (A4), reads the six steps with "Next", and returns with "Back to our page" (A4 on `tour`).
   - 2.1 `tour` shows S1 to S6 in turn, each "Step {n} of 6 · how we work", and C4's line that nothing is recorded.
   - 2.2 The last step leads back to `front` S1.
3. Mai types her handle and the wrong password, and signs in (A1).
   - 3.1 `front` shows S2: `refusal.SIGN_IN_REFUSED` beside A1, as an alert with the refused mark.
   - 3.2 The handle is kept; the password field is empty.
4. Mai opens `/app/projects` directly, still signed out.
   - 4.1 `front` is shown, and the address bar still reads `/app/projects`.
5. Mai types her right password, keeps "My own", and signs in (A1).
   - 5.1 `projects` opens (the address kept), not `home`.
   - 5.2 The masthead shows "You: mai-k"; the rail marks "Projects" current; no "Assistant" button.
6. Mai reloads the page.
   - 6.1 `projects` shows again, signed in; `front` is not shown.
7. Mai opens the rail's places in turn, 40 page loads in all.
   - 7.1 Each load draws its screen in the working frame, signed in.
   - 7.2 No load shows `front`, a refusal for too many requests, or `unavailable`.
8. Mai leaves the browser without input for 30 minutes.
   - 8.1 The lock dialog shows over the screen: heading "Locked", `session.locked`, the password field holding the focus, "Unlock", and "Not mai-k? Sign in as someone else".
9. Mai types a wrong password and presses "Unlock".
   - 9.1 The dialog stays, with `refusal.SIGN_IN_REFUSED` beside the field.
10. Mai types her password and presses "Unlock".
    - 10.1 The dialog closes; the same screen shows as it was.
11. Mai opens a second tab of the team's address, then, in the first tab, opens the shell menu (her initial) and chooses "Sign out".
    - 11.1 The menu shows "Lakeshore Tenants · signed in as mai-k", "Your account", "Sign out" with its explanation that it goes to the team's page (`shell.menu.signout_does`), and "Appearance".
    - 11.2 `front` shows S4: the panel opens with `session.signedout`.
    - 11.3 The second tab also shows `front`, signed out.
12. Mai opens `/app` in that browser.
    - 12.1 `front` is shown, not `home`.

## End state

Checked after a reload.

1. The browser has no session: `/` and every `/app/…` address show `front` (S1).
2. Mai's account is unchanged: signing in again with her password opens `home`.
3. Nothing was recorded in the team by this journey.

## Ways it can turn aside

1. Step 3 or 5, the handle or password empty: V1, nothing sent; resume at that step.
2. Step 3, many wrong tries: S3, `refusal.SIGN_IN_PAUSED`, naming the limit; the walk waits as it says, then resumes at step 5.
3. Step 5, "Shared or public" chosen instead: after 15 minutes without input she is signed out and `front` shows S5 with `session.ended` and her handle filled in; signing in again opens the page she was on; resume at step 6.
4. Step 8, the browser closed and the page opened again while locked: `front` S6, "Welcome back, mai-k", with the password field and "Unlock"; with an empty password V2, a wrong one V3; the right one opens the page kept; resume at step 11.
5. Step 8 or 9, "Not mai-k? Sign in as someone else": signed out; `front` S1 (S4 from `front` S6's A6); resume at step 5.
6. Step 5, 12 hours after signing in on her own device: signed out; she signs in again on `front`.
7. The team's Civicsmith not answering at any step: `unavailable` S3 in place, retried every 30 seconds, what was typed kept.
8. The assistant unreachable: nothing changes; no step here needs it.

## Where the product's walker differs

The walker (`journeys.mjs`, journey 28) signs in on the phone, then walks the lock and unlock there; it does not walk the wrong password, the kept address, the 40 loads or the second tab.

## Changes

- 22 Nov 2026: written.
