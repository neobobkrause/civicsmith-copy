Length: N lines. Last section: "Changes".

# J01: A team gets going

Journey page `j01-a-team-gets-going` (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

Status: partly not built (the account check on `install`) · Screens used: `install`, `setup`, `home`, `members` · Follows: none: a fresh copy of its own · Followed by: none (J02 can follow it on the same copy, but the journeys that need a team start from J28's copy).

The steps are those of the wizard "Set up and claim" (16 steps), walked on the screens; the installer and setup draw no wizard guide (their frame has no dock), so the walk follows the steps below, not a guide.

## Goal

"We install our team's own Civicsmith, claim it, say what it is and where it works, and make sure it never depends on one person."

## Who

1. Rosa, the founder: no Civicsmith session at the start; holds the sign-in of the development Cloudflare account. After step 8 she is the first administrator.
2. Dev, named only as the second administrator Rosa invites; he does not act in this journey.

## Before it starts

1. A fresh copy of its own: the development Cloudflare account holds no Civicsmith. J01 and J28 each install, so each needs the account empty when it begins; J01 is not walked on J28's copy, and its copy is not used by later journeys.
2. The installer is served at the address ARCH gives for the development copy.
3. Rosa uses a desktop browser (1280 px) with no Civicsmith session; no AI account is connected.

## Test data

| Item | Value |
|---|---|
| Short name | `lakeshore-tenants` |
| Team's name | "Lakeshore Tenants" |
| Website | none: "No, or not yet" |
| Place | the place the development installer offers for Lakeshore, or "None of these" (installer) and "Somewhere else" named "Lakeshore" (setup) where it offers none (design silent: lane to confirm which ARCH serves) |
| Languages | English |
| An office the team deals with | "The city's housing office"; what about: "Housing notices, such as notice 2026-118" |
| Court notice | "Yes, when they join, and the first time they save something not public" |
| Who holds the hosting account | "The association's treasurer, with Rosa added" |
| Second administrator | short id `dev`; who: "Dev, from flat 2" |
| Founder | handle `rosa-l`; a password of 12 characters or more chosen by the walking session, never reported |

## Steps

1. Rosa opens the installer and answers that she has a Cloudflare account (`install` A1).
   - 1.1 `install` first shows S1, then S2.
   - 1.2 S2 offers A3, the link to what a team needs on civicsmith.org; where the site is not online, S3 shows that list in its place, with its line that no Claude account is needed.
2. `not built` Rosa checks her account (A12).
   - 2.1 S5 or S6: each line "Ready" or "Not ready yet" with its fix; A14 only when all are ready; checking created nothing.
   - Until built, recorded not walked; the walk goes on at step 3.
3. Rosa types the short name, chooses the place, and continues (A4), then confirms it (A5).
   - 3.1 S4's dialog names `lakeshore-tenants` as permanent; A4 and A5 carry the Irreversible mark.
   - 3.2 After A5, S11 names the short name and what Cloudflare will ask to allow.
4. Rosa goes on to Cloudflare (A9), signs in there and allows; she allows the file scanner if Cloudflare asks.
   - 4.1 `install` shows S14 (after S12 or S13 where they apply), naming the account, each row moving from "Now" to "Done".
5. Rosa waits for the installer's own checks.
   - 5.1 `install` shows S18: the rows of what passed, including the file scanner's.
   - 5.2 No row reads "Not done".
6. Rosa saves the one-time password (A20) and continues (A21).
   - 6.1 `setup` S1 opens at the team's address with the one-time password filled in.
7. Rosa chooses handle `rosa-l` and her own password, and claims (A1).
   - 7.1 `setup` S2: part 1 "Done", the claimed line naming `rosa-l`; the ten recovery codes shown once.
   - 7.2 Parts 2 to 8 can be opened, each with A3 "Skip for now".
8. Rosa saves her ten codes as a file.
   - 8.1 A file holding the ten codes is saved on her device.
9. In part 2, Rosa types the team's name and presses A4.
   - 9.1 "Saved. Your team is now called Lakeshore Tenants."; C1 shows the name.
10. In part 2, Rosa answers that the team has no website of its own.
    - 10.1 "No, or not yet" is chosen; the address field and A5 are not shown.
11. In part 3, Rosa chooses the place and the languages and presses A6 (or, with no place listed, chooses "Somewhere else", names Lakeshore and presses A7).
    - 11.1 The places and languages are saved, or "The place you named: Lakeshore".
    - 11.2 The line "You chose {place} when you installed" names the place chosen at step 3 (design silent: lane to confirm for "None of these").
12. In part 4, Rosa checks the offices filled in and confirms them (A9); with no known place, she adds the city's housing office herself (A10).
    - 12.1 With a known place: the offices listed, each "held by …" and "From …'s roster", recorded after A9.
    - 12.2 With none: `.offices.none` or `.places.none`, then "Added: The city's housing office".
13. Rosa opens part 6, "Privacy and the law", and reads who will see facts about people.
    - 13.1 Part 6 shows `screen.setup.people.what` and the court explanation; neither choice is chosen.
14. Rosa opens part 5, "The AI assistant", reads it, chooses "Yes, members may use it" and "Each member, with their own Claude account".
    - 14.1 After "Yes", the choice "Who pays for it?" shows; with "Each member" chosen, no key field shows.
    - 14.2 Part 5's state afterwards (design silent: lane to confirm whether it reads "Done" with no act pressed).
15. **AI** Rosa holds the team's API key (A12) and switches it on (A13).
    - Must be present (every run): "The team's key is held and {state}."; the key never shown again on the page.
    - Must never be present: the key's characters after A12; any assistant control on another screen while the key is off.
    - **Without the assistant**: Rosa leaves "Each member, with their own Claude account" chosen and presses nothing; the journey goes on at step 16.
16. In part 6, Rosa chooses that members are told what a court can reach (A15).
    - 16.1 "Members are told when they join."
17. In part 8, Rosa records who holds the hosting account (A18).
    - 17.1 "Recorded: The association's treasurer, with Rosa added".
18. In part 8, Rosa invites a second administrator: short id and who he is, then A17.
    - 18.1 The invitation link is shown once, with `.admins.shown`.
    - 18.2 If the password is asked again (every-screen, section 4, changing administrators), she gives it and "Go on" sends it once.
19. Rosa skips part 7, "Security" (A3).
    - 19.1 Part 7 reads "Skipped"; nothing is sent.
20. Rosa reads "You're ready" (C4) and follows A19.
    - 20.1 `home` shows S5 for a new team, with A18, A19 and A20 ("Say who your team is", J02's way in).
21. Rosa opens `members` from Settings › "Members".
    - 21.1 The roster lists `rosa-l` first, founder and administrator, and the invitation for Dev as "Not joined yet".
    - 21.2 C4 still says the team depends on one administrator, since Dev has not joined.

## End state

Checked after a reload, signed in as Rosa.

1. `setup` shows parts 1, 2, 4, 6 and 8 "Done", part 7 "Skipped", and the team's name in C1; parts 3 and 5 as their saves leave them (design silent: lane to confirm whether part 3 also needs its time zone saved, and part 5 as step 14.2).
2. `group` (Settings › "Your team") shows "Your team is called Lakeshore Tenants.", no website, the languages, the court notice "tell", and the hosting account's holder.
3. `places` lists the place and the office(s) recorded at steps 11 and 12.
4. `members`: one active administrator, `rosa-l`; Dev's invitation unused.
5. `recovery`: 10 of 10 unused; the walking session holds the codes.
6. No member but Rosa, no project, nothing captured.

## Ways it can turn aside

1. Step 3, the short name taken: `install` V1, with a free one offered; nothing created; resume at step 3 on an empty account.
2. Step 4 or 5, a step stops: S15, saying what to do and that nothing was created; A11; resume at step 3.
3. Step 4, the account already holds a Civicsmith: S16; the copy is not fresh; the walk stops and reports it.
4. Step 7, passwords differ or are short: `setup` V3 or V4; resume at step 7.
5. Step 11, "Somewhere else" with no name: V7. Step 12, an office with no name: V8. Step 16, no choice: V12. Step 17 or 18, a field empty: V14. Each says nothing was sent; resume at that step.
6. Step 14, "No, keep our material away from AI" chosen instead: the reason field and A11 ("Asks for a reason") show and the rest of part 5 is hidden; with no reason, V9.
7. The assistant unreachable: only step 15 needs it; its path without the assistant is the one walked.

## Where the product's walker differs

The walker does not walk J01; it walks J28, which uses the same screens and leaves parts 3 to 8 at their safe choices.

## Changes

- 22 Nov 2026: written.
