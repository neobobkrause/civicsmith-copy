Length: 132 lines. Last section: "Changes".

# J29: From installing to a first conclusion

Journey page `j29-from-installing-to-a-first-conclusion` (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

Status: AI, with a no-AI path; partly not built (the account check on `install`) · Screens used: `install`, `setup`, `home`, `settings`, `security`, `projects`, `project`, `question`, `finder`, `capture`, `held`, `document`, `assistant` (AI only) · Follows: none: a fresh copy of its own · Followed by: none.

The path without the assistant is walked first (index, rule 7). Steps marked **AI** are recorded not walked until an AI account is connected; the steps marked **without the assistant** are walked in their place.

## Goal

"From installing our team's Civicsmith, I reach a first conclusion on a real question, resting on the city's own document."

## Who

1. Rosa, the founder: no Civicsmith session at the start; holds the sign-in of the development Cloudflare account. From step 5 she is the team's administrator, and from step 9 the owner of a project, acting there as a member.

## Before it starts

1. A fresh copy of its own: the development Cloudflare account holds no Civicsmith. J29 installs, as J01 and J28 do, so it is not walked on their copies, and its copy is not used by later journeys.
2. Housing notice 2026-118 is served at an address the copy can capture (ARCH says which).
3. Rosa uses a desktop browser (1280 px) with no session.
4. For the AI steps only: an AI account the team may use (the team's API key, held for the walk in the environment, never shown). Without it, the AI steps are not walked.

## Test data

| Item | Value |
|---|---|
| Short name; team's name | `lakeshore-tenants`; "Lakeshore Tenants" |
| Founder | handle `rosa-l`; a password of 12 characters or more chosen by the walking session, never reported |
| Project | "Roof repairs at 14 Lakeshore Row"; who can find it: "Hidden" |
| Question | "Has the landlord been ordered to repair the roof of 14 Lakeshore Row?"; reason "This is what the tenants need answered." |
| Search words | "roof" |
| Document | housing notice 2026-118, from its address |
| Vouch | what she checked: "The copy is the notice the city published at that address"; what remains: "None remains" |
| The passage cited | the notice's sentence ordering the roof repair (on the development copy: "The landlord must repair the roof of 14 Lakeshore Row within 28 days of this notice."), as supporting the question |
| Her reading | "Housing notice 2026-118 orders the landlord to repair the roof of 14 Lakeshore Row." |
| What would change it | "The city withdrawing or amending notice 2026-118" |
| Why she concludes | "The notice answers the question." |

## Steps

1. Rosa opens the installer, answers that she has a Cloudflare account (`install` A1), types the short name, chooses the place, and continues (A4, then A5 in S4's dialog).
   - 1.1 `install` shows S1, then S2, then S4 naming `lakeshore-tenants` as permanent, then S11.
2. `not built` Rosa checks her account (A12) before continuing.
   - 2.1 S5 or S6: each line "Ready" or "Not ready yet" with its fix; checking created nothing. Until built, recorded not walked.
3. Rosa goes on to Cloudflare (A9), allows there, and waits.
   - 3.1 `install` shows S14, each row moving from "Now" to "Done", then S18 with the one-time password, shown once.
4. Rosa copies the one-time password (A20) and follows A21.
   - 4.1 `setup` S1 opens at the team's address with the one-time password filled in.
5. Rosa claims with handle `rosa-l` and her own password (A1), and saves her ten recovery codes as a file.
   - 5.1 `setup` S2: part 1 "Done", the claimed line naming `rosa-l`; ten codes shown once.
6. Rosa names the team in part 2 (A4).
   - 6.1 "Saved. Your team is now called Lakeshore Tenants."
7. **AI** In part 5, Rosa chooses "Yes, members may use it" and "Your team, with one API key for members who have none", pastes the team's key, holds it (A12) and switches it on (A13).
   - Must be present (every run): "The team's key is held and {state}."; after a reload, the masthead's "Assistant" button on a working screen.
   - Must never be present: the key's characters on any page after A12.
   - **Without the assistant**: Rosa skips part 5 (A3); it reads "Skipped", and no "Assistant" button is drawn anywhere afterwards.
   - In the first beta the team's AI is connected on `aiproviders` (page `ai`, not built); this step follows setup as built.
8. Rosa opens her team (A19) and then Settings › "Security".
   - 8.1 `home` shows S5: nothing is here yet, with A18 to A20, C8 and C9.
   - 8.2 `security` shows S2: mark "Ordinary.", "Nothing unusual. There is nothing for you to do.", and C4's line that files are checked.
9. Rosa opens Projects, opens "Start a project" (C8), types what it is about, chooses "Hidden", and starts it (A6).
   - 9.1 `projects` shows S2: no projects yet, C8 offered; "Who can find it" has nothing chosen until she chooses.
   - 9.2 `project` opens in S2: the title, "Opened by rosa-l on {date}", the field "Your first question" and A1.
10. Rosa types the question and opens it (A1, with its reason).
    - 10.1 A1 opens the reason field (Asks for a reason) before it is sent.
    - 10.2 `question` opens in S3: the question as heading, C2's three steps, "Next: bring in a source" with "Add a document" and "Find one the team has", and `question.empty.conclude.own`; no conclude form.
11. **AI** Rosa asks the assistant to look through what the team holds ("Ask the assistant to look", S3).
    - Must be present (every run): S4: "The assistant is working on this question", progress rows, the machine-work label, `question.run.leave`, "Stop the run". She can leave the page; the run goes on.
    - If the run ends with nothing to propose: S9, "The run ended: {why}." in words, and S3's three ways offered again, the assistant among them.
    - Must never be present: any words of a proposal before Civicsmith's check; a conclusion, grade or single confidence score from the assistant; a cited passage from outside what the team holds.
    - **Without the assistant**: step 12.
12. **Without the assistant** Rosa looks for a source the team already holds ("Find one the team has"), searching "roof".
    - 12.1 `finder` opens; after "Search" (A1), S2: "Nothing your team holds matches “roof”.", with "Capture it".
    - 12.2 No assistant control is drawn on `question` or `finder`, and nothing says it is missing.
13. Rosa goes back to the question and follows "Add a document" (A2), types the notice's address and captures it (A2 on `capture`).
    - 13.1 `capture` shows S1 with S4: C2 says what she adds is filed under "Roof repairs at 14 Lakeshore Row", for the question; the question chosen in C5.
    - 13.2 After capturing, S5: "Captured: {title}. It waits in Held captures …".
14. Rosa opens Held captures from the capture's confirmation, and opens the notice ("Open it", A4).
    - 14.1 `held` S1 lists it under "Mine", with "For …'s question" naming hers.
    - 14.2 `document` opens in S2: the held banner (only she can see this copy) with A2; no "What cites it" (C18).
15. Rosa reads the notice and vouches for it there (A2), with what she checked and what remains.
    - 15.1 `document` shows S1: "Vouched for by rosa-l, {date}. Your team can use this copy." (C3).
    - 15.2 C16's record lists "Added by rosa-l" and "Vouched for by rosa-l".
16. On the page (C8), Rosa selects the passage, chooses her question in "Cite in which question" and "supports" in "How it bears on the question", and cites it (A9).
    - 16.1 The citation is made; on `question`, C4 "Supports" lists the passage, quoted, with its grade, a link to the notice at that passage, and "cited by rosa-l".
    - 16.2 The notice's `document` C18 lists the question as citing it.
17. On `question`, Rosa answers what the passage carries (S2: "No, my answer falls") and saves (A5, "Save the answers").
    - 17.1 Before saving, `question` shows S2 with no strength.
    - 17.2 After saving, S1, with C3's two grades and the standing against the bar.
    - (design silent: lane to confirm that S2 comes before concluding on a single passage.)
18. **AI** Rosa reads what the assistant proposes and accepts it ("Accept this reading", S5).
    - Must be present (every run): S5's heading, the reading quoted, the passages it rests on as links to the notice, the machine-work label, "Checked by Civicsmith before it was shown", on a test instance `ai.label.untested`, and "Legal information, not legal advice." where it says what the notice requires.
    - Must never be present: a passage not cited on the question or not in the notice; a reading marked accepted before her act; the reading drawn as a member's words.
    - After she accepts: C8 lists the reading as accepted.
    - **Without the assistant**: step 19 with "Write the reading yourself".
19. Rosa opens "Conclude" (C12), chooses the reading (the accepted one, or "Write the reading yourself" and types her reading), fills in what would change it and why she concludes, and concludes (A11).
    - 19.1 A11 carries the "Asks for a reason" mark.
    - 19.2 `question` shows S7, or S8 for her own reading: heading "Concluded", `question.concluded.by` naming `rosa-l` and the date, the falsifier; S8 adds "Written by rosa-l".
    - 19.3 S7's acts are offered: "Prepare a case from this", "Plan what to do", "Withdraw the conclusion…".

## End state

Checked after a reload, signed in as Rosa.

1. `question` shows S8 (without the assistant) or S7 (with it): concluded by `rosa-l`, the date, the reading, what would change it; C4 lists the notice's passage.
2. `project` "Roof repairs at 14 Lakeshore Row" lists the question in C7 with its grades; C5 lists the notice; C12 lists `rosa-l` as "owner since {date}".
3. `projects` lists the project; its `project` C14 ("This project's settings") shows the hidden line.
4. The notice's `document` shows S1, vouched for by `rosa-l`, and C18 names the question.
5. `members`: `rosa-l` alone, founder and administrator; `recovery` 10 of 10 unused.

## Ways it can turn aside

1. Steps 1 to 3: the short name taken (`install` V1), a stop (S15, then A11 and resume at step 1), or the account already holding a Civicsmith (S16: the copy is not fresh; stop and report).
2. Step 9, no title: V1; "Who can find it" unchosen: V2; resume at step 9.
3. Step 10, the question empty: `project` V1; no reason given: `shell.reason.needed`; resume at step 10.
4. Step 13, the address not fetchable or refused: `capture` V2 or V3 beside it, nothing filed; resume at step 13 once ARCH's address answers.
5. Step 13, the notice already held: S6, "Already in the record as {title}", with "Open it"; resume at step 14.
6. Step 15, a field empty: `document` V3; resume at step 15.
7. Step 16, no question or no role chosen: V1 beside A9, nothing cited; resume at step 16.
8. Step 19, no reason: `question` V1; resume at step 19.
9. An AI step whose run cannot start (assistant unreachable, key off, limit reached): `question` S6 or the panel's reason in words, never blank; the walk takes the step **without the assistant** and goes on.

## Where the product's walker differs

The walker (`investigation.mjs`, R9 and R16) claims on a copy J28 made, not a fresh install of its own; connects the assistant on `connect` by her own Claude subscription rather than the team's key; also uploads a tenant's note; vouches from `held` rather than the document's page; cites through `find-in` rather than by selecting words; and goes straight to "Conclude" without S2's answers.

## Changes

- 22 Nov 2026: written.
