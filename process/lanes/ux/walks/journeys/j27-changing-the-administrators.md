Length: N lines. Last section: "Changes".

# J27: Changing the administrators

Journey page `j27-changing-the-administrators` (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

Status: walkable · Screens used: `members`, `security`, `home`, `queue`, `settings` · Follows: J28, J03, J30 (walk J30 first: this journey gives Teo, for a time, everything an administrator may do) · Followed by: none

## Goal

"We want a second and a third administrator, so the team does not hang on one person, and we want to be able to remove one, with every administrator seeing the reason."

## Who

1. Rosa (`rosa-l`), the founder and only administrator at the start, signed in.
2. Mai (`mai-k`), a member at the start, signed in; she becomes the second administrator.
3. Teo (`teo-r`), a member who may not start projects, as J03 leaves him, signed in; he is made the third administrator, then removed.

## Before it starts

1. J28 has been walked on this copy: Rosa is the only administrator; Mai is a member.
2. J03 has been walked on this copy, making Teo (`teo-r`) a member who is not an administrator. (The product's own walker joins its newcomer as `teo-r`.)
3. J30 has been walked, or is walked later on another copy.
4. `members`, as Rosa, reads "Administrators: 1" in C1.

## Test data

| Item | Value |
|---|---|
| Rosa's reason for removing Teo | "Teo asked to hand the administrator's work back; he stays a member." |
| Passwords | Rosa's and Mai's, as J28 leaves them; ARCH holds them, never printed |

## Steps

1. Mai opens `security` by its address `/app/security`.
   - 1.1 `security` shows S3: the heading and the one sentence naming the administrators, `rosa-l` only.
   - 1.2 No period fields, no counts and no act are drawn.
2. Rosa opens `members` from `settings` ("Members").
   - 2.1 `members` shows S1: C1 "Active members: … · Administrators: 1"; C2 with Rosa first, "Role" naming her an administrator.
   - 2.2 C4 shows `.recovery.one` and the link "Add a second administrator".
   - 2.3 C11 shows "With 1 administrator, no administrator can be removed by vote." and its two sentences; its fold's table marks the row for 1 administrator "(now)".
3. Rosa opens Mai's row panel (A16, `/app/members/mai-k`), ticks the capability to look after the team's Civicsmith under "What mai-k may do", and presses A6 "Change what a member may do".
   - 3.1 The confirmation "Propose mai-k as an administrator?" opens with `.cap.administer.confirm`, and the choices "Propose mai-k as an administrator" and "Go back".
   - 3.2 Observation, not a flaw: earlier walks found the code's confirmation saying it "makes" the member an administrator where the act only proposes (research 02, section 6, DS1). The walk records which wording it saw.
4. Rosa chooses "Propose mai-k as an administrator".
   - 4.1 The dialog "Enter your password again" opens, its focus in "Your password" (page "Every screen", section 4: changing administrators always asks).
5. Rosa types her password and presses "Go on".
   - 5.1 Mai's row shows her as an administrator in "Role", and "May do" reads "all of it, as every administrator may".
   - 5.2 C1 reads "Administrators: 2"; C4 shows `.recovery.many`.
   - 5.3 (design silent: whether the second administrator needs an endorsement when the only administrator proposes her; `members` A1 asks one only "beyond the second administrator"; lane to confirm)
6. Mai reloads `security`.
   - 6.1 `security` shows S2 or S1, as the period gives: C1 `.sub`, C2 "From", "To" with A1, C3's mark and its line, C7. Not S3.
7. Rosa opens Teo's row panel (`/app/members/teo-r`), ticks the capability to look after the team's Civicsmith, presses A6, chooses "Propose teo-r as an administrator", and gives her password again.
   - 7.1 Teo's row shows `.endorse.what`: a proposed administrator, awaiting endorsement; his "Role" is not yet administrator.
   - 7.2 C1 still reads "Administrators: 2".
8. Mai opens `home`.
   - 8.1 C3 "Needs you" holds a row for endorsing `teo-r` as an administrator, with "Endorse an administrator" (A16). (The same item is in `queue`, A14.)
9. Mai presses "Endorse an administrator" on that row.
   - 9.1 The dialog "Enter your password again" opens; Mai types her password and presses "Go on".
   - 9.2 The row leaves C3.
   - 9.3 On `members`, Teo's row shows him an administrator; C1 reads "Administrators: 3"; C11's table marks the row for 3 administrators "(now)".
10. Rosa opens Teo's row panel, presses A9 "Remove an administrator", and writes her reason from Test data in "Why remove their administrator's powers? (every administrator will see this)".
    - 10.1 A9 carries the weight "Asks for a reason"; nothing is sent until the reason is given.
    - 10.2 After sending (and the password asked again, as at step 4), `members` shows S3: "Removing teo-r as an administrator", "3 administrators: …", the section "What it takes", a row per administrator, and "{n} of {total} have agreed so far."
    - 10.3 Rosa's row reads agreed; Mai's reads not yet; Teo's row says he is counted and does not vote on his own removal.
11. Mai opens `members` (or her `home` row for it) and presses "Agree: remove teo-r as an administrator" (A9 in S3), with her own reason, and gives her password.
    - 11.1 The count reaches what "What it takes" names: S3 ends; Teo's row no longer shows him an administrator.
    - 11.2 C1 reads "Administrators: 2".
    - 11.3 (design silent: what Teo "May do" reads after his administrator's powers are removed; lane to confirm)
12. Teo reloads `security`.
    - 12.1 `security` shows S3, naming `rosa-l` and `mai-k` as the administrators.

## End state

Checked after a reload.

1. `members`, as Rosa, reads "Administrators: 2"; C2 shows Rosa and Mai as administrators and Teo as a member.
2. `members`, as Teo, shows S2: the roster, "May do" and "Expertise"; no act.
3. `security` as Mai shows S1 or S2; as Teo, S3 naming Rosa and Mai.
4. The reason Rosa gave at step 10 is kept with the removal, under her name (design: `shell.reason.help`); where `members` shows it is (design silent: lane to confirm).
5. No item about Teo's endorsement or removal is left in Rosa's or Mai's `queue`.

## Ways it can turn aside

1. **The last administrator steps down.** Before step 3, if Rosa presses A9 on her own row with a reason, beside A9: `refusal.LAST_ADMIN`, "…Nothing was changed. Add another administrator first, then resign." C1 still reads "Administrators: 1". Resume at step 3.
2. **"Go back"** (step 4). The confirmation closes; nothing is proposed; Mai's row is unchanged. Resume at step 3.
3. **Wrong password** (step 5, 9, 10 or 11). The dialog stays with `session.reauth.wrong`; nothing was sent. "Cancel" sends nothing and keeps what was written. Resume at the same step.
4. **No reason** (step 10). Beside A9: V3 "Say why, in your own words, in at most 2,000 characters. Nothing was sent." Resume at step 10.
5. **Mai does not agree** (step 11). S3 stays, "1 of … have agreed so far."; Teo stays an administrator. The journey ends with three administrators.
6. **Endorsement not given** (step 9). Teo stays proposed (`.endorse.what`); C1 reads "Administrators: 2"; steps 10 to 12 are not walked.
7. **A member opens an administrator's page.** Before step 5, Mai's `settings` is S2, with no section "The team's"; `/app/members` shows her S2, with no act (page "Every screen", section 1, rule 8: absent, not greyed).
8. **Phone width.** None of these acts is signed or irreversible, so each is a button at 390 px wide too.

## Changes

- 22 Nov 2026: written.
