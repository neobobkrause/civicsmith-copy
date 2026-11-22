Length: 88 lines. Last section: "Changes".

# J05: Declaring your own ties

Journey page `j05-declaring-your-own-ties` (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

Status: walkable · Screens used: `settings`, `account`, `ties` · Follows: J28 · Followed by: J15 (the publication ceremony asks each publishing member to confirm they have no undeclared tie)

## Goal

"I want to tell the team about my own ties to people it may look into, so a case can disclose them honestly, and choose whether it names me."

## Who

1. Mai (`mai-k`), a member, signed in. Any member may declare ties; only she and the administrators see her list.
2. Rosa (`rosa-l`), the administrator, signed in, for step 8.
3. Teo (`teo-n`), a member, for step 9, where J03 has been walked.

## Before it starts

1. J28 has been walked on this copy: Mai is a member of "Lakeshore Tenants" and can sign in.
2. Mai has declared no tie: `ties`, as Mai, is in S2.

## Test data

| Item | Value |
|---|---|
| Tie 1: Kind | "Employer" |
| Tie 1: Who | The city's housing office in Lakeshore |
| Tie 1: The tie, in her words | "works part-time at the city's housing office" |
| Tie 1: How a case discloses it | "Without naming me" |
| Tie 2: Kind | "Relative" |
| Tie 2: Who | The landlord of 14 Lakeshore Row |
| Tie 2: The tie, in her words | "is a cousin of the landlord of 14 Lakeshore Row" |
| Tie 2: How a case discloses it | "Naming me by my handle" |

The ties are made up for the walk; the landlord and the housing office are those of the index's question and Housing notice 2026-118.

## Steps

1. Mai opens `settings` from the rail (on a phone, from `more`).
   - 1.1 `settings` shows S2: C1, the section "Yours" (C2) and the section "For every member" (C5); no section "The team's".
   - 1.2 C2 holds the link "Your ties" with the purpose of `ties` beneath it.
2. Mai opens the link "Your ties" (A1).
   - 2.1 `ties` shows S2: C1 `.sub`, the fold C2, C3 with its none line, and C4 "Add a tie".
   - 2.2 The fold C2 is open: "Why you are asked" with its four points and "Who sees it" with its lines.
   - 2.3 C4's choice "Kind" has its four kinds, none chosen; the disclosure radios have their two choices, none chosen (page "Every screen", section 1, rule 1).
   - 2.4 Each disclosure choice shows its sentence with Mai's handle `mai-k` and the tie filled in or as its placeholder words; no `{handle}` or `{tie}` is drawn unfilled.
3. In C4 Mai enters tie 1 from Test data, chooses "Without naming me" and presses A1 "Add a tie".
   - 3.1 A1 carries no weight mark: adding a tie can be undone.
   - 3.2 C3 lists one row: "Employer", the housing office, and in "A case would say" the sentence a case would show for a member not named, with her tie in it.
   - 3.3 `ties` is now in S1; C3's none line is gone.
   - 3.4 The fields of C4 are empty again. (design silent: whether C4's fields clear after A1; lane to confirm)
4. In C4 Mai enters tie 2 from Test data, chooses "Naming me by my handle" and presses A1.
   - 4.1 C3 lists two rows; the new row's "A case would say" shows the form for a tie that names her. (design silent: which of C3's two row forms, "a case would say: “{says}”" or "a case would name me", goes with which choice; lane to confirm)
5. Mai reloads `ties`.
   - 5.1 C3 lists both rows, as at step 4.
6. Mai presses A2 "Remove a tie" on tie 2's row.
   - 6.1 Tie 2's row goes; tie 1's row stays.
   - 6.2 After a reload, C3 lists tie 1 only.
7. Mai opens `account` and its link "Your ties" in C10 (A10).
   - 7.1 `ties` opens, in S1, listing tie 1: the second way in leads to the same list.
8. Rosa, an administrator, looks for Mai's ties. (design silent: the screen on which an administrator sees another member's ties; `ties` shows each member their own; lane to confirm)
   - 8.1 Rosa's own `ties` lists none of Mai's ties.
9. Teo (`teo-n`), a member who is not an administrator, opens `ties`. Walked only where J03 has made him a member on this copy.
   - 9.1 Teo's `ties` lists none of Mai's ties.

## End state

Checked after a reload.

1. `ties`, as Mai, is in S1 with one row: tie 1, "Employer", the city's housing office, disclosed without naming her.
2. Tie 2 is not listed.
3. No other member's `ties` lists Mai's tie.
4. Nothing on `home`, `members` or `front` shows Mai's tie (design: only she and the administrators see the list).

## Ways it can turn aside

1. **Who or the tie left empty** (step 3 or 4). Beside A1: V1 "Name who the tie is with and describe it."; nothing is added and C3 is unchanged. Resume at the same step with both filled in.
2. **No disclosure chosen** (step 3 or 4). Beside A1: the shell's refusal for an empty required choice (page "Every screen", section 7). (design silent: no form message is drawn for this on `ties`; lane to confirm) Resume at the same step.
3. **Kind "Other".** Mai may choose "Other" for a tie that is none of the three; the row's "Kind" reads "Other". The journey goes on as from step 3.
4. **The list cannot be read.** `ties` shows `state.failed` ("Could not read this, because {reason}") in C3, never the none line. Reload and resume at step 2.
5. **Mai skips.** Declaring ties is optional: Mai may leave `ties` at step 2 and nothing reminds her; the publication ceremony (J15) asks her then.
6. **Signed out.** `/app/ties` opened without a session shows `front`, and opens `ties` after sign-in (page "Every screen", section 2).

## Changes

- 22 Nov 2026: written.
