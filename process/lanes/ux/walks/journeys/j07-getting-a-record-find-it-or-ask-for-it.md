Length: N lines. Last section: "Changes".

# J07: Getting a record: find it, or ask for it

Journey page `j07-getting-a-record-find-it-or-ask-for-it` (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

Status: walkable · Screens used: `finder`, `capture`, `project`, `request`, `action` · Follows: J28, J06 · Followed by: J08

Sources: the wizard "Get a record" (`library.json`, steps 1 to 8; its step 9 is walked in J08, which the wizard also names); `mock-journeys.js` journey 7 and `JBRIEF[7]`; `journeys.html` #j7; `PLAN.md` section 3, row 7.

## Goal

"I need the city's records behind the roof notice: if they are already public I'll capture them, and if not I'll ask the office for them under the law."

## Who

1. Mai, a member of Lakeshore Tenants and of its project "Roof repairs", signed in, with no AI account (none is needed: the request's text comes from the team's own template, never a machine draft).

## Before it starts

1. J06 has been walked on this copy: the project "Roof repairs" exists, Mai is its member, and the team holds Housing notice 2026-118, vouched for.
2. The team's places, as set when J28 installed and set up the team, hold the office that keeps Lakeshore's housing records and a records law with a response deadline, so `request` opens in S1. Which held place stands for Lakeshore on a development copy is not said by the design (design silent: lane to confirm). Where no office is known, see turn-aside 4.
3. The team holds no copy of the inspection records named in Test data, and they are not public.

## Test data

| Item | Value |
|---|---|
| Search words (step 1) | "inspection 14 Lakeshore Row" |
| The office (step 3) | The office the team's places list as holding housing records |
| What records you want (step 4) | "The inspection records for the roof of 14 Lakeshore Row that led to Housing notice 2026-118, and any record of the landlord's reply to that notice." Reason: "These are the records behind the notice." |
| The law (step 5) | The records law the team's places offer for this office. Reason: "The law the office answers under." |
| The text (step 6) | The template's draft, with Mai's one added sentence: "Please send copies in electronic form." Reason: "Drafted from our template." |
| The portal's request number (step 8) | "LTR-TEST-0001" (one line, at most 100 characters) |
| Reason for recording the sending (step 8) | "Sent through the office's portal today." |

## Steps

The wizard's own guide may be open beside the screens; what it shows is not on any screen page (design silent: lane to confirm). Each step below is walked on the screen it names.

1. Mai looks first: she opens Find (rail "Find"), types the search words from Test data, and presses "Search" (`finder` A1).
   - 1.1 `finder` shows S1, S2 or S6. No result is the inspection records: either S2 (with link "Capture it", A11), or S1 listing only what J06 left (Housing notice 2026-118 and Mai's testimony).
   - 1.2 Nothing about the assistant shows (S7).
2. The records are not public, so Mai does not capture them (the wizard's step 2 is skipped: see turn-aside 1). She opens the project "Roof repairs" and its link "Records requests" (`project` C11).
   - 2.1 `request` opens in S1 at `/app/request/<project id>`: C1's heading, its line to look first, and the wizard mark "Get a record".
   - 2.2 C2 offers "Start another kind of action" (A1).
3. Mai presses "Choose the office" (`request` A2) and picks the office from Test data in "The office that holds the records" (C3).
   - 3.1 The offices are suggested on the same screen, each with who holds it today (C3).
   - 3.2 The office chosen shows who holds it that day.
4. Mai types the records wanted from Test data in C4's field and presses "Start the request" (A3, Asks for a reason), giving the reason from Test data.
   - 4.1 The reason field opens beside the act (`every-screen` section 6); after sending, the address becomes `/app/request/<action id>`.
   - 4.2 C5's choice of the law is offered.
5. Mai chooses the law in C5 and presses "Choose the law it goes under" (A4, Asks for a reason).
   - 5.1 The law chosen shows in C5 with its window, counted in calendar or in business days.
   - 5.2 C5's link "How a records request works" (A9) leads to `help-records`.
6. Mai presses "Prepare the text" (A5, Asks for a reason), reads the draft in "The request" (C7), and adds her sentence from Test data.
   - 6.1 C7 is drafted from the team's template (S3); no draft is marked as the assistant's and no "Help me write this" is drawn.
   - 6.2 C8 shows the team's statement it is sent with.
7. Mai presses "Approve this text" (A6, Ends something) and confirms.
   - 7.1 The confirm dialog opens beside the act, named by its label, with the line that it is done in her name, and buttons "Confirm" and "Cancel" (`every-screen` section 6).
   - 7.2 After "Confirm", the text is fixed; C10 "How to send it" shows its four steps, and C11's outward panel shows.
8. Mai sends the request through the office's portal, outside Civicsmith (nothing to observe there), then types the portal's request number in C11 and presses "I have sent it · record the sending" (A7, Asks for a reason, Outward), with the reason from Test data.
   - 8.1 Before it is done, C11 shows its outward tag and its `.outward` sentence; the button carries the outward icon.
   - 8.2 After it is done, `action` opens.
9. Mai reads the action.
   - 9.1 `action` shows S1: C1: the kind and title as heading, the office it went to, today as the sending day, and Mai as sender.
   - 9.2 C2 shows the response due date and the line that it waits on the office's reply.
   - 9.3 C3 lists the due date in its pending state, a link to `due-date`.
   - 9.4 C4 lists no reply yet; C8 offers "Prepare the text" (A9).

## End state

Checked after a reload, signed in as Mai:

1. `project` "Roof repairs" C11 "Actions" leads to the action; `action` shows S1 with the office, the sending day, and the due date pending.
2. `request` at `/app/request/<action id>` shows the approved text, fixed.
3. The portal's request number from Test data shows with the request.
4. Signed in as Rosa, who has not joined "Roof repairs", the action's address shows `unavailable` S2, as `deciding-and-acting` ("How to read this page") draws for a member who cannot see the project. (Whether a team member who can see the project only as S4 counts as one who cannot see it: design silent: lane to confirm.)

## Ways it can turn aside

1. Step 1, the record is public: Mai captures it from its address on `capture` (S1, A2), reaching S5; the wizard says she is then done. The journey ends there, J08 cannot follow, and the walk records which branch it took.
2. Step 3, no office chosen: `request` V1. Resumes at step 3.
3. Step 4, nothing typed in C4: `request` V2. Resumes at step 4.
4. Step 2, no office known yet: `request` S2 replaces C3 to C11. Mai opens "Name the office yourself", fills its fields and presses "Use this office" (A8); before it is done its protected consequence shows; then S1 with the office carrying its named-by-a-member mark. Resumes at step 3. Where the team has no body listed at all: V4; the journey stops until an administrator adds one on `places`.
5. Step 7, "Cancel" in the dialog: nothing is changed; the text stays as written. Resumes at step 7.
6. Step 8, the request number malformed (two lines, or over 100 characters): `request` V3. Resumes at step 8.
7. Step 8, Mai leaves before recording the sending: the queue later offers "Pick up where you left off" (`queue` A6), which reopens `request` at the send. Resumes at step 8.
8. Any step, a reason sent empty: the shell's message for an empty reason, and nothing is sent (`every-screen` section 6). Resumes at the same step.

## Changes

- 22 Nov 2026: written.
