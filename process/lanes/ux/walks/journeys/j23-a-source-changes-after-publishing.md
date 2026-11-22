Length: 103 lines. Last section: "Changes".

# J23: A source changes after publishing

Journey page `j23-a-source-changes-after-publishing` (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

Status: walkable · Screens used: `document`, `queue`, `question`, `docket`, `case-editor`, `ceremony`, `published`, `docket-public` · Follows: J15, J26, J22 · Followed by: J24

## Goal

"The city changed the notice our case rests on; we said so openly, and published a new edition beside the old one."

## Who

- Mai, the project's owner (J15), signed in on her own device at 1280 px, with her signing key registered in this browser (J15 step 19).
- Rosa, administrator and member of the project, in a second browser.
- A reader with no session, for the end state.
- No assistant: no step needs one.

## Before it starts

1. J15 has been walked on this copy: Edition 1 of the case is published, resting on Housing notice 2026-118 as captured then.
2. The address the notice was captured from now serves the amended notice in Test data (ARCH's to arrange on the development copy; index, section 5).
3. The case has no docket entry and no draft of a next edition.

## Test data

| Item | Value |
|---|---|
| The amended notice | Housing notice 2026-118 at the same address, its order reading "within 14 days" in place of "within 28 days" (made up for this journey) |
| Why adopt the newer version | "The city amended the notice; our finding must rest on what it says now." |
| What you looked at and decided | "The order now gives 14 days; the finding must be concluded again." |
| Why it no longer holds | "The notice was amended: the deadline is now 14 days." |
| Her new reading | "The city's amended notice 2026-118 orders the landlord to repair the roof of 14 Lakeshore Row within 14 days." |
| What the next edition covers | "Edition 2 follows the city's amendment of notice 2026-118." |
| What changed | "The city amended notice 2026-118: the deadline is now 14 days. Finding 1 says so." |
| Docket entry | kind Statement; answers Edition 1; rests on the new copy of the notice; from "Lakeshore Tenants"; says "The city amended notice 2026-118 after we published. Edition 2 corrects Finding 1."; goes to "Both" |
| Every other reason asked | "For the amended notice." |

## Steps

1. Mai opens the notice on `document` (from `question` C4's link) and presses A16 ("Check for a new version now").
   - 1.1 "Checked for changes just now." (`.monitor.done`).
   - 1.2 C14 lists two copies, newest first; the newer carries the chip "Changed since the version your question cites" and `document.versions.where` (design silent on whether the check alone captures the new copy: lane to confirm).
2. Mai opens `queue` with the rail.
   - 2.1 `queue` shows S1; under the case's section (C5) an item for the newer version of the notice, with A1's "Adopt the newer version" and "Keep the version you cited".
3. Mai presses "Adopt the newer version" and gives "Why adopt the newer version" from Test data.
   - 3.1 C2: "Done: {what}. It has left your queue."
4. Mai opens the question on `question`.
   - 4.1 C11 "Needs a second look" shows "A newer edition of Housing notice 2026-118 exists" (`.reeval.edition`).
   - 4.2 C4 lists the passage on the newer copy (design silent on whether C4 or `document` C15 shows the move: lane to confirm).
5. Mai fills "What you looked at and what you decided" (C11) and presses A10 ("Record that you looked again").
   - 5.1 The item reads "Looked at again by" Mai.
6. Mai opens the fold "Reopen this finding, with a reason", writes why it no longer holds, and presses its button (A15).
   - 6.1 `question` shows S1: the conclusion is gone; C14 still links "The published case's record" to `docket`.
7. Mai concludes again (C12, "Write the reading yourself") with her new reading, the same "What would change it", and a reason, and presses A11.
   - 7.1 `question` shows S8 with the new reading, "Written by" Mai.
   - 7.2 C10 shows, for the case, "Frozen when it published:" the old reading and "Today:" the new one, apart.
8. Mai opens `docket` from `question` C14 ("The published case's record").
   - 8.1 `docket` shows S2: C1 heading "Docket" and `.sub`; C2 `.none`.
   - 8.2 C7 "The next edition" lists Finding 1 under "Findings it rests on".
9. Mai fills the entry form (C3) from Test data and presses A1 ("File a docket entry").
   - 9.1 C2 lists the entry, its kind and summary, "drafted, not yet posted".
10. Mai presses A2 ("Post it") and signs with her key.
    - 10.1 Before it is done, `act.docketpost.does` shows; the button carries "You sign this" and the outward icon.
    - 10.2 After it: "Posted, signed." (`.posted.said`); the entry shows "posted".
11. Mai ticks Finding 1 in C7, fills "What the next edition covers", and presses A3 ("Start the next edition") with a reason.
    - 11.1 `case-editor` shows S1 for the new draft: C1 "{case} · Edition 2", "Draft · prepared by" Mai.
12. Mai fills "What changed" (C12) and "What this bias means for this edition" (C8) from Test data, and presses A2 ("Prepare the draft") with a reason.
    - 12.1 `.prepared` shows.
13. Rosa opens `case-editor` and presses A3 ("Acknowledge what it leaves out") with a reason.
    - 13.1 C6 shows "Acknowledged by rosa-l" for Edition 2 (design silent on whether Edition 1's acknowledgement carries over: lane to confirm).
14. Mai opens `ceremony` and walks J15 steps 21 to 23 for Edition 2.
    - 14.1 C1 reads "Publish {case}, Edition 2"; the steps end at S4 with `signing.ceremony.signednow`.
15. Mai presses "Open the public page".
    - 15.1 `published` shows S2 for Edition 2: C1 "Edition 2 · signed {date} · published {date}" with a link "Edition 1".
    - 15.2 C4 reads "One since it was published: {kind}, {date}." (`.corrections.some.one`), or S3's `.corrections.some` if the edition and the statement count apart (design silent: lane to confirm); C3's Finding 1 says 14 days.
16. Mai presses the link "its docket" in C4.
    - 16.1 `docket-public` lists the statement of step 10 and "Edition 2 published, superseding Edition 1", each dated and marked "signed".

## End state

Checked after a reload, in a browser with no session:

1. `published` for the case opens on Edition 2 (step 15); its link "Edition 1" opens Edition 1 unchanged, its Finding 1 still saying 28 days.
2. `docket-public` lists both entries of step 16.
3. Signed in as Mai: `question` shows S8 with the new reading; `queue` holds no newer-version item; `case-editor` shows S3 for Edition 2.

## Ways it can turn aside

1. Step 1, the address still serves the old notice: C14 shows "Reads the same as the {date} copy, letter for letter." (`document.versions.same`) and no queue item follows; ARCH arranges the amended notice; resume at step 1.
2. Step 1, the address is not watched: the fold "If this address isn't being watched" offers "Watch for changes" (A16); Mai presses it (`.monitorset.done`) and resumes at step 1.
3. Step 3, "Keep the version you cited" pressed instead: the item leaves; the question stays on the old copy; `document` C15 offers A14 ("Move my citations to this copy"); resume at step 4 after pressing it.
4. Step 6, no reason or a bad one: `question` V7; resume at step 6.
5. Step 9, "From whom" or "What it says" empty: `docket` V1; resume at step 9.
6. Step 10, the entry cannot be prepared for signing: V2 (`.prepare.failed`), nothing posted; resume at step 10.
7. Step 11, no finding ticked or no scope: V3 (`.next.refused.nofinding`, `.next.refused.noscope`); nothing started; resume at step 11.
8. Step 11, the question not concluded again: C7 shows "reopened by Mai: conclude it again before it can go in." (`.next.reopened`); resume at step 7.
9. The document disappears instead of changing: the design names removal (`journeys.html` 23) but no screen part for it here (design silent: lane to confirm).

## Changes

- 22 Nov 2026: written.
