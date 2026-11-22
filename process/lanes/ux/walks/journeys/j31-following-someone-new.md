Length: 86 lines. Last section: "Changes".

# J31: Following someone new

Journey page `j31-following-someone-new` (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

Status: walkable · Screens used: `people`, `person` · Follows: J28 (walked straight after it, before any document is captured) · Followed by: J10, J13, J14

## Goal

"The team means to follow the landlord of 14 Lakeshore Row, whom the record does not hold yet, so I add them."

## Who

1. Rosa (`rosa-l`), founder and first administrator of Lakeshore Tenants, signed in on her own device.
2. Mai (`mai-k`), a member, signed in, only for the check in End state 4.
3. Neither needs the assistant; the walk has no AI account (every-screen section 5).

## Before it starts

1. J28 has been walked on this copy: the team Lakeshore Tenants exists, Rosa is its administrator and Mai is a member.
2. No document has yet been captured into a project, and the record follows no one but the public bodies and offices added at setup.
3. The record follows nothing named "The landlord of 14 Lakeshore Row".

## Test data

| Item | Value |
|---|---|
| Their name | "The landlord of 14 Lakeshore Row" |
| A person or an organization? | "An organization" |
| Your note | "Owns 14 Lakeshore Row. The team asks whether it has been ordered to repair the roof." |
| Reason (the act asks for one) | "The team's question is about this landlord." |
| Search words | "Lakeshore Row" |

## Steps

1. Rosa opens `people` from the rail's "People".
   - 1.1 `people` shows state S4: C1, and one row for each public body and office of the team's place.
   - 1.2 Each row carries the count line `.counts.none` and the line `.today.seeded`.
   - 1.3 Each row carries its "Follow from here" fold (the-record, "Follow from here").
   - 1.4 No row is named "The landlord of 14 Lakeshore Row".
   - 1.5 The path under the masthead reads from "People" to the screen's own name, with "People" current in the rail (every-screen section 3).
2. Rosa presses A4.
   - 2.1 `people` shows state S5: the field "Their name", the two radios of "A person or an organization?", the note field with its help, and the A5 button.
   - 2.2 Neither radio is chosen (every-screen section 1, rule 1).
3. Rosa fills in the name, chooses the organization radio and writes the note from Test data.
   - 3.1 The three entries show as typed; nothing is sent yet.
4. Rosa presses A5.
   - 4.1 A5 carries the "Asks for a reason" weight with two dots (every-screen section 6).
   - 4.2 The reason field opens beside A5, with its "Send with this reason" and "Cancel" buttons.
5. Rosa writes the reason from Test data and sends it.
   - 5.1 The button shows working, then done (every-screen section 6).
   - 5.2 The new `person` page opens for "The landlord of 14 Lakeshore Row", in state S2 (an organization).
   - 5.3 Its C1 heading is the name from Test data, and the count of documents naming it is zero.
   - 5.4 Its C2 section "Connections" draws no link to any other record.
   - 5.5 Its C5 section is headed with the "about it" form of the heading (`entity.says.title.org`).
6. Rosa follows the path link "People" back to `people`.
   - 6.1 `people` lists a row "The landlord of 14 Lakeshore Row", with the count line `.counts.none`.
   - 6.2 The row's name is a link (A2) to the `person` page of step 5.
   - 6.3 Whether `people` still shows S4 or now shows S1 once a member has added someone is not said (design silent: lane to confirm); either way the setup rows of step 1 stay listed.
7. Rosa types the search words from Test data and presses A1.
   - 7.1 The rows filter to those matching the words; the row of step 6 is among them.
   - 7.2 No public body added at setup is listed unless its name holds the words.

## End state

Checked after a reload of `people`.

1. `people` lists "The landlord of 14 Lakeshore Row" with the count line `.counts.none`.
2. Its row's name opens `person` in state S2 with the heading from Test data.
3. The public bodies and offices of step 1 are still listed.
4. Signed in as Mai, `people` lists the same row (any signed-in member can see it).
5. Neither `people` nor `person` shows an "Assistant" button or a dock (every-screen section 5).

## Ways it can turn aside

1. **Empty form.** At step 4, Rosa presses A5 with the name or the note empty: `people` shows V1 beside the act, nothing is followed, and the typed fields keep their words. The journey resumes at step 3.
2. **Empty reason.** At step 5, Rosa sends the reason field empty: the shell's refusal `shell.reason.needed` shows beside the act and nothing is sent. The journey resumes at step 5.
3. **Cancel.** At step 5, Rosa presses "Cancel": the reason field closes, nothing is followed, and the form keeps its entries. The journey resumes at step 4.
4. **No match.** At step 7, Rosa searches words no followed name holds: `people` shows state S3, with A4 and the A6 link to `finder`. The journey resumes at step 7 with the words from Test data.
5. **Followed already.** The record already follows a record of that name (a second walk on the same copy): the design does not say whether a second record is made or the act is refused (design silent: lane to confirm). The walk records what shows and stops.
6. **Team out of reach.** At any step the team's Civicsmith does not answer: `unavailable` shows state S3, and what was typed stays on the page. The journey resumes at the same step once it answers.

## Changes

- 22 Nov 2026: written.
