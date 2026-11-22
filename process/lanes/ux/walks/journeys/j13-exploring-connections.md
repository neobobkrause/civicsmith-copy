Length: 94 lines. Last section: "Changes".

# J13: Exploring connections

Journey page `j13-exploring-connections` (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

Status: walkable · Screens used: `people`, `person`, `explore`, `question` · Follows: J28, J31, J06, J10 · Followed by: none

## Goal

"I want to see what links the official who issued the housing notice to the landlord of 14 Lakeshore Row, each step cited and graded, and open a question from it."

## Who

1. Mai (`mai-k`), a member of the project "Roof repairs" (J06), signed in on her own device.
2. No AI account. `explore` then shows C8's "Ask the assistant to research this" as a line marked "Comes in the first beta", never as a control (the-record, "The assistant on these screens").

## Before it starts

1. J31 has been walked: the record follows "The landlord of 14 Lakeshore Row", an organization.
2. J06 has been walked: the project "Roof repairs" holds the question "Has the landlord been ordered to repair the roof of 14 Lakeshore Row?", Mai is a member, and Housing notice 2026-118 is among its documents, vouched for.
3. J10 has been walked: the record follows the official who issued the notice, and the notice is connected to them (their `person` C2).
4. The notice names the landlord (as the owner it orders to repair the roof), under the name the notice prints.

## Test data

| Item | Value |
|---|---|
| Start | The official (J10) |
| Other end | "The landlord of 14 Lakeshore Row" (J31) |
| Another name for the landlord | The landlord's name exactly as Housing notice 2026-118 prints it |
| Kinds to follow | "Mentioned together", "Took part" |
| Declared tie | On the official's `person` page: a tie with the landlord, of whichever kind the select "Their tie" offers that fits "issued a notice to" (design silent: lane to confirm the kinds); why: "The official issued Housing notice 2026-118 to the landlord."; where it is said: Housing notice 2026-118 |
| Source attached to the declared step | Housing notice 2026-118, the passage ordering the landlord to repair |
| The new question | "What links the official who issued Housing notice 2026-118 to the landlord of 14 Lakeshore Row?" |
| Reasons (acts that ask for one) | "As Housing notice 2026-118 states." |

## Steps

1. Mai opens `people` from the rail.
   - 1.1 `people` shows S1: the official's row under "In your projects", with A3; the landlord's row with `.counts.none` and, since no document names it yet, no A3 (`people` Actions, A3).
2. Mai opens the landlord's row (A2).
   - 2.1 `person` shows state S2 (an organization), headed "The landlord of 14 Lakeshore Row".
3. Mai types the other name from Test data in "Another name they go by" (C5), presses "Add the name" and sends the reason.
   - 3.1 C5's "Other names" lists the name with its origin.
4. Mai presses "Connect the documents that name them" (A5; on an organization, `entity.connect.org`).
   - 4.1 C2 gains a link to Housing notice 2026-118.
   - 4.2 C1's count of documents naming it is now at least one.
5. Mai goes back to `people` by the path and presses "Explore connections" (A3) on the official's row.
   - 5.1 `explore` shows state S1: C1 names the official as the start and says as of when.
   - 5.2 The C2 group "Follow" is offered, with no box ticked (every-screen section 1, rule 1) (design silent: lane to confirm none is ticked by default).
   - 5.3 C8's two lines are marked "Comes in the first beta" and are not controls.
6. Mai ticks the kinds from Test data and presses "Explore" (A1).
   - 6.1 C3's graph from the official shows the landlord, joined through Housing notice 2026-118.
   - 6.2 C5 lists a chain from the official to the landlord: each step a link (`person`, `document`), with the chain's grade, its number of steps and its weakest step.
   - 6.3 How the other end is chosen is not drawn on the screen page: the walk records whether the chain is listed without an end being named (design silent: lane to confirm).
7. Mai presses "Check a chain" (A3) on that chain.
   - 7.1 The chain's steps are checked against their sources on the same screen; each step shows its result (design silent: lane to confirm the words).
8. Mai follows the official's step link to `person` and, in C5 "Ties a member declared", declares the tie from Test data with "Declare the tie" and its reason.
   - 8.1 The tie is listed, marked "declared, not evidenced".
9. Mai goes back to `explore` by the path, ticks the same kinds and presses "Explore" again.
   - 9.1 C5 also lists a chain through the declared tie, marked "a lead, not a finding", with A4 ("Attach a source to a declared step").
   - 9.2 The chain of step 6 is still listed as before.
10. Mai presses A4 on that chain, attaches the source from Test data and sends the reason.
    - 10.1 The step is graded from its source, and the chain no longer reads "a lead, not a finding" (design silent: lane to confirm it is redrawn at once).
11. Mai chooses the chain of step 6, presses "Open a question from this chain" (A5) and sends the question from Test data with the reason.
    - 11.1 A new `question` opens: C1 heading the question's words, and "Opened by" Mai with the date and its project.
    - 11.2 Which project holds it, and whether the chain's steps arrive as cited passages (S1) or the question opens empty (S3), is not said (design silent: lane to confirm).
    - 11.3 No finding rests on a declared or hunch step: no citation in C4 or C6 comes from the declared tie of step 8.

## End state

Checked after a reload, signed in as Mai.

1. The landlord's `person` page lists the other name and links to Housing notice 2026-118 in C2.
2. The official's `person` page lists the declared tie, with the source attached in step 10.
3. `explore` from the official, with the same kinds, lists the chains of steps 6 and 9, each step cited and graded.
4. The question of step 11 exists, opened by Mai; it is listed in its project's C7.
5. Nothing on these screens carries the machine-work label.

## Ways it can turn aside

1. **Nothing named.** At step 4, the notice does not carry the landlord's name as given: C2 gains no link. Check the name against the notice's words; resume at step 3.
2. **No chain.** At step 6, C5 lists no chain between them: the walk records what C3 to C6 show (a plain "no connection" result is what the walk plan expects: build/plan/lane-journeys/PLAN.md section 3, row 13) and resumes at step 4.
3. **Cut short.** At step 6, the explorer stops early: `.all.cut` shows; "Keep looking" is `not built`. The journey goes on with what is listed.
4. **A hub.** A chain passes through a very common point: it is marked "a hub: shown, not walked through", and is not followed further.
5. **Empty tie form.** At step 8, a field left empty: the act's refusal beside "Declare the tie" (every-screen section 7); nothing is declared. Resume at step 8.
6. **Empty reason.** Any act that asks for a reason, sent empty: `shell.reason.needed`; nothing is sent. Resume at the same step.
7. **Explore with no start.** Opened at `/app/explore` with no start: S2, with `.nocentre`, the field "From" and C2; no chains. Mai names the official in "From"; resume at step 6.
8. **Team out of reach.** `unavailable` S3; resume at the same step.

## Changes

- 22 Nov 2026: written.
