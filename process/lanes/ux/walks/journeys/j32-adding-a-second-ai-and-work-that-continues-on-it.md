Length: 129 lines. Last section: "Changes".

# J32: Adding a second AI, and work that continues on it

Journey page `j32-adding-a-second-ai-and-work-that-continues-on-it` (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

Status: AI; not built (every screen it uses on the page `ai` is not built; the steps that send anything to a provider need two providers' accounts) · Screens used: `aiproviders`, `aiconnect`, `aimine`, `aimoments`, `assistant`, `question` · Follows: J28, J15 · Followed by: none

Until the owner connects two providers' accounts, every step marked **AI** is recorded not walked (index, section 1). Steps 17 and 18, the path without the assistant, are walked first.

## Goal

"As an administrator I want to add a second provider's account behind the first, tested and placed second; and as a member I want my work to go on when the first runs out, with the switch shown to me and mine to decline."

## Who

1. Rosa (`rosa-l`), the administrator, signed in: she connects and places the second account and sets the limits.
2. Mai (`mai-k`), a member, signed in, with no AI account of her own: the team's accounts serve her.

## Before it starts

1. J28 has been walked on this copy: Rosa administers "Lakeshore Tenants"; Mai is a member.
2. J15 has been walked on this copy: Mai is a member of a project holding the index's question, "Has the landlord been ordered to repair the roof of 14 Lakeshore Row?", resting on Housing notice 2026-118. This page calls it "the question".
3. Provider A's plan is connected as the team's account, on, and first in the order: Rosa has walked steps 2 to 8 below once for Provider A, choosing "First" at step 8.
4. Provider B's plan is not connected: `aiproviders` is in S4.
5. `aiproviders` part 2 (C9) is as it starts, all seven checks required (S5), and Provider B's plan passes them, so it is offered in C4.

## Test data

| Item | Value |
|---|---|
| Provider A's plan | A team API plan from a provider the catalogue lists; ARCH names it and holds its key, never printed |
| Provider B's plan | A pay-as-you-go API plan from a second provider the catalogue lists, not barred for teams; ARCH names it and holds its key, never printed |
| Provider A's monthly limit, step 9 | The least amount the limit field takes, so that one run reaches it; ARCH sets it |
| Rosa's reasons, steps 5, 6, 8, 9 and 16 | "A second AI behind the first, so work goes on." (16: "Raise the first account's limit for next month.") |
| Mai's reason, step 14 | "Go on with the answer on the second account." |

## Steps

1. Rosa opens `aiproviders` by its address. `not built`
   - 1.1 `aiproviders` shows S4: C1; C2 with `.stands.on` naming Provider A alone, "On" and the meter; C3 with Provider A as row 1, "On" and its health word; `.use.note`.
   - 1.2 The fold "Add an AI" (C4) is closed.
2. Rosa opens "Add an AI" and, under Provider B, opens its plan's fold. `not built`
   - 2.1 C4 shows `.add.intro` and `.add.grades`, then the providers as sub-headings in alphabetical order, each plan a fold named provider · plan · type.
   - 2.2 Provider B's plan fold shows C5: "Serves {who}.", "Price: …", the checks table with seven rows and then the two shown, each "Met", "Not met" or "Unconfirmed" with a source and date or "not stated", its grade, "Last confirmed {date}." and the three result lines; and A1 "Connect".
3. Rosa presses A1 "Connect". `not built`
   - 3.1 `aiconnect` opens for Provider B's plan in S1: C1, "Connecting: …" naming the plan, steps 1 to 6 (C3 to C8), "Enter it here" chosen, the sign-in panel disabled with `.s3.nosignin`.
   - 3.2 C3's table answers each of its six rows with a source and date or "not stated", and its terms that bind civic use.
4. Rosa opens A1, the provider's sign-up link, and on Provider B's own page makes the account and copies its key (outside Civicsmith). `not built` **AI**
   - 4.1 A1 opens Provider B's page outside Civicsmith, with the outward icon; C4 shows `.s2.never`.
5. Rosa pastes the key into "The key", presses A2 "Store the key in Cloudflare" and sends it with her reason. `not built` **AI**
   - 5.1 The field empties; the key is drawn nowhere, after a reload too.
6. Rosa ticks "I accept the terms above that bind our use of this plan." and presses A8 "Record my acceptance", with her reason. `not built`
   - 6.1 The acceptance is recorded with `rosa-l` and today's date. (design silent: the line drawn once recorded; lane to confirm)
7. **AI** Rosa presses A6 "Test the connection". `not built`
   - Present in any proper result (hard, every run):
     - 7.1 Step 5 shows S5, "Passed in {seconds} seconds." with a number.
     - 7.2 A7 "Switch it on" can be pressed.
   - Never present: the key; any of the team's material named as sent; the account shown on before S5.
   - **Without the assistant:** Rosa does not test. Provider B stays off (`.s5.note`); the journey goes to step 17.
8. Rosa chooses "Second" in C8, presses A7 "Switch it on" and sends it with her reason. `not built` **AI**
   - 8.1 `aiproviders` opens: C3 lists Provider A as row 1 and Provider B as row 2, both "On", each with a health word.
   - 8.2 C2 names both accounts in that order, with "On".
   - 8.3 C11 lists first a line with `rosa-l`, today's date and the level team.
9. In part 1 (C8), Rosa chooses Provider A in "Set a limit for", types its monthly limit from Test data, chooses 80% in "Tell administrators at", presses A8 "Set the limit and the alert" and sends it with her reason. `not built`
   - 9.1 C8's table shows Provider A's monthly limit; C11 gains a line.
10. **AI** Mai opens `aimine` by its address. `not built`
    - Present: 10.1 C2 lists Provider A first and Provider B second, each "The team's account" and "On", with `.now.note`.
    - 10.2 C5 shows the seven checks as "Required by the team", locked, no checkbox (S1).
    - Never: an account of her own; a checkbox on a check the team requires.
    - **Without the assistant:** step 18.
11. **AI** Mai opens the question, presses the masthead button "Assistant", and in the dock presses "Ask the assistant to work on this" (`assistant` A2).
    - 11.1 The dock (`assistant`) shows S2: "Started: the assistant is working on this.", C2 naming "On the team's key" (`ai.serves.group`), C3 with `.run.running`.
    - Never: words of an answer before Civicsmith's check (`ai.progress.hold`).
    - **Without the assistant:** step 18.
12. **AI** Mai keeps the question open while the run works, until Provider A's account reaches its limit. `not built`
    - Present: 12.1 The dock shows `aimoments` S2: `.a.what` naming Provider A, the time, and Provider B; `.a.note`; the buttons "Keep going on {provider}" naming Provider B, and "Stop here".
    - 12.2 The run waits: nothing more of the answer is drawn until she chooses.
    - Never: the answer going on with Provider B before her choice; a switch of account, model or provider without a moment shown (`aimoments` C2).
13. **AI** Mai presses "Keep going on {provider}" (A1). `not built`
    - Present: 13.1 The dock shows `aimoments` S3: `.b.what` naming Provider B, what it would receive, where it runs and how long it keeps it; `.b.note`; "Send it to {provider}" and "Don't send".
    - Never: material shown as already sent to Provider B.
14. **AI** Mai presses "Send it to {provider}" (A3) and sends it with her reason. `not built`
    - Present (hard, every run): 14.1 The run goes on; the dock's C4 shows the answer with the machine-work label, each cited passage linked to Housing notice 2026-118's `document`, "Checked by Civicsmith before it was shown", and "Legal information, not legal advice." where it says what the notice requires; on a test instance `ai.label.untested`.
    - 14.2 The answer neither concludes the question nor grades it; any reading waits for a member's "Accept this reading".
    - Never: a source the team does not hold; a quotation not found in the cited passage; a cost line shown to Mai, who pays for neither account (projects-and-questions, the assistant's six marks, item 6).
15. **AI** Mai presses "Ask the assistant to work on this" again. `not built`
    - Present: 15.1 `aimoments` S9: "Estimated: about {cost} on {account}" naming Provider B, "Start the run" and "Choose another account", and `.h.note`.
    - 15.2 After "Start the run" (A11) and the run's end: "Cost: {cost}".
    - (design silent: whether S9's cost lines show to a member who does not pay for the account, given the assistant's mark 6; lane to confirm)
16. Rosa opens `aiproviders`, then in part 1 raises Provider A's monthly limit for next month (A8), with her reason. `not built`
    - 16.1 Before the change, C8 shows Provider A's spending at its limit, with its meter, and Provider B's spending this month; C2 and C3 show Provider B "On" and "available".
    - 16.2 After it, C8 shows Provider A's new limit, and C11 lists the change first.
    - 16.3 (design silent: whether the continuation of step 13 appears among C11's changes; the journey's source says it does; lane to confirm)
17. **Without the assistant.** Rosa opens `aiproviders` with Provider B not tested. `not built`
    - 17.1 C3 lists Provider B, if added, as "Off"; C2 names only the accounts that are on, or shows S3 where none is.
    - 17.2 The order and limits are as Rosa left them; nothing was switched on.
18. **Without the assistant.** Mai, whom no account serves, opens the question.
    - 18.1 `question` shows S13: no "Ask the assistant to look" or other assistant control; the masthead has no "Assistant" button; no dock.
    - 18.2 No `aimoments` panel shows on any screen.
    - 18.3 She works on the question by hand: "Cite a passage" (A1), "Find another source" (A3) and "Conclude" (A11) are offered.

## End state

Checked after a reload.

1. `aiproviders`, as Rosa: C3 lists Provider A first and Provider B second, both "On"; C8 shows Provider A's raised limit; C11 lists Provider B switched on, the limit set and the limit raised, each with `rosa-l`, date and level team.
2. `aimine`, as Mai, lists Provider A then Provider B, "The team's account", "On".
3. The answer of step 14 is kept with its machine-work label; it is not a reading the question stands on until a member accepts it.
4. `/app/aiproviders`, as Mai, shows `unavailable` S2: it is not hers to see.
5. Without the assistant (steps 17 and 18): the team's AI settings are as the administrators left them, and Mai's screens show no sign of the assistant.

## Ways it can turn aside

1. **Not built.** Each address on the page `ai` draws `unavailable` S1; steps 1 to 17 are recorded not built; step 18 is walked.
2. **The test fails** (step 7). Step 5 shows S6, Provider B's words quoted and who can fix it; A7 cannot switch it on. Resume at step 5 with a working key.
3. **A free tier that trains.** `aiconnect` is in S3: "Warning.", `.s4.warn` and a second checkbox `.s4.freebox`; both must be ticked at step 6.
4. **Not offered.** A plan barred for teams sits under "Not offered" (C6, `.refused.personal`); a plan failing a required check, or the origin check, likewise; a plan that does not say where it runs sits under "Held until confirmed" (C7). None offers "Connect". Choose another plan for Provider B.
5. **Mai stops** (step 12). "Stop here" (A2): the run stops; nothing more is sent; Provider B receives nothing. The journey ends at step 16.
6. **Mai does not send** (step 13). "Don't send" (A4): nothing is sent; the run stops. The journey ends at step 16.
7. **No later account on.** If Provider B is off when A's limit is reached, the dock shows S4: `.c.what`, `.c.who` naming the administrators, "Wait until {date}" and "Continue without AI". "Continue without AI" closes the panel; the question's own way without the assistant remains (step 18).
8. **The provider is down.** S5: `.d.what`, `.d.note`, "Wait a little longer", "Switch to {account}", "Continue without AI".
9. **A use switched off.** S8: `.g.what`, `.g.who`, "Ask {who} to switch it on", "Continue without AI"; the work is not moved to another account.
10. **The run cannot start** (step 11). The dock shows S4 with its reason (`dock.withheld.*`), never blank, including "Nothing was sent."
11. **Reason left empty** (any "Asks for a reason" act). `shell.reason.needed`; nothing is sent. Resume at the same step.

## Changes

- 22 Nov 2026: written.
