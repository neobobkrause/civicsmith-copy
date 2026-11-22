Length: N lines. Last section: "Changes".

# J04: Connecting your own AI account

Journey page `j04-connecting-your-own-ai-account` (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

Status: AI; partly not built (the first beta's path, steps 1 to 12, is on the page `ai`, not built; the built `connect` path, steps 20 to 28, is walkable up to its AI steps) · Screens used: `aiproviders`, `aimine`, `aiconnect`, `home`, `settings`, `connect` · Follows: J28 · Followed by: J17, J32

## Goal

"I want the assistant to work for me on my own AI account, which serves only me, and I want to know what it is sent and who keeps it."

## Who

1. Mai (`mai-k`), a member, signed in. She may contribute and start projects, as J28 leaves her; she is not an administrator.
2. Rosa (`rosa-l`), the founder and administrator, signed in, for steps 1, 2 and 11 only.

## Before it starts

1. J28 has been walked on this copy: the team "Lakeshore Tenants" exists, Rosa is its administrator, Mai is a member and can sign in.
2. Mai holds no AI account of her own in Civicsmith, and no team account serves her: her masthead shows no button "Assistant" (page "Every screen", section 5).
3. For steps 5 to 10 and 23 to 27 only: Mai holds an account with an AI provider, as in Test data. Until the owner connects such accounts, those steps are recorded not walked (index, section 1, mark `AI`).

## Test data

| Item | Value |
|---|---|
| Mai's own AI account (first beta) | A pay-as-you-go API plan the catalogue on `aiproviders` lists, held in Mai's name; ARCH names the plan and holds its key, never printed |
| Mai's own key (built path) | An Anthropic API key held in Mai's name; ARCH holds it, never printed |
| Rosa's reason, step 2 | "Members may bring their own AI for their own work." |
| Mai's reason, steps 6, 7 and 9 | "My own account, for my own work." |
| Mai's daily limit, step 25 | 2 (dollars), per day |

## Steps

### The first beta's path: `aimine` and `aiconnect`

1. Rosa opens `aiproviders` by its address and opens its part 3 (C10). `not built`
   - 1.1 `aiproviders` shows C1 and its card C2 in the state the team's accounts give (S3 on a copy with no account on).
   - 1.2 C10 shows the group "Members and their own accounts" with its two checkboxes and A10.
2. Rosa checks both choices under "Members and their own accounts", presses A10 and sends it with her reason from Test data. `not built`
   - 2.1 A10 carries the weight "Asks for a reason"; pressing it opens the reason field beside it (page "Every screen", section 6).
   - 2.2 After a reload, both checkboxes stay checked.
   - 2.3 C11 lists the change first, with `rosa-l`, today's date and the level team.
3. Mai opens `aimine` by its address `/app/aimine`. `not built`
   - 3.1 `aimine` shows C1 to C7; its path is "Settings › Your AI". `settings` draws no row to it (page `ai`, Differences).
   - 3.2 C2 lists no account of Mai's own (S3 where no team account is on).
   - 3.3 C4 shows `.own.team` and `.own.personal`, and A2 is offered.
   - 3.4 C5 shows the seven checks as a member's rows, in S1 or S2 as the team left them.
4. Mai presses A2 "Add an account of my own". `not built`
   - 4.1 `aiconnect` opens with C1 and C2 naming the plan she connects. (design silent: where a member chooses the plan between `aimine` A2 and `aiconnect`; lane to confirm)
   - 4.2 `aiconnect` is in S1: C3 to C8, "Enter it here" chosen, the sign-in panel disabled with `.s3.nosignin`.
   - 4.3 C3's table has its six rows, each with an answer and a source and date, or "not stated".
   - 4.4 C3's sub-heading on the terms that bind civic use holds its three rows, each with the provider's words and source.
5. Mai opens A1, the provider's sign-up link, and there makes her account and copies its key (outside Civicsmith). `not built` **AI**
   - 5.1 A1 opens the provider's own page outside Civicsmith; A1 carries the outward icon (page "Every screen", section 1, rule 4).
   - 5.2 C4 shows `.s2.never`; nothing on `aiconnect` asks for a card or payment.
6. Mai pastes the key into the field of C5 ("Enter it here"), presses A2 "Store the key in Cloudflare" and sends it with her reason. `not built` **AI**
   - 6.1 The reason field opens beside A2; after sending, the button shows done.
   - 6.2 The key field is empty, and the key is drawn nowhere on `aiconnect`, after a reload too.
   - 6.3 (design silent: whether the password is asked again here, as it is for connecting on `connect`; lane to confirm)
7. Mai ticks the acceptance checkbox in C6, presses A8 "Record my acceptance" and sends it with her reason. `not built`
   - 7.1 The acceptance is recorded: C6 shows it with `mai-k` and today's date. (design silent: the exact line drawn once recorded; lane to confirm)
8. **AI** Mai presses A6 "Test the connection". `not built`
   - Present in any proper result (hard, every run):
     - 8.1 Step 5 of `aiconnect` shows S5: `.s5.pass` with a number of seconds.
     - 8.2 A7 can now be pressed.
   - Never present:
     - 8.3 The key, in any part of the screen.
     - 8.4 Any of the team's material named as sent (C7 `.s5.why`: the test sends none).
     - 8.5 A7 switching the account on before S5.
   - **Without the assistant:** Mai takes step 12 instead.
9. Mai chooses "First" in C8 and presses A7 "Switch it on", sending it with her reason. `not built` **AI**
   - 9.1 `aimine` opens. (design silent: A7 leads to `aiproviders`, which a member may not see; for a member's own account the design implies `aimine`; lane to confirm)
   - 9.2 `aimine` C2 lists her account first, marked "Your own account" and "On", with `.now.note`.
10. Mai opens `home` and reloads it. `not built` **AI**
    - 10.1 The masthead shows the button "Assistant" (page "Every screen", section 3.3, item 5).
    - 10.2 `aimine` C6, opened again, lists one row for her account.
11. Rosa opens `aimine`, then `aiproviders`. `not built`
    - 11.1 Rosa's `aimine` C2 does not list Mai's account.
    - 11.2 `aiproviders` C3 does not list Mai's account, and C8's costs name no member (`.bud.note`). (design silent: whether a member's own account appears on `aiproviders`; lane to confirm)
12. **Without the assistant.** At step 4 Mai presses nothing, and opens `home`.
    - 12.1 The masthead shows no button "Assistant", and no dock is drawn beside any screen; nothing greyed stands in their place.
    - 12.2 No row on `home` and no item in `queue` mentions connecting an AI, then or later.
    - 12.3 `aimine`, opened again, is as at step 3.

### The built path: `connect`

20. Mai opens `settings` and its link "The assistant" (A1).
    - 20.1 `connect` shows C1 and state S8, drawn as S5: `.none`, the part "Before you connect" with the outward mark, `.disclosure.own`, `.disclosure.then` and A1.
    - 20.2 The ways to connect are not shown yet.
    - 20.3 C3, the fold "Which account pays, and when", is at the foot.
21. Mai presses A1 "I have read this".
    - 21.1 The part reads as read; the radios "How do you want to connect the assistant?" show, none chosen.
    - 21.2 A reload keeps the part read.
22. Mai chooses "My own Claude API key".
    - 22.1 The field "Your API key" and A6 show.
23. **AI** Mai pastes her own key and presses A6 "Connect with this key".
    - 23.1 The dialog "Enter your password again" opens, its focus in "Your password" (page "Every screen", section 4).
24. **AI** Mai types her password and presses "Go on" (A5).
    - Present in any proper result (hard, every run):
      - 24.1 `connect` shows S2: `.own.apikey`, the mark "Connected" and "Connected since {date}." with today's date.
      - 24.2 S2's parts show: "What the assistant may do for you", "A limit, if you want one", "Your use", "Disconnect".
      - 24.3 The masthead shows the button "Assistant".
    - Never present:
      - 24.4 The key, on `connect` or anywhere else.
      - 24.5 A switch in the group "Without being asked" turned on that Mai did not turn on.
    - **Without the assistant:** Mai takes step 28 instead.
25. **AI** In "A limit, if you want one", Mai sets her limit from Test data, "Per" "day", and presses the limit button (A8).
    - 25.1 The limit is listed in that part, after a reload too.
26. **AI** In "What the assistant may do for you", Mai turns one switch of "Everyday help" off (A7).
    - 26.1 That switch shows off after a reload; the others are as they were.
27. **AI** In "Disconnect", Mai presses A9 "Disconnect your API key".
    - 27.1 `connect` shows S5 again (S1 where the team's key is on).
    - 27.2 The masthead shows no button "Assistant" (where no team key serves her).
28. **Without the assistant.** At step 22 Mai chooses "Not now".
    - 28.1 `connect` shows `.skip`; no field and no connect button show.
    - 28.2 The masthead shows no button "Assistant"; nothing on `home` or in `queue` reminds her.

## End state

Checked after a reload.

1. First beta (steps 1 to 10): `aimine`, as Mai, lists her own account first, "Your own account", "On"; her masthead shows "Assistant".
2. Rosa's `aimine` does not list Mai's account; no screen draws Mai's key to anyone.
3. `aiproviders` C10 shows both choices under "Members and their own accounts" checked, and C11 holds Rosa's change.
4. Built path, after step 26: `connect` as Mai shows S2 with her limit listed and the switch she turned off shown off. After step 27, S5 (or S1).
5. Without the assistant (step 12 or 28): `connect` or `aimine` as Mai shows no account of hers; no masthead button "Assistant"; nothing reminds her.

## Ways it can turn aside

1. **Own accounts not allowed.** If step 2 is not taken, `aimine` is in S4: C4 lacks `.own.team` and A2 is not drawn. Mai takes step 12; the journey ends.
2. **The test fails** (step 8). Step 5 shows S6: the provider's words quoted and who can fix it; A7 cannot switch it on. Resume at step 6 with a key that works.
3. **A free tier that trains on what it is sent.** `aiconnect` is in S3: step 4 shows "Warning." and `.s4.warn`, and a second checkbox `.s4.freebox`. Resume at step 7, ticking both.
4. **A personal subscription instead of an API plan.** `aiconnect` is in S4: only C1 and "Your own subscription", with the provider's restrictions and their sources, the checkbox `.p.box` and A9 "Use my subscription". After A9, `aimine` C2 lists it as "Your own account". Where a check the team or a project requires fails, `screen.aichecks.personalfails` shows and it is not used for that work.
5. **The page `ai` not built.** `/app/aimine` and `/app/aiconnect/…` draw `unavailable` S1. Steps 1 to 11 are recorded not built; the journey resumes at step 20.
6. **Empty key** (step 23). Beside A6: V2 "Paste your API key first. Nothing was sent." Resume at step 23.
7. **The key refused** (step 24). Beside A6: V3, the row `.refused.<CODE>` for the code with a reference; the field is kept. Resume at step 23.
8. **Wrong password** (step 24). The dialog stays with `session.reauth.wrong`; nothing was sent. Resume at step 24; "Cancel" sends nothing and keeps the key typed.
9. **Material kept away from AI.** If an administrator keeps the team's material away from AI, `connect` is in S6: `.keptaway` with the reason and `.keptaway.ask`, no part and no act. The journey ends there.
10. **Sign-in state unreadable.** `connect` is in S7, `.signin.statefailed`; it is never drawn as not connected. Reload and resume at step 20.
11. **Subscription on the built path.** Choosing "My Claude subscription (Pro or Max)" shows the four steps, "Open Anthropic's sign-in page" (A3, a new tab) and the field "The code from Anthropic's page" with A4. Empty code: V1. A code accepted: S3. Shown only while the sign-in part is installed (S8).

## Changes

- 22 Nov 2026: written.
