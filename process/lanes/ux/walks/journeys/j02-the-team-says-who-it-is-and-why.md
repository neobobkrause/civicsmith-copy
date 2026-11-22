Length: 85 lines. Last section: "Changes".

# J02: The team says who it is and why

Journey page `j02-the-team-says-who-it-is-and-why` (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

Status: walkable · Screens used: `settings`, `group-identity`, `front` · Follows: J28 · Followed by: J03.

The steps are those of the wizard "Say who your team is" (4 steps, all on `group-identity`), plus the save and what members and the public then see. The wizard is optional and never required; it is offered at the end of setup and from Home's "Say who your team is" (`home` A20) while the team is new, and runs at any time from the team's settings, which is the way in used here.

## Goal

"We say what kind of team we are, what we focus on and why we exist, and choose who sees it."

## Who

1. Rosa, signed in, the team's administrator (from J28).
2. Mai, signed in, a member (from J28), who reads what Rosa saved.
3. A visitor with no session, on `front`.

## Before it starts

1. J28 has been walked on this copy: the team "Lakeshore Tenants" exists, Rosa (`rosa-l`) is its only administrator, Mai (`mai-k`) a member.
2. Nothing has been said yet: `group-identity` is in S3.
3. Rosa is signed in in a desktop browser; Mai is signed in in another; a third browser has no session.

## Test data

| Item | Value |
|---|---|
| What kind of team | "an issue group" and "a community group" |
| What you focus on | "Housing repairs at 14 Lakeshore Row, and the city's housing notices that order them" |
| Why the team exists | "Tenants of 14 Lakeshore Row came together to get the repairs the city has ordered actually made." |
| Who sees all of this | "Members only" |

## Steps

1. Rosa opens Settings from the rail and follows "Who your team is" (`settings` C4).
   - 1.1 `settings` shows S1, with the section "The team's" and its link "Who your team is".
   - 1.2 `group-identity` opens: C1 and C2; no C3 (S3, nothing said yet); C4, the form "Change it", with A1.
   - 1.3 C1 reads `.seed.recorded` (S1): the short name was recorded at install.
   - 1.4 No C5 is drawn (S4, no assistant), and no greyed control stands in its place.
   - 1.5 Whether the wizard's guide opens beside the screen when it is reached from Settings (design silent: lane to confirm); the steps below are the same either way.
2. Rosa chooses what kind of team it is: the two kinds of Test data (wizard step 1).
   - 2.1 Both checkboxes are ticked; none was ticked before she chose (every-screen 1.1).
3. Rosa types what the team focuses on (wizard step 2).
   - 3.1 The field "What you focus on" holds her words.
4. Rosa types why the team exists, in her own words (wizard step 3).
   - 4.1 The field "Why the team exists, in your own words" holds her words.
5. Rosa chooses who sees it: "Members only" (wizard step 4).
   - 5.1 "Members only" is chosen.
6. Rosa saves (A1, "Save who your team is, and who sees it").
   - 6.1 C3 appears: "What kind of team:" with the two kinds; the focus; the reason; "Only members see this."
   - 6.2 A1 carries no weight mark (reversible).
   - 6.3 The form C4 still holds the saved values.
7. Mai opens `group-identity` by the team's name in the masthead (every-screen 3.3).
   - 7.1 She sees C1, C2 and C3 as Rosa saved them.
   - 7.2 She sees no section "Change it" and no A1.
8. In the browser with no session, the visitor opens the team's address `/`.
   - 8.1 `front` shows S1 with the team's name (C1), and no focus or purpose under it (C2 not drawn, since only members see it).

## End state

Checked after a reload.

1. Rosa's `group-identity` shows C3 with the two kinds, the focus, the reason and "Only members see this.", and the form C4 holding the same.
2. Mai's `group-identity` shows the same C3, with no form and no act.
3. Signed out, `front` shows no focus or purpose.
4. Nothing else changed: `members`, `setup` and `home` read as J28 left them.

## Ways it can turn aside

1. Step 6, no kind chosen and every field empty: V1 (`shell.field.needed`, naming "What you focus on"); nothing saved; resume at step 2.
2. Step 5, "Also our public page and the network directory" chosen instead: after A1, C3 reads "Members and the public see this.", and `front` C2 shows the focus and purpose; the walk then sets "Members only" again and resumes at step 6.
3. Step 2, "something else" ticked: the field "Describe your kind of team, in a few words" is filled; then as step 3.
4. Mai opens Settings: `settings` shows S2, without the section "The team's" (no link to change who the team is).
5. The assistant reachable instead (not this walk): C5 and A2 appear; a field it filled is labelled as the assistant's draft and nothing is saved until A1. Without it, the journey above is the whole path.

## Where the product's walker differs

The walker does not walk J02: it does not open `group-identity` except in its sweep of every screen.

## Changes

- 22 Nov 2026: written.
