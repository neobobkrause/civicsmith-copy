Length: N lines. Last section: "Changes".

# J15: From a question to a published case

Journey page `j15-from-a-question-to-a-published-case` (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

Status: walkable (steps marked `waiting A1`, `A4` to `A8`) · Screens used: `capture`, `held`, `projects`, `project`, `question`, `finder`, `document`, `case-editor`, `queue`, `ceremony`, `published` · Follows: J28 · Followed by: J21 (walked between steps 17 and 18), J26, J22, J23, J24

## Goal

"I brought in the city's notice, answered our question from it, and our team's case is signed and public."

## Who

- Mai, a member who may start projects (J28), signed in on her own device at 1280 px. She captures, opens the project and the question, concludes, prepares the case and, as the project's owner, signs it.
- Rosa, the team's founder and administrator, signed in in a second browser. She joins the project and acknowledges what the case leaves out (a member other than its writer).
- No assistant: the walk has no AI account, and no step of this journey needs one. The ceremony has no assistant part (`ceremony`).

## Before it starts

1. J28 has been walked on this copy: team "Lakeshore Tenants" (`lakeshore-tenants`), Rosa (`rosa-l`) its administrator, Mai a member allowed to start projects.
2. The copy can capture Housing notice 2026-118 from an address; which address serves it is ARCH's to say (index, section 5). Its text holds the sentence in Test data ("The passage").
3. The team's time zone is set (`review-copy` S4 and `ceremony` S9 depend on it); if not, see turn-aside 6.
4. No project titled as in Test data exists; neither browser holds a signing key for Mai.

## Test data

| Item | Value |
|---|---|
| The notice's address | ARCH's address serving Housing notice 2026-118 |
| The passage | "The landlord must repair the roof of 14 Lakeshore Row within 28 days of this notice." (the product walker's fixture) |
| Vouch: what you vouch for / what you did to check | "The copy is the notice the city published at that address" / "Compared it with the city's page" |
| Project title; who can find it | "Roof repairs at 14 Lakeshore Row" (the product walker's); Hidden |
| Reason to open the project | "Tenants of 14 Lakeshore Row report water coming in." |
| The question | "Has the landlord been ordered to repair the roof of 14 Lakeshore Row?"; reason "This is what the tenants need answered." |
| Search words | "repair the roof" |
| Her reading | "The city's notice 2026-118 orders the landlord to repair the roof of 14 Lakeshore Row within 28 days." |
| What would change it; why concluding | "The city withdrawing or amending notice 2026-118"; "The notice answers the question." |
| Scope | "Whether the city has ordered the repair of the roof of 14 Lakeshore Row" |
| What it does not cover; why | "Whether the landlord has made the repair"; "The record holds no document on the repair itself." |
| Position; why | "We chose not to give notice"; "The case rests only on the city's own public notice." |
| What the bias means for this edition | "Our team speaks for tenants; this edition rests on the city's own words only." |
| The account | "Tenants reported water through the ceilings; the city inspected and ordered the repair in notice 2026-118." |
| Every other reason asked | "For the case on the roof." |

## Steps

1. Mai opens `capture` with the rail's "Add". `waiting A5`
   - 1.1 `capture` shows S1: C1, the tabs (A1) with "From an address" current, C5's field "Address" empty.
2. Mai types the notice's address in C5 and presses A2.
   - 2.1 `capture` shows S5: `.address.done` naming the notice's title and saying it waits in Held captures.
3. Mai opens `held`.
   - 3.1 `held` shows S1 with "Mine" chosen in C2; one row (C3) for the notice, marked "No project yet".
4. Mai ticks that row, fills the two vouch fields (C10) from Test data, and presses A5.
   - 4.1 `held` shows S4 with a count of 1; the row has left the list.
5. Mai opens `projects` with the rail, opens the fold C8, types the project title, chooses Hidden, and presses A6.
   - 5.1 `project` shows S2 for the new project: heading 1 the title, `.opened` naming Mai and today.
   - 5.2 C12 lists Mai, marked owner since today.
6. Mai presses A9 on `project` and gives the handle `rosa-l`.
   - 6.1 C12 lists "rosa-l (invited)".
7. Rosa, in her browser, opens `projects` and presses A3 on the row in C4 (Invited).
   - 7.1 The project leaves C4 and is listed in the table (C3); its name (A2) opens `project` for Rosa.
8. Mai types the question in "Your first question" on `project` S2 and presses A1 with its reason. `waiting A1`
   - 8.1 `question` shows S3: heading 1 the question's words, C2's three steps, the section "Next: bring in a source".
   - 8.2 No "Ask the assistant to look" row is drawn (S13).
9. Mai presses A3 ("Find another source") on `question`, types the search words in C2 of `finder`, and presses A1.
   - 9.1 `finder` shows S1; a result (C3) is the notice, its passage showing the words around "repair the roof".
10. Mai opens the notice's title (A2).
    - 10.1 `document` shows S1: C1 the notice's title and "captured by Mai…"; C3 `document.vouched` naming Mai.
11. Mai selects the passage's words in C8, chooses the question in "Cite in which question", chooses "Supports" in "How it bears on the question", and presses A9. `waiting A7` `waiting A8`
    - 11.1 The citation is made; reopening `question` shows the passage in C4 (Supports) with a link to `document`.
    - 11.2 `question` shows S2: no strength, one passage under "What each passage carries".
12. Mai answers the passage with "No, my answer falls" and presses "Save the answers" (A5).
    - 12.1 `question` shows S1: C3 shows two grades and the standing against the bar.
13. Mai opens the fold "Conclude" (C12), chooses "Write the reading yourself", fills "Your reading", "What would change it" and "Why you are concluding it" from Test data, and presses A11.
    - 13.1 `question` shows S8: heading 2 "Concluded", `question.concluded.by` with her reading and "Written by" Mai, and `question.concluded.falsifier`.
    - 13.2 A15's "Prepare a case from this" is offered.
14. Mai presses "Prepare a case from this".
    - 14.1 `case-editor` shows S2: heading "{project}: draft case", sub-line "Not yet drafted"; the section "Concluded questions, each with its findings" lists the question.
15. Mai types the Scope and presses A2 ("Prepare the draft") with a reason.
    - 15.1 `.prepared` shows; then `case-editor` shows S1: C1 "{case} · Edition 1" and "Draft · prepared by" Mai; the path strip at "Working".
    - 15.2 C5 lists "Finding 1: its role in the case".
16. Mai sets Finding 1 to "Relied on" (C5), fills "What the case does not cover" and one left-out item with its why (C6), chooses the position and its why (C7), fills "What this bias means for this edition" (C8) and "The account" (C11), and presses A2 with a reason.
    - 16.1 `.prepared` shows; after a reload each value she typed is shown back in its field.
    - 16.2 No form message V1 to V9 is drawn.
17. Rosa opens `case-editor` from `project` C11 ("The case being prepared") and presses A3 with a reason.
    - 17.1 C6 shows "Acknowledged by rosa-l".
18. Mai opens `ceremony` from `project` C11 ("Publishing").
    - 18.1 `ceremony` shows S5: `signing.ceremony.nokey` and A9 "Register a signing key in this browser".
19. Mai presses A9 and confirms on her device.
    - 19.1 `ceremony` shows S1 with "Your signing key is registered. Sign again when you are ready."
    - 19.2 C1 heading "Publish {case}, Edition 1" with `.permanent`; C2 lists the ten steps with "Ties" marked.
20. Rosa opens `queue`. `waiting A6`
    - 20.1 `queue` shows S3: the section "Your team" with `queue.signer-self-registered.detail` naming Mai, and "I know about this key" (A13).
    - 20.2 Rosa presses "I know about this key"; the item leaves her queue (C2).
21. Mai presses A1 ("Check again") on `ceremony`.
    - 21.1 C4 lists Finding 1 and its strength, then "Every check against the bar holds." (`.ready`).
    - 21.2 C8 lists no photo. `waiting A4`
    - 21.3 Where C7 lists the notice as having no second confirmation, Mai ticks "Publish … as self-attested only" with the reason from Test data; C7 then shows it so (design silent: lane to confirm whether a copy captured on a development copy is confirmed).
22. Mai ticks the confirmation in C9 and presses A6 ("Confirm your ties and prepare the edition for signing").
    - 22.1 Before the press the button shows "Irreversible" and the outward icon; `.ties.confirm` and `.permanent` show.
    - 22.2 After it: "Edition 1 is prepared for signing. Nothing is published yet." (`.prepared`).
23. Mai chooses "Now" in C12's "When it becomes public", reads C12, and presses A8 ("Sign and publish now"). `waiting A5`
    - 23.1 Before the press C12 shows `signing.ceremony.who` naming Mai, `.signs.count` and `.device.next`.
    - 23.2 The dialog "Enter your password again" opens; after her password and "Go on", S2 shows (the device's confirmation).
    - 23.3 After she confirms on her device: S4, `signing.ceremony.signednow` and the link "Open the public page".
24. Mai presses "Open the public page" and notes its address for J26.
    - 24.1 `published` shows S1 in the published frame (no rail): C1 the case's title and "Edition 1 · signed {date} · published {date}"; C2 "This case is the work of Lakeshore Tenants."
    - 24.2 C3 lists Finding 1, "Relied on" with its strength; C4 "None since it was published."; C7 holds the left-out statement and "Who else read this statement" naming Rosa.

## End state

Checked after a reload:

1. `published` at the address from step 24 opens in a fresh browser with no session and shows Edition 1 as in 24.1 and 24.2.
2. `case-editor` for the project shows S3: "Published: Edition 1, {date}, signed by" Mai, and the link "Read Edition 1 as published".
3. `question` shows S8 with Mai's reading; its fold C9 lists the published case under "What relies on this".
4. `project` C12 lists Mai (owner) and Rosa; `held` shows no row for the notice.
5. Rosa's `queue` holds no item about Mai's key.

## Ways it can turn aside

1. Step 2, the address is refused or does not answer: one of `capture` V2 or V3 beside "Address", and nothing is captured; ARCH checks the address; resume at step 2.
2. Step 2, the notice is already held (a rerun on the same copy): `capture` S6 with "Open it"; resume at step 3 if it is still held, else at step 5.
3. Step 4, a vouch field empty: `held` V2 beside the act; nothing vouched; resume at step 4.
4. Step 13, no reason: `question` V1; resume at step 13.
5. Step 16, a field missing or over 2,000 characters: `case-editor` V1 to V9 under its "When …" disclosure, "Nothing was recorded."; the typed values stay; resume at step 16.
6. Step 23, the team's time zone not set: `ceremony` S9, only "Sign and publish now" offered; the journey goes on (it signs now). On `review-copy` (J21) the same lack shows S4; Rosa sets the zone under Settings, then resume.
7. Step 21, a check fails: `ceremony` S8 with "Fix these before you sign" and the reason; Mai puts it right on `case-editor` (step 16) and resumes at step 21.
8. Step 23, a wrong password: `session.reauth.wrong`, nothing sent; resume at step 23. She cancels on her device: S2's `.device.cancel` holds, back at the last step with nothing signed; resume at step 23.
9. Step 18 on a phone (390 px): `ceremony` S6 (`signing.ceremony.phone`), no signing button; resume on a computer at step 18.
10. Rosa opens `ceremony` instead of Mai: S7 (`signing.ceremony.notowner` naming Mai); "Ask an owner to sign" puts `.asked`, and Mai's queue gets the item; resume at step 18 as Mai.

## Changes

- 22 Nov 2026: written.
