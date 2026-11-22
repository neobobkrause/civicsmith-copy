Length: 116 lines. Last section: "Changes".

# J06: From a problem to a question

Journey page `j06-from-a-problem-to-a-question` (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

Status: AI (step 6 is AI; its path without the assistant, step 7, is walked first) · Screens used: `home`, `notes`, `capture`, `document`, `answers`, `finder`, `find-in`, `standard`, `project`, `question`, `request` · Follows: J28 · Followed by: J07

Sources: `mock-journeys.js` journey 6 and `JBRIEF[6]`; `journeys.html` #j6; `build/plan/lane-journeys/PLAN.md` section 3, row 6.

## Goal

"The roof over my flat leaks and nobody fixes it: I want to turn that into a question about the city's own standard that the record can answer."

## Who

1. Mai, a new member of Lakeshore Tenants, signed in, who may start projects (as J28 gave her). She holds no project yet.
2. For step 6 only: Mai with an AI account serving her (her own, connected in J04). Every other step is taken with no AI account; the assistant is then absent, not greyed (`every-screen` section 5).

## Before it starts

1. J28 has been walked on this copy: the team Lakeshore Tenants exists, Rosa is its administrator, Mai is a member who may start projects and is signed in.
2. The team holds no project, and no copy of Housing notice 2026-118.
3. Housing notice 2026-118 is served at an address the walk can capture from; which address, on a development copy, is ARCH's to say (index, section 5).
4. For step 6 only: J04 has been walked, so an AI account serves Mai. Without it, step 6 is recorded not walked and step 7 is taken.

## Test data

| Item | Value |
|---|---|
| Note (step 2) | "The roof over my flat at 14 Lakeshore Row leaks every time it rains, and the landlord does nothing." |
| Testimony (step 3) | In her own words: "Water comes through the ceiling of my flat at 14 Lakeshore Row when it rains." Where: "14 Lakeshore Row". When: a day and time no later than now. Photo: one photo Mai took of the ceiling. |
| Document captured (step 4) | Housing notice 2026-118, from the address ARCH gives |
| Question asked of the assistant (step 6) | "What standard did the city set for the roof at 14 Lakeshore Row?" |
| Search words (step 7) | "roof" |
| Standard held (step 9) | The notice's passage ordering the roof repair. How it is cited: "Housing notice 2026-118". Who set it: "City of Lakeshore". Why: "The city ordered this repair itself." |
| Project title (step 10) | "Roof repairs" |
| Question (step 11) | "Has the landlord been ordered to repair the roof of 14 Lakeshore Row?" Reason: "This is what my note is about." |

## Steps

1. Mai opens Home and, under its heading over the doors, picks the door "A problem I live with" (`home` A12).
   - 1.1 `home` shows state S1 or S2 (S2 on her first visit after joining), with C8 and its doors A12 and A13.
   - 1.2 The door's offer opens in place on `home`: suggested wizards, the matching line and the blank-page line, as `home` A12 says. Nothing is recorded by opening it.
2. Mai opens Your notes (Settings) and writes the note from Test data, then presses the button to write it (`notes` A1).
   - 2.1 `notes` C1 says only she can see her notes.
   - 2.2 The note is first in C3, its row carrying the only-you mark (C3; state S1).
   - 2.3 The first time, C5 shows under the note.
3. Mai opens Add, takes the tab for what she saw (`capture` A1, state S3), fills C20's three fields from Test data, adds her photo, and records it (A16). `waiting A4`
   - 3.1 `capture` shows S3 with C19 and C20; no A17 and no draft mark (S11).
   - 3.2 After A16, `capture` shows S10: recorded as her testimony, with its id.
   - 3.3 Whether Mai can then look at her own photo inside Civicsmith is open question A4; a walk notes what shows and records a difference as an observation.
4. Mai stays on Add, takes the tab "From an address" (A1, state S1), types the notice's address into C5's field, and presses "Capture" (A2).
   - 4.1 `capture` shows S5: captured, with the notice's title, waiting in Held captures.
   - 4.2 Its link "Open it" (A6) leads to `document`.
5. Mai opens the captured notice (A6), reads it, and vouches for it (`document` A2), filling "What you checked" and "What the team does about what remains".
   - 5.1 Before the vouch, `document` shows S2: C1, C2 and the held banner with A2; no C18.
   - 5.2 After the vouch, `document` shows S1, C3 naming Mai as the one who vouched, with the day.
6. **AI.** Mai opens Ask (`answers`), types the question from Test data in "Your question", and presses "Ask" (A1), giving her reason.
   - What must be present in any proper result (hard, every run):
     - 6.1 `answers` shows S2 while it works (progress rows, no answer words), then S1.
     - 6.2 The answer carries the machine-work label (`answers` C3; `projects-and-questions`, "The assistant on these screens", item 1).
     - 6.3 It cites at least one passage of Housing notice 2026-118, each a link to `document` at that passage, beside the line that Civicsmith checked it before it was shown.
     - 6.4 It carries C3's legal-information line (`screen.answers.legal`) and its lines for where it looked.
     - 6.5 On a test instance it carries the untested label.
   - What must never be present:
     - 6.6 A source the team does not hold; a quotation not found in the notice; advice on what Mai should do in law; a statement that the landlord or the city acted unlawfully; the answer drawn as Mai's words or as evidence; a cost line, unless Mai owns the paying account.
   - **Without the assistant:** step 7 is taken instead, and step 6 is recorded not walked.
7. **Without the assistant.** Mai opens Find (rail "Find"), types "roof" in "Your words", and presses "Search" (`finder` A1).
   - 7.1 `finder` shows S1 (or S6): C3 lists Housing notice 2026-118, with a passage holding the word and the words around it.
   - 7.2 Nothing about the assistant shows on `finder` or in the masthead (S7).
   - 7.3 The notice's title (A2) leads to `document`.
8. On the notice, Mai presses "Find in this" (`document` A5), ticks "Dates and deadlines" and "Requirements: what someone shall or must do" (C3), and presses "Find" (A1).
   - 8.1 `find-in` shows S1, its "Look in" set to this document.
   - 8.2 C5 lists results in a section per kind, each a quote with its passage number; the requirements section holds the passage that orders the roof repair.
   - 8.3 Each result was found by search; no section "Proposed by the assistant" shows (S6).
9. On the passage that orders the roof repair, Mai presses "Hold this as a standard" (`find-in` A5) and fills its three fields from Test data.
   - 9.1 C5 shows the passage marked as held as a standard.
   - 9.2 The standard opens on `standard` in S1: C1 is the requirement's words and its citation; C2 quotes the passage. (Which project a standard held before any project exists belongs to: design silent: lane to confirm.)
10. Mai goes Home and presses "Start a project" (`home` A14), typing "Roof repairs" as its title.
    - 10.1 `project` opens in S2: the title as heading 1, "Opened by" Mai with the day, and the field for a first question with "Open a question".
11. Mai types the question from Test data and presses "Open a question" (`project` A1), giving the reason from Test data. `waiting A1`
    - 11.1 `question` opens in S3: heading 1 the question's words, C2's three steps, the section for bringing in a source, the row to add a document and the button to find one; no row asking the assistant (S13).
    - 11.2 No screen asks who the question is about (open question A1); a difference is an observation.
    - 11.3 Back on `project`, C7 lists the question, marked as resting on nothing yet.
12. The records behind the notice are not public, so Mai opens the project's link "Records requests" (`project` C11).
    - 12.1 `request` opens in S1 (or S2 when no office is known): C1's heading and its line to look first; the journey goes on in J07.

## End state

Checked after a reload, signed in as Mai:

1. `projects` lists "Roof repairs"; its `project` shows S1 or S2 with the question from Test data under Questions (C7).
2. `question` for that question shows S3: nothing cited yet.
3. `notes` C3 lists the note with its only-you mark. Signed in as Rosa, `notes` shows no such note (S2 or her own notes only).
4. Housing notice 2026-118 opens on `document` in S1, vouched for by Mai; `finder` finds it by "roof" for Rosa too.
5. The standard from step 9 opens on `standard` in S1.
6. Mai's testimony is held, recorded as hers (it shows by its id where the record lists her captures).

## Ways it can turn aside

1. Step 2, the note left empty: `notes` V1; nothing is kept. Resumes at step 2.
2. Step 3, "When" after now or a field missing: `capture` V9; nothing is recorded. Resumes at step 3.
3. Step 4, the address cannot be fetched: `capture` V2 or V3 beside the address; nothing is captured. Resumes at step 4 once ARCH's address answers.
4. Step 4, the notice is already held: `capture` S6 with "Open it"; nothing new is saved. Resumes at step 5 (or step 6 if already vouched for).
5. Step 5, the vouch fields left empty: `document` V3. Resumes at step 5.
6. Step 6, the assistant unreachable or refused: `answers` S4, S3, or a message from V2 to V4; or, with no AI account at all, `answers` is S5 "Find and count". Resumes at step 7.
7. Step 7, no result: `finder` S2 with "Capture it" (A11): the notice is not held. Go back to step 4.
8. Step 8, nothing ticked: `find-in` V1. Resumes at step 8.
9. Step 10, the title left empty: `home` V1. Resumes at step 10. A member who may not start projects sees `home` S3 or S4 with no A14: the journey stops; J30 is the way into a project.
10. Step 11, the question left empty: `project` V1. Resumes at step 11.
11. At any step, the team's Civicsmith out of reach: `unavailable` S3; what was typed stays. Resumes at the same step when it answers.

## Changes

- 22 Nov 2026: written.
