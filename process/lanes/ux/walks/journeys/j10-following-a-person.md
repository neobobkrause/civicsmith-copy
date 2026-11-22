Length: 117 lines. Last section: "Changes".

# J10: Following a person

Journey page `j10-following-a-person` (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

Status: AI (step 12; its path without the assistant, step 11, is walked first) · Screens used: `document`, `people`, `person`, `find-in`, `finder`, `assistant` · Follows: J28, J31, J06 · Followed by: J11, J13

## Goal

"The official who issued the housing notice matters to our question: I want what the record says about them, each fact dated and cited."

## Who

1. Mai (`mai-k`), a member who may start projects and contribute, a member of the project "Roof repairs" (J06), signed in on her own device.
2. Step 12 only: Mai with an AI account serving her, so that the assistant is reachable (every-screen section 5). Every other step is walked with no AI account.

## Before it starts

1. J28 has been walked: Lakeshore Tenants exists, with Rosa as administrator and Mai as a member.
2. J31 has been walked: the record follows "The landlord of 14 Lakeshore Row".
3. J06 has been walked: the project "Roof repairs" holds the question "Has the landlord been ordered to repair the roof of 14 Lakeshore Row?", and Mai is a member of it.
4. J06 also captured Housing notice 2026-118: it is in the record, vouched for by Mai, among the project's documents (`project` C5).
5. The record does not yet follow the official who issued the notice.

## Test data

| Item | Value |
|---|---|
| The document | Housing notice 2026-118 |
| The official | The person the notice names as issuing or signing it; their name is read from the notice itself (called "the official" below) |
| Note when following them | "Issued Housing notice 2026-118, which orders the roof repair at 14 Lakeshore Row." |
| The fact | The official's post, as the notice states it beside their name, true from the notice's date |
| The register | A public register that lists the official, at an https address ARCH names for the development copy |
| Reasons (acts that ask for one) | "It is stated in Housing notice 2026-118." |
| Step 12's question to the assistant | "What other posts has the official held, in what the team holds?" |

## Steps

1. Mai opens Housing notice 2026-118 from the project's C5 list.
   - 1.1 `document` shows state S1: its C1 heading is the notice's title, and C3 says who vouched for it.
   - 1.2 C8 shows the page's words; the official's name can be read on them.
2. Mai presses A21 on `document`.
   - 2.1 C21 lists the names the notice carries, each with its grade and how it was matched; or C20's note shows that it found no name.
   - 2.2 Nothing is added to `people` by this act (design silent: lane to confirm).
3. Mai opens `people` from the rail and presses A4.
   - 3.1 `people` shows state S5, the form for adding someone, with neither radio chosen.
4. Mai fills in the official's name, chooses "A person", writes the note from Test data, presses A5 and sends the reason from Test data.
   - 4.1 A5 opens the reason field before anything is sent (every-screen section 6).
   - 4.2 The new `person` page opens for the official, in state S3: C1 with zero documents naming them, and the `person.graph.none` line in "Connections".
5. On `person`, Mai presses A5 ("Connect the documents that name them").
   - 5.1 C2 gains a link to Housing notice 2026-118.
   - 5.2 C1's count of documents naming them is now one.
6. Mai goes back to the project by the path and presses its A3, which opens `find-in` set to the project.
   - 6.1 `find-in` shows state S3: C2's "Look in" choice reads "Everything in {project} ({count} documents)" with the project's name.
7. Mai ticks "People and offices your team follows" in C3, types the official's name in "The name or term" and presses A1.
   - 7.1 C5 shows a section for people and offices with a count of at least one.
   - 7.2 One result quotes the notice's passage naming the official, with its passage number and place line.
   - 7.3 Nothing is recorded on `person` until Mai acts on a result.
8. On that result Mai presses A3, fills C8 with the fact from Test data ("When it is true": true from the notice's date), and sends the reason.
   - 8.1 `find-in` shows the line `.recorded.fact` naming the official and the fact.
9. Mai opens `people` from the rail, types the official's name and presses A1.
   - 9.1 The official's row shows under "In your projects", with the count line `.counts.three` or `.counts.docsonly` naming at least one document.
   - 9.2 The row offers A3 ("Explore connections"), since a document names them.
10. Mai opens the official's row (A2).
    - 10.1 `person` shows state S1 (no longer S3).
    - 10.2 C3 or C4 lists the fact of step 8, with Housing notice 2026-118 as its source and a grade.
    - 10.3 The fact's date reads from the notice's date, with no end date.
11. **Without the assistant** (walked first; it stands for step 12). Mai looks for the official's other posts herself (design silent: lane to confirm; the earlier design gave this step no path without the assistant). She opens `finder` from the rail, types the official's name in "Your words" and presses A1.
    - 11.1 `finder` shows S1 or S6 with the documents naming the official, or S2 when nothing does.
    - 11.2 No "Assistant" button and no dock are drawn (every-screen section 5).
    - 11.3 Where a result names another post, Mai opens it (A2), uses its A5 "Find in this" and records the post as in steps 7 and 8; it is then listed on `person` as in step 10. Where none does, nothing is recorded.
12. **AI.** Mai, with an AI account serving her, opens the dock with the masthead's "Assistant" button and asks the question from Test data with the dock's A1 ("Ask").
    - What must be present (hard, every run):
      - 12.1 The answer carries the machine-work label (projects-and-questions, "what its work always carries", item 1).
      - 12.2 Each post it names is cited: a link to a `document` the team holds, beside `ai.progress.checked.all`.
      - 12.3 It says where it looked (which documents or which part of the record).
      - 12.4 Where nothing names another post, it says so, and names no post.
      - 12.5 On a test instance, `ai.label.untested` shows.
    - Must never be present:
      - 12.6 A post with no citation, or a citation to a document the team does not hold.
      - 12.7 A fact added to the official's C3 or C4 by the assistant: `person` after a reload shows only what members recorded.
      - 12.8 A same-person claim, a grade or a merged record made by the assistant.
    - Rubric (judge, yes / no / unknown):
      - 12.9 "Does every post named in the answer appear in a cited passage of the team's documents?"
    - Trials: pass if 3 of 3 runs pass 12.1 to 12.8, and 12.9 is "yes" in at least 2 of 3.
    - Without the assistant: step 11, which reaches the same end (posts found are recorded by Mai, cited; or none).
13. On `person`, Mai presses "Follow a register" (A2), gives the register's address from Test data, and sends it.
    - 13.1 The register is listed as followed on the official's `person` page (design silent: lane to confirm where).
    - 13.2 Changes the register shows later reach Mai's `queue` (design silent: lane to confirm).

## End state

Checked after a reload, signed in as Mai.

1. `people` lists the official under "In your projects", with at least one document naming them.
2. The official's `person` page shows the fact of step 8, sourced to Housing notice 2026-118, with a grade and its date.
3. Its C2 links the official to Housing notice 2026-118.
4. Every fact on the page was recorded by a member; none carries the machine-work label.
5. The followed register is shown as followed.
6. Signed in as Rosa, `people` and the official's `person` page show the same.

## Ways it can turn aside

1. **No name found.** At step 2, C20's note shows: the journey goes on at step 3, since adding the person does not depend on A21.
2. **Empty follow form.** At step 4, the name or note left empty: `people` V1; nothing is followed. Resume at step 3.
3. **Bad dates.** At step 8, "True from" holds something that is not a date: `find-in` V5 shows beside A3 and nothing is recorded. Resume at step 8.
4. **No kind ticked.** At step 7, nothing ticked in C3: `find-in` V1. Resume at step 6.
5. **Not found in the project.** At step 7, C5 shows "Nothing here." with no passage: the notice is not read in full (`document` S4) or not in the project. Check `document` C2 "Its text"; the journey stops and the walk records what shows.
6. **Same person?** Mai opens the `person` C6 fold and presses "Say another record is this person" with "The other record" empty: `person` V3 shows and nothing is recorded. With no second record of the official, this is the end of that path; no claim is made.
7. **Register address wrong.** At step 13, an address not starting https://: `person` V2. Resume at step 12.
8. **Assistant unreachable.** At step 12, the run cannot start: the dock says why in words (`assistant` S4, a `dock.withheld.*` reason), never blank; nothing is sent. The journey goes on at step 13; step 11 stands for step 12.
9. **Team out of reach.** `unavailable` S3; resume at the same step.

## Changes

- 22 Nov 2026: written.
