Length: 124 lines. Last section: "Changes".

# J34: Settings and account

Journey page `j34-settings-and-account` (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

Status: walkable · Screens used: `more`, `settings`, `account`, `front`, `home`, `notes`, `recovery`, `group`, `translations`, `wizards` · Follows: J28 · Followed by: J35 (it uses the recovery codes and password this journey leaves)

From the walk plan's row "Settings and account" (`build/plan/lane-journeys/PLAN.md`, section 3): every setting saves and shows itself back in words; light, dark and follow-my-device show the one chosen; translations and wizards read for a founder, not a builder; the phone's More tab matches the design.

## Goal

"I want to set my own things, and as an administrator the team's, and see each one said back to me in words, still there when I come back."

## Who

1. Mai (`mai-k`), a member, signed in, for steps 1 to 14 and 22.
2. Rosa (`rosa-l`), the administrator, signed in, for steps 15 to 21.

## Before it starts

1. J28 has been walked on this copy: Rosa administers "Lakeshore Tenants", named at setup; Mai joined and saved her ten recovery codes; the team uses English only.
2. Mai's appearance is "Follow my device" and her explanations are as they start.

## Test data

| Item | Value |
|---|---|
| Mai's new password | A password of 12 or more characters ARCH holds, never printed; Mai's password from now on |
| Mai's note | "Ask the housing office whether Housing notice 2026-118 has an annex." |
| Mai's revised note | "Ask the housing office whether Housing notice 2026-118 has an annex, and its date." |
| The language Rosa adds | Spanish |
| Who holds the hosting account | "The association's treasurer" |

## Steps

1. At 390 px wide, Mai taps the tab "More".
   - 1.1 `more` shows C1 to C4: the path "More", heading "More", `screen.more.sub`, and three rows, Projects, People and Settings, each with its line.
   - 1.2 The tab "More" is current (C5); the tabs read Home, Queue, Add, Find, More (page "Every screen", section 3.2).
2. Mai taps "Settings" (A3).
   - 2.1 `settings` shows S2: C1, the section "Yours" (C2) with its five links, each with its screen's purpose, and C5; no sections C3 or C4.
   - 2.2 The tab "More" stays current.
3. At 1280 px wide, Mai opens "Your account" (A1).
   - 3.1 `account` shows S1, C1 to C10.
   - 3.2 C2 shows `mai-k` and `handle.fixed`; no control changes the handle.
4. Mai opens her menu ("You: mai-k") and chooses "Dark" under "Appearance".
   - 4.1 The screen turns dark at once; "Dark" is the one checked.
   - 4.2 After a reload, the screen is dark and "Dark" is checked; `account` C3's "Appearance" shows "Dark". (design silent: whether `account` C3 and the menu hold one setting; lane to confirm)
5. Mai chooses "Light", then "Follow my device".
   - 5.1 Each turns the screen at once; the one chosen is the one checked, after a reload too.
   - 5.2 With "Follow my device", the screen follows the device's own light or dark setting.
6. On `account`, Mai sets "Explanations" to open after a pause (A2, "Choose how much is explained").
   - 6.1 The masthead's button reads "Explanations: on a pause"; after a reload, still.
7. Mai sets "Sounds" to "On".
   - 7.1 "On" is chosen after a reload. (design silent: the act that saves "Sounds"; lane to confirm)
8. In "Your cover name" (C4), Mai chooses one of the two radios and presses A3 "Save my choice".
   - 8.1 After a reload, the radio she chose is chosen; `.pairing.change` and `.pairing.undone` are shown.
9. In "Your password" (C7), Mai types her current password and her new one twice, and presses A7 "Change your password".
   - 9.1 "Your password is changed. Every other session signed in as you has ended." shows beside A7.
   - 9.2 The three password fields are empty.
10. In "Signing out" (C6), Mai presses A5 "Sign out on this device", then signs in on `front` with her new password.
    - 10.1 `front` shows S4, the panel opening with `session.signedout`.
    - 10.2 Signing in with the new password opens `home`.
11. Mai opens `settings`, then "Your notes".
    - 11.1 `notes` shows C1 and C2, and C3 in S2 ("You have kept no notes yet.") or S1 with notes kept earlier.
12. Mai types her note from Test data in "New note" and presses A1 "Write a note".
    - 12.1 The note is first in C3, its "Kept" date today, with "only you".
    - 12.2 After a reload, it is there still.
13. Mai opens the note's row, changes it to the revised note, and presses A2 "Revise your note".
    - 13.1 The row shows the revised words and "revised {date}" with today's date.
14. Mai opens `settings`, then "Recovery codes", and presses A1 "Get new recovery codes".
    - 14.1 Before A1: `recovery` shows S1, C2 "You hold recovery codes: 10 of 10 unused, issued {date}." with the date she joined (or fewer, if earlier journeys used some), and C3 with `.spends`.
    - 14.2 After A1: S2, `.shown` and ten codes.
    - 14.3 After leaving and opening `recovery` again: C2 names today's date as the issue; the codes are not shown.
15. Rosa opens `settings`.
    - 15.1 `settings` shows S1: C1, C2, C3 "{used} of {limit} ({pct}%)" with `.storage.what`, C4 with its nine links each with its purpose, and C5.
16. Rosa opens "Your team" (`group`), types "Lakeshore Tenants" in "The team's name" and presses A1 "Save the name".
    - 16.1 Before A1, C2 reads "Your team is called Lakeshore Tenants."
    - 16.2 After A1: "That's already your team's name, so nothing changed."
17. In "Languages" (C4), Rosa ticks Spanish beside English and presses A4 "Save the languages".
    - 17.1 C4 shows `.languages.now` naming English and Spanish, after a reload too.
18. In "The hosting account" (C7), Rosa types the holder from Test data in "Who holds it" and presses A7 "Record who holds the hosting account".
    - 18.1 C7 shows `.hosting.now` and "The association's treasurer", after a reload too.
19. Rosa opens `settings`, then "Translations".
    - 19.1 `translations` shows S1: C2 lists Spanish as a link; C6 shows `.typed.note`; no C8 (no AI account).
    - 19.2 No word key (`screen.…`) and no code is drawn where a word should be.
20. Rosa opens Spanish (A1).
    - 20.1 `/app/translations/<tag>` shows C3 and C4: `.counts`, the table "English", "State", "Translation", protected words marked "protected".
21. Rosa opens `settings`, then "Wizards", and chooses "Drafts" in "Which wizards" (A2).
    - 21.1 Before the choice: S1, "Showing: Offered to members", C3 listing Civicsmith's wizards, each cell in words.
    - 21.2 After it: "Showing: Drafts", and the drafts' table or S3's sentence.
22. Mai opens `account` and chooses Spanish in "Your language" (A1), then English again.
    - 22.1 With Spanish, the screen's words are Spanish where translated and English where not; no word is blank (page "Every screen", section 8).
    - 22.2 With English again, the screen is in English, after a reload too.

## End state

Checked after a reload.

1. Mai, signed in with her new password: appearance "Follow my device", explanations "on a pause", sounds "On", her cover choice as saved, language English.
2. `notes`, as Mai, lists the revised note with "revised {date}"; no other member's `notes` shows it, Rosa's included.
3. `recovery`, as Mai, reads ten unused codes issued today.
4. `group`, as Rosa: "Your team is called Lakeshore Tenants.", English and Spanish, the treasurer as holder of the hosting account.
5. `group`, as Mai, shows `.admins` and the same values, with no field or act.
6. `translations`, as Mai, lists Spanish.

## Ways it can turn aside

1. **Passwords differ** (step 9). Beside A7: V1 "The two new passwords are not the same. Type them again. Nothing was sent." Resume at step 9.
2. **New password too short** (step 9). Beside A7: `refusal.PASSWORD_TOO_SHORT`. Resume at step 9.
3. **Current password wrong** (step 9). Beside A7, the refusal for it in words; nothing is changed. (design silent: no form message is named for this on `account`; lane to confirm) Resume at step 9.
4. **Empty note** (step 12 or 13). V1 "Write the note first. Nothing was sent." Resume at the same step.
5. **The court notice on.** If an administrator shows the court notice (`group` C6), the first note Mai keeps shows `.court` (`notes` C5).
6. **Empty team name** (step 16). V1 "Give the name first. Nothing was sent."
7. **No language, or more than 20** (step 17). V4 "Tick from 1 to 20 languages. Nothing was sent."
8. **Holder left empty** (step 18). V5 "Say who holds it first. Nothing was sent."
9. **A member opens the team's screens.** Mai opening `group`, `updates` or `security` sees their member's view (`group` `.admins`; `updates` S4; `security` S3), each naming the administrators, with no act.
10. **Sign out everywhere.** A6 instead of A5 at step 10: `front`, signed out, and every other session of Mai's ended.
11. **Recovery codes not saved** (step 14). Once Mai leaves S2, the codes are not shown again; she gets new ones (A1) and the earlier ones are spent (`.spends`).
12. **Storage above 70%** (step 15). C3 shows `.storage.warn70`; above 90%, the fold's `.storage.warn90`.

## Changes

- 22 Nov 2026: written.
