Length: 98 lines. Last section: "Changes".

# J35: Recovering and signing in again

Journey page `j35-recovering-and-signing-in-again` (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

Status: walkable · Screens used: `front`, `forgot`, `home`, `recovery`, `members`, `reset` · Follows: J28 · Followed by: none named yet.

From the earlier walk plan's row "Recover and sign in again" (`build/plan/lane-journeys/PLAN.md`, section 3): a recovery code sets a new password; an administrator's reset link works once; a used code or link says so. Civicsmith sends no email: getting back in goes through the member's own codes or the team.

## Goal

"I forgot my password; I get back in with one of my recovery codes, or with a reset link from an administrator, and nothing of my work is lost."

## Who

1. Mai (`mai-k`), a member (from J28), signed out and without her password.
2. Rosa (`rosa-l`), the administrator, signed in, who makes a reset link in part two.

## Before it starts

1. J28 has been walked on this copy: Mai holds ten unused recovery codes (saved by the walking session at J28 step 20) and is signed in on her phone; Rosa is the administrator, signed in.
2. Mai uses a desktop browser with no session for the team. Her phone-width browser from J28 is still signed in.
3. No AI account is connected.

## Test data

| Item | Value |
|---|---|
| Mai's handle | `mai-k` |
| The code she uses | the first of her ten codes from J28 |
| A wrong code | any code not among her ten |
| Her new password (part one) | 12 characters or more, new, chosen by the walking session, never reported |
| Her new password (part two) | another, likewise |

## Steps

Part one: a recovery code.

1. Mai opens the team's address and follows "Forgot your password?" (`front` A2).
   - 1.1 `forgot` shows S1: C1 and its line that Civicsmith sends no email; C2 with the handle, code and two password fields and A1; C3; C4.
2. Mai types her handle, a wrong code and a new password twice, and presses A1.
   - 2.1 `forgot` shows S3: `refusal.RECOVERY_REFUSED` beside A1; the code field is empty; nothing was changed.
3. Mai types the first of her codes and the new password twice, and presses A1.
   - 3.1 `forgot` shows S2: `screen.forgot.done` with 9 codes left, and that every other sign-in of hers has ended; A2; C2 is not drawn.
4. Mai follows "Sign in" (A2) and signs in with her handle and the new password.
   - 4.1 `front` opens; after A1, `home` opens, signed in as `mai-k`.
   - 4.2 Her old password, tried in another browser, is refused (`front` S2).
5. On her phone, Mai opens any page of the team.
   - 5.1 `front` shows: her earlier sign-in there has ended.
6. Mai opens Settings › "Recovery codes".
   - 6.1 `recovery` shows S1; C2 reads "You hold recovery codes: 9 of 10 unused, issued {date}."
7. In a browser with no session, Mai opens `forgot` again and uses the same first code with another new password.
   - 7.1 `forgot` shows S3: `refusal.RECOVERY_REFUSED`; nothing was changed.

Part two: a reset link from an administrator.

8. Rosa opens `members`, opens Mai's row (A16), and makes a reset link for her (A2).
   - 8.1 The row's panel (C5) opens at `/app/members/mai-k`.
   - 8.2 C7 shows the reset link once, with `.reset.shown` and `.reset.noemail`.
9. Rosa passes the link to Mai outside Civicsmith; Mai opens it in a browser with no session.
   - 9.1 `reset` shows S1: "For mai-k · it works once, until {date}", the two password fields, A1, and `screen.reset.keeps`.
   - 9.2 The address no longer holds the link.
10. Mai types her second new password twice and sets it (A1).
    - 10.1 `reset` shows S2: "For mai-k" and `screen.reset.done`; A2.
11. Mai follows "Sign in" (A2) and signs in with the second new password.
    - 11.1 `home` opens, signed in as `mai-k`.
    - 11.2 The part-one browser where she was signed in now shows `front` on its next page.
12. Mai opens the same reset link again.
    - 12.1 `reset` shows S3: "This link no longer works", `screen.reset.dead.sub`, `screen.reset.dead.what`, A3; no field.

## End state

Checked after a reload.

1. Mai signs in with the part-two password only; the J28 password and the part-one password are refused (`front` S2).
2. Mai's `recovery` reads 9 of 10 unused; her codes still work after the reset (`screen.reset.keeps`).
3. Mai's work is unchanged: her testimony from J28 is held as hers; `account` shows `mai-k` and her declared expertise.
4. The walking session holds Mai's current password and her nine unused codes for later journeys.
5. Rosa's `members` lists `mai-k` as before, active.

## Ways it can turn aside

1. Step 2 or 3, the handle or code empty: V1; the passwords differ: V2; under 12 characters: V3; nothing sent; resume at that step.
2. Many tries: V4, `refusal.SIGN_IN_PAUSED`; the walk waits as it says.
3. Step 3, the last code spent (not this walk): S2 shows `screen.forgot.done.last`, saying to get ten new ones in Settings › Recovery codes.
4. Step 10, passwords differ or short: `reset` V1 or V2, nothing sent; resume at step 10.
5. Step 9, the link expired (seven days) or withdrawn: `reset` S3; Rosa makes a new one (step 8).
6. Step 8, Rosa is not an administrator: `members` S2, with no row panel or act.
7. The assistant unreachable: nothing changes; no step here needs it.

## Where the product's walker differs

The walker does not walk J35: in J28 it checks that ten codes are shown, but never uses one, and makes no reset link.

## Changes

- 22 Nov 2026: written.
