Length: 87 lines. Last section: "Changes".

# J11: Building a timeline

Journey page `j11-building-a-timeline` (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1. Steps follow the wizard "Build a timeline" (library.json), walked here without its guide.

Status: walkable · Screens used: `project`, `timeline`, `document` · Follows: J28, J31, J06, J10 · Followed by: J15 (the timeline is frozen into the case at signing)

## Goal

"I want what happened over the roof at 14 Lakeshore Row in order: what they did and what we did, never mixed, and nothing placed by guess."

## Who

1. Mai (`mai-k`), a member of the project "Roof repairs" (J06), signed in on her own device.
2. No AI account; nothing in this journey needs the assistant (the-record, "The assistant on these screens").

## Before it starts

1. J28 has been walked: Lakeshore Tenants exists; Mai is a member.
2. J06 has been walked: the project "Roof repairs" holds the question "Has the landlord been ordered to repair the roof of 14 Lakeshore Row?", and Mai is a member of it.
3. J06 also captured Housing notice 2026-118: it is among the project's documents, vouched for by Mai.
4. J10 has been walked: the record follows the official who issued the notice, and the notice names them.
5. The project's timeline holds no event recorded by a member.

## Test data

| Item | Value |
|---|---|
| Event 1 | What: "Housing notice 2026-118 issued, ordering the roof repair at 14 Lakeshore Row"; when: the date printed on the notice, to the day; cited passage: the notice's passage that gives its date |
| Event 1's participant | The official (J10), role: signed |
| Event 2 | What: "The roof of 14 Lakeshore Row repaired"; when: not known (no date); cited passage: the notice's passage that orders the repair |
| Link | Event 2 made under event 1 |
| Hunch | "The landlord has not yet repaired the roof." |
| Reasons (acts that ask for one) | "As Housing notice 2026-118 states." |

## Steps

1. Mai opens the project and follows its C11 link "Timeline".
   - 1.1 `timeline` shows state S1: C1 heading and the project's name.
   - 1.2 C2 shows the two lanes "What they did" and "What we did", side by side or one after the other, each under its own name.
   - 1.3 Neither lane holds an event recorded by a member.
   - 1.4 C5's five buttons are offered.
2. Mai presses "Record an event" (C5) and records event 1 from Test data, citing the notice's passage.
   - 2.1 The event form asks what happened, when, how precisely the date is known, and the passage it rests on (design silent: lane to confirm the form's fields; the screen page names none).
   - 2.2 After sending, event 1 is listed in the lane "What they did", with its date, the precision "To the day", and a link to Housing notice 2026-118.
   - 2.3 Event 1 carries a grade and its "Follow from here" fold.
   - 2.4 The lane "What we did" does not hold event 1.
3. Mai presses "Add who took part" (C5) and adds the official to event 1 with the role "signed".
   - 3.1 Event 1 shows the official as taking part, with the role.
   - 3.2 The official's name links to their `person` page (design silent: lane to confirm).
4. Mai presses "Record an event" and records event 2 from Test data, giving no date.
   - 4.1 Event 2 is listed under C4 "Undated", with the line `.undated.apart`.
   - 4.2 Event 2 is in neither lane of C2: it is not placed by guess.
5. Mai presses "Link events" (C5) and links event 2 to event 1 as "made under".
   - 5.1 The link shows on event 2 (or on both), naming event 1 and the kind of link (design silent: lane to confirm where it is drawn).
6. Mai presses "Keep a suspected cause as a hunch" (C5) and keeps the hunch from Test data.
   - 6.1 The hunch is listed, marked as a hunch and as Mai's.
   - 6.2 The hunch is not an event in either lane, and carries no grade.
7. Mai reads the two lanes as they stand.
   - 7.1 "What they did" holds event 1; "Undated" holds event 2; the hunch is apart from both.
   - 7.2 "What we did" holds only the team's own acts, if any earlier journey made one, and none of steps 2 to 6.
   - 7.3 No "Undetermined order" line (C3) shows, since only one event is dated; if one shows, it names its events and why, and never places them in a guessed order.
8. Mai follows event 1's link to its document (A3).
   - 8.1 `document` opens on Housing notice 2026-118, state S1.

## End state

Checked after a reload of `timeline`, signed in as Mai.

1. Event 1 is in "What they did" with its date, precision, the official as signer, its grade and the link to the notice.
2. Event 2 is under "Undated", linked to event 1 as made under it.
3. The hunch is listed as Mai's hunch, apart from the lanes.
4. Nothing on the screen carries the machine-work label.

## Ways it can turn aside

1. **Not a member of the project.** Mai is not a member: the project shows `project` S4 and its C11 link is not offered; the timeline's address leads to `unavailable` (design silent: lane to confirm which state). Mai asks to join (`project` A18); an owner admits her (J30); resume at step 1.
2. **No passage cited.** At step 2, the event is sent with no passage: the act's refusal shows beside it by its code (every-screen section 7), and nothing is listed. Resume at step 2.
3. **Empty reason.** An act that asks for a reason is sent with the reason empty: `shell.reason.needed`; nothing is sent. Resume at the same step.
4. **Event placed in the wrong lane.** Event 1 shows in "What we did": a flaw; the walk records it and goes on.
5. **Two dated events, order not known.** If the walk records a second dated event whose date cannot be ordered against event 1, C3 shows the "Undetermined order" line with its three buttons; the journey goes on at step 3.
6. **Team out of reach.** `unavailable` S3; resume at the same step.

## Changes

- 22 Nov 2026: written.
