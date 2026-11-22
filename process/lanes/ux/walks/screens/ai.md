Length: 324 lines. Last section: "Changes".

# Screens: The team's AI and yours

Page `ai` of the Screens document (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

The first beta's AI screens: the team's AI accounts and their order, connecting one, each member's own AI, a project's narrowing, what the assistant panel shows when the AI can't go on, testing an AI that isn't listed, and the results other teams sent. The alpha ships without the assistant; these seven are designed for the first beta beside the alpha's `connect`, `teamai` and `projectai`, which stay as they are (page team-and-account and page projects-and-questions).

**Every screen on this page is `not built`.** No code draws any of them; until a module builds one, its address draws `unavailable` in its state for an address that leads nowhere (page "Every screen"). Every act on this page is owed to the first-beta ruling; the design below is complete so a module can build to it. A walk records a difference here as a flaw only once a module's requirement names the screen as met.

What binds every screen is on the page "Every screen". Words below are the design's (`words.json`); placeholders in braces are filled with the record's data, and the provider names, plans, prices and dates the mockups show are sample data, not words. A button's weight mark (page "Every screen") is given where it is not Reversible: "Asks for a reason" (`weight.reasoned.name`) or "Ends something" (`weight.terminal.name`).

## The screens on this page

| id | heading | address | built? |
|---|---|---|---|
| `aiproviders` | "AI providers" | `/app/aiproviders` | `not built` |
| `aiconnect` | "Connect an AI" | `/app/aiconnect/<the chosen plan>` | `not built` |
| `aimine` | "Your AI" | `/app/aimine` | `not built` |
| `aiproject` | "AI for this project" | `/app/aiproject/<project id>` | `not built` |
| `aimoments` | "When the AI can't go on" | in the assistant panel; the list of moments at `/app/aimoments` | `not built` |
| `aitest` | "Test an AI that isn't listed" | `/app/aitest` | `not built` |
| `airesults` | "Results other teams sent" | `/app/airesults` | `not built` |

## Words shared by these screens

- **The seven checks**, each a name and a line, in this order: "Does not train on your material" / "The provider's terms say it does not use what it is sent to train its models." (`screen.aichecks.notrain.name`, `.line`); "No person reads it by default" / "People at the provider do not read what is sent unless your team asks them to." (`screen.aichecks.noread.*`); "Says how long it keeps material" / "It states how long it keeps what it is sent, and keeps none where it offers that." (`screen.aichecks.keeps.*`); "Says where it runs and under which country's law" / "It names the country where it handles what it is sent and the law that applies there." (`screen.aichecks.where.*`); "Shares it only with companies it names" / "Any other company it shares material with is named in its terms." (`screen.aichecks.onward.*`); "Works with keeping material away from AI" / "It honors your team's and projects' limits on which material may go to AI, and shows the notice that says so." (`screen.aichecks.keepaway.*`); "Not made by an organization based in China" / "The organization that makes the AI is not based in China." (`screen.aichecks.origin.*`).
- **Two checks shown, never required**: "Its terms allow this use" / "The provider's terms permit work like your team's." (`screen.aichecks.terms.*`); "Says what it does if material leaks" / "It states what it will do, and how soon, if material it holds is exposed." (`screen.aichecks.breach.*`).
- **A check's row, by who reads it.** An administrator: checkbox "Required for the whole team" (`screen.aichecks.required`); checked, "Locked by the team. Project owners and members can't change it." (`screen.aichecks.locked`); unchecked, "Not required by the team." (`screen.aichecks.open`). A member or project owner, where the team requires it: "Required by the team" (`screen.aichecks.byteam`) with "The team's administrators require this. You can't change it." (`screen.aichecks.byteam.help`), no checkbox; where it does not: checkbox "Require this for my own work" (`screen.aichecks.mytick`) or, on a project, "Require this for this project" (`screen.aichecks.projtick`).
- **The six parts of the assistant's work**: "Asking" (`screen.aiparts.ask`), "Drafting letters" (`.letters`), "Reading inside documents" (`.read`), "Reading unclear pages" (`.unclear`), "Working through checks and plans" (`.plans`), "Drafting a case's account" (`.account`).
- **A plan's results**: "Passed: {parts}." (`screen.aiplan.passed`), "Passed with limits: {parts}." (`screen.aiplan.limits`), "Not suitable: {parts}." (`screen.aiplan.notsuited`).
- **Grades**: "Reproduced" (`screen.aiplan.grade.reproduced`), "Reported" (`.grade.reported`), "Stated" (`.grade.stated`).
- **On and off**: "On" (`screen.aiproviders.status.on`), "Off" (`screen.aiproviders.status.off`).

---

## aiproviders: "AI providers"

Mark: `not built`.

- **Address.** `/app/aiproviders`.
- **Frame.** Working. Rail place Settings; path "Settings › AI providers".
- **Who can see it.** Administrators. Anyone else: `unavailable`, in its state for something the member may not see.
- **Purpose.** The team's AI: the accounts in use in order, limits and alerts, the seven privacy and origin checks, what members may use, and the catalogue of providers and their plans (`screen.aiproviders.purpose`).
- **Entry points.** `settings` (the design draws no row for it there yet: see Differences); back from `aiconnect`, `aitest`, `airesults` by their paths; direct address.

**Content**
- C1. Heading "AI providers" (`screen.aiproviders.title`); "Only administrators set this up. Members choose among what is allowed here." (`screen.aiproviders.intro`).
- C2. The card: "{n} accounts are on, in order: {order}." (`.stands.on`) with "On"; a meter "This month, all accounts" (`.stands.meter`), spent against the overall limit; and "{provider} is slow right now. The other accounts are available." (`.stands.slow`) or "All accounts are available." (`.stands.allok`).
- C3. Section "In use, in order" (`.use.head`): one row per account, numbered in the team's order: the account as provider · plan · type; "Sends {sent} to {where}. Keeps it {keep}." (`.use.line`); where listed, a listing word "watch" (`.listed.watch`), "lapsed" (`.listed.lapsed`) or "retired" (`.listed.retired`) with its reason; "On" or "Off" and a health word "available" (`.health.available`), "slow" (`.health.slow`) or "down" (`.health.down`). Then "Work goes to the first account that is on, is allowed for that work and is within its limit. When it continues on a later account, the member is shown the switch and may decline it. A use that is switched off is refused, and is never moved to another account." (`.use.note`).
- C4. A fold "Add an AI" (`.add.head`), closed on opening: explanation `.add.intro` (2 sentences: providers alphabetically, each with its ways to pay); "Each answer carries its grade. Reproduced: Civicsmith or another team repeated it. Reported: a team reported it. Stated: only the provider says so." (`.add.grades`); then each provider as a sub-heading, alphabetical, and under it each plan as its own fold named provider · plan · type.
- C5. Inside a plan's fold: "Serves {who}." (`screen.aiplan.serves`), `{who}` one of "one person" (`.who.one`), "a team" (`.who.team`), "an application" (`.who.app`), "unconfirmed" (`.unconfirmed`); "Price: {basis}. Typical work: {estimate}." (`screen.aiplan.price`); for a free tier that trains, "Warning." (`screen.aiplan.warn.chip`) "Free tier: it reads your material for training." (`screen.aiplan.warn`); a table with headers "Check" (`.th.check`), "Answer" (`.th.answer`), "Source and date" (`.th.source`), one row per check (seven, then the two shown), each answer "Met" (`.met`), "Not met" (`.notmet`) or "Unconfirmed", each source a document, section and date, or "not stated" (`.nosrc`); the grade and "Last confirmed {date}." (`.confirmed`); where the terms will change, "Its terms change on {date}: {what}." (`.pending`); the three result lines.
- C6. In C4, section "Not offered" (`.refused.head`): a plan barred for teams, "Not offered as the team's account: its terms bar use by a team for work like this. A member may still use it for their own work." (`.refused.personal`); and, while the origin check is required, "Not offered while the team requires the check “Not made by an organization based in China”." (`.refused.origin`).
- C7. In C4, section "Held until confirmed" (`.held.head`): "Held until it says where it runs and which country's law applies. It is offered once the provider says so." (`.held.region`).
- C8. Part 1 "Limits and alerts" (`.bud.head`), "{limit} a month overall; {spent} spent so far." (`.bud.why`): a table "Account" (`.bud.th.acc`), "Monthly limit" (`.bud.th.bud`), "Spent this month" (`.bud.th.spent`), with a total row "All accounts together" (`.bud.all`); a meter per account near its limit; choice "Set a limit for" (`.bud.for`) of "All accounts together" and each account; field "Monthly limit" (`.bud.amount`); choice "Tell administrators at" (`.bud.alert`) of 50%, 80%, 100%; a table "Cost this month, by project" (`.bud.th.proj`), "Cost" (`.bud.th.cost`), with a row "Work in the record, outside any project" (`.bud.norecord`); "Each cost sums everyone's use and names no member. A member sees their own cost on Your AI." (`.bud.note`).
- C9. Part 2 "Privacy and origin checks" (`.chk.head`), "Seven checks, all required to start with." (`.chk.why`): the seven checks as an administrator's rows; sub-heading "Shown for every AI, never required" (`.chk.extra`) and the two shown; "An AI that fails a required check is not offered. A check you leave unchecked, project owners and members may require for their own work." (`.chk.note`).
- C10. Part 3 "What members may use" (`.mem.head`), "Members can pick only from what you check here." (`.mem.why`): checkboxes "Providers, plans and models" (`.mem.legend`), one per account, each "Models: {models}" (`.mem.models`); "Model choices are listed exactly as each provider offers them. Members choose among the ones you check." (`.mem.modelnote`); checkboxes "Members and their own accounts" (`.mem.own`): "Members may add their own accounts" (`.mem.ownacc`), "Members may use a personal subscription, for their own work only" (`.mem.personal`).
- C11. Part 4 "Changes" (`.chg.head`), "Every change, newest first, with who made it, when, and at which level." (`.chg.why`): a list, each "{who} {what} · {date} · {level}" (`.chg.row`), `{level}` team, project or member.

**States**
| State | When | What shows (exact) |
|---|---|---|
| S1 Some on, one slow | Accounts on, one answering slowly | C2 "{n} accounts are on…" with "On", the meter, "{provider} is slow right now…"; that account's health "slow" |
| S2 All available | Accounts on, none slow or down | C2 with "All accounts are available." |
| S3 None on | No account on (the internal walk, with no AI account) | C2 "No account is on yet. The assistant is off for everyone until an administrator switches one on." (`.stands.none`) with "Off"; no meter, no health line; C3 lists any account added but off |
| S4 Before a second is added | One provider's plan not yet connected | As S2 with the accounts in use less that one; the plan shows in C4 with "Connect" |
| S5 Checks as they start | No administrator has changed the checks | C9: all seven checked, each with "Locked by the team…" |
| S6 Two left unchecked | An administrator unchecked two | C9: those two unchecked, each "Not required by the team." |

**Actions**
| Control | When offered | Where it leads |
|---|---|---|
| A1. button "Connect" (`screen.aiplan.connect`) in a listed plan's fold | C4 open | `aiconnect` for that plan |
| A2. button "Test it first" (`screen.aiplan.testfirst`) in the custom endpoint's fold | C4 open | `aitest` |
| A3. button "Test an AI that isn't listed" (`.add.test`) | C4 open | `aitest` |
| A4. button "Results other teams sent" (`.add.results`) | C4 open | `airesults` |
| A5. buttons "Move up" (`.use.up`), "Move down" (`.use.down`) | On a row not first / not last | Same screen; the account changes place; C11 gains a line |
| A6. button "Switch off" (`.use.switchoff`) or "Switch on" (`.use.switchon`); "Asks for a reason" | On each row | Same screen; "Off"/"On" changes; C2 changes |
| A7. button "Remove" (`.use.remove`); "Ends something" | On each row | Same screen; the row leaves C3 |
| A8. button "Set the limit and the alert" (`.bud.set`); "Asks for a reason" | Always | Same screen; C8's table changes |
| A9. button "Save the checks" (`.chk.save`); "Asks for a reason" | Always | Same screen; C9 as saved; an AI failing a required check leaves C4 for C6 |
| A10. button "Save what members may use" (`.mem.save`); "Asks for a reason" | Always | Same screen; `aimine` offers only what is checked |

No form messages are designed for this screen.

---

## aiconnect: "Connect an AI"

Mark: `not built`. The test of step 5 needs a provider account: `AI`.

- **Address.** `/app/aiconnect/<the chosen plan>`.
- **Frame.** Working. Path "Settings › AI providers › Connect an AI".
- **Who can see it.** Administrators, for an account of the team's; every member, for their own account or personal subscription where the team allows it (state S4). Anyone else: `unavailable`, something they may not see.
- **Purpose.** One plan, connected step by step: what it is sent and which terms bind your use, signing up, giving the key, what you accept, a test, and turning it on (`screen.aiconnect.purpose`).
- **Entry points.** `aiproviders` A1; `aimine` "Add an account of my own".

**Content**
- C1. Heading "Connect an AI" (`screen.aiconnect.title`); "Six steps for one account. Nothing is switched on until its test passes." (`.intro`).
- C2. "Connecting: {account}" (`.what`).
- C3. Step 1 "What you are connecting" (`.s1.head`), "What it is sent, who keeps it and for how long, and the terms that bind your use." (`.s1.why`): a table with headers "The answer" (`.th.answer`) and "Source and date" (`.th.source`), rows "What it is sent" (`.t.sent`), "Who receives it, and where it runs" (`.t.who`), "How long it keeps material" (`.t.keeps`), "Whether a person reads it" (`.t.reads`), "Whether it trains on it" (`.t.trains`), "Whom it shares it with" (`.t.passes`); sub-heading "The terms that bind civic use" (`.terms.head`) with "Political content" (`.terms.political`), "Legal advice" (`.terms.legal`), "Saying that AI was used" (`.terms.disclose`), each with the provider's words and source; "Each answer shows where it was read and when. An answer the provider does not state says “not stated”." (`.s1.note`).
- C4. Step 2 "Sign up with the provider" (`.s2.head`), "Done on the provider's own page, not here." (`.s2.why`): "Where to sign up" (`.s2.where`) with an outward link "Open {provider}'s sign-up page" (`.s2.link`); "What to choose there" (`.s2.choose`); "What to copy or approve" (`.s2.copy`); "Civicsmith never signs anyone up and never handles payment. The provider bills your team directly." (`.s2.never`); a fold "If this plan needs a program on a member's own computer" (`.s2.prog`) with three numbered steps (`.s2.prog.1` to `.3`).
- C5. Step 3 "Give Civicsmith the key" (`.s3.head`), "Four ways. Choose one." (`.s3.why`): a choice "Where the key is kept" (`.s3.legend`) of four, each with its help: "Enter it here" (`.s3.here`) / "The key goes straight to a protected store in your team's own Cloudflare account. Civicsmith keeps no copy, and the key is never shown again." (`.s3.here.help`); "Enter it yourself in Cloudflare" (`.s3.cf`) / "For a team that wants the key never to touch Civicsmith." (`.s3.cf.help`); "Sign in with {provider}" (`.s3.signin`) / "Only for a plan whose provider signs in instead of giving a key." (`.s3.signin.help`); "Point to a key kept elsewhere" (`.s3.ref`) / "The key stays where it is kept. Civicsmith holds only where to find it." (`.s3.ref.help`). Under it, four panels, those not fitting the plan disabled: field "The key" (`.s3.keyfield`), help "It goes to Cloudflare as you press the button, and is never shown again, to you or to anyone." (`.s3.keyhelp`); a fold "Ten steps in Cloudflare" (`.s3.cfsteps`) with ten numbered steps (`screen.aiconnect.cf.1` to `.cf.10`, the dashboard's own labels quoted, the gateway named civicsmith-ai and the alias civicsmith-{alias}) and link "Open Cloudflare's dashboard" (`.s3.opencf`); the sign-in panel, with "You sign in on {provider}'s own page. Civicsmith never sees your password." (`.s3.signinnote`) or, for a key plan, "{provider} gives a key for this plan. It does not sign in." (`.s3.nosignin`); field "Where the key is kept (its name or address)" (`.s3.reffield`).
- C6. Step 4 "Before you switch it on" (`.s4.head`), "What you accept, recorded once." (`.s4.why`): checkboxes "Your acceptance" (`.s4.legend`) with "I accept the terms above that bind our use of this plan." (`.s4.termsbox`); "Your acceptance is recorded with your name and the date. The terms are accepted once for this account, and shown again if they change." (`.s4.recorded`).
- C7. Step 5 "Test it" (`.s5.head`), "A harmless test that sends none of your team's material." (`.s5.why`); a fold "If the test fails" (`.s5.failhead`); "It stays off until the test passes." (`.s5.note`).
- C8. Step 6 "Switch it on" (`.s6.head`), "Choose where it comes in the order of accounts." (`.s6.why`): choice "Where it goes in the order" (`.s6.pos`) of "First", "Second", "Third", "Last" (`.s6.first` … `.s6.last`); "You can change its place later on AI providers." (`.s6.note`).

**States**
| State | When | What shows (exact) |
|---|---|---|
| S1 A plan that gives a key | The plan's provider gives a key | C1 to C8; "Enter it here" chosen; the sign-in panel disabled with "{provider} gives a key for this plan. It does not sign in." |
| S2 A plan whose provider signs in | The provider signs in | As S1 but "Sign in with {provider}" chosen; the key panels disabled; "You sign in on {provider}'s own page. Civicsmith never sees your password." |
| S3 A free tier that reads material for training | The plan reads or trains on what it is sent | As S1, and in step 4 first "Warning." "On the free tier, {provider} reads what is sent and uses it to train its models. Do not send anything your team wants kept private." (`.s4.warn`), and a second checkbox "I understand that {provider} reads our material and uses it for training on this free tier, and I accept that for this account." (`.s4.freebox`) |
| S4 A member's own subscription | A member connects a personal plan | C1 then only section "Your own subscription" (`.p.head`): sub-heading "What {provider} says about using it" (`.p.restr`) with the provider's restrictions and sources; "If {provider} changes these restrictions, you are shown them again before your next use." (`.p.again`); checkbox "Your choice" (`.p.legend`): "I will use my own subscription for my own work, within these restrictions." (`.p.box`); "Your choice is recorded with your name and the date. Nothing more is asked of you." (`.p.recorded`); "Where the team or a project requires a check that your subscription's AI fails, it is not used for that work, and you are told why." (`screen.aichecks.personalfails`) |
| S5 Test passed | After A6 succeeds | In step 5: "Passed in {seconds} seconds." (`.s5.pass`); A7 can be pressed |
| S6 Test failed | After A6 fails | In step 5: "{provider} did not accept the test. It said: “{words}”. {who} can fix this." (`.s5.fail`); A7 cannot switch it on |

**Actions**
| Control | When offered | Where it leads |
|---|---|---|
| A1. link "Open {provider}'s sign-up page" (`.s2.link`) | S1 to S3 | The provider's own page, outside Civicsmith |
| A2. button "Store the key in Cloudflare" (`.s3.store`); "Asks for a reason" | "Enter it here" | Same screen; the field empties; the key is never shown again |
| A3. button "I've entered it" (`.s3.entered`); "Asks for a reason"; and link "Open Cloudflare's dashboard" (`.s3.opencf`) | "Enter it yourself in Cloudflare" | Same screen, the key recorded as entered; the link opens Cloudflare's dashboard outside Civicsmith |
| A4. button "Sign in with {provider}" (`.s3.signin`); "Asks for a reason" | A sign-in plan | The provider's sign-in page, then back here |
| A5. button "Use this reference" (`.s3.refgo`); "Asks for a reason" | "Point to a key kept elsewhere" | Same screen, the reference recorded |
| A6. button "Test the connection" (`.s5.go`), `AI` | After the key and the acceptance | Same screen, S5 or S6 |
| A7. button "Switch it on" (`.s6.go`); "Asks for a reason" | After S5 | `aiproviders`, the account on in the chosen place, a line in Changes |
| A8. button "Record my acceptance" (`.s4.go`); "Asks for a reason" | S1 to S3 | Same screen; the acceptance recorded with name and date |
| A9. button "Use my subscription" (`.p.go`); "Asks for a reason" | S4 | `aimine`, the subscription listed under "What serves you now" as "Your own account" |

**Form messages**
| Field | Condition | Message |
|---|---|---|
| V1. the provider's test | The provider refuses the test | S6's words (`screen.aiconnect.s5.fail`) |

No other message is designed for this screen yet.

---

## aimine: "Your AI"

Mark: `not built`.

- **Address.** `/app/aimine`.
- **Frame.** Working. Rail place Settings; path "Settings › Your AI".
- **Who can see it.** Every member, each their own.
- **Purpose.** Your own AI: what serves you now, your choices among what the team allows, your own accounts, the checks in force for you and what you have used (`screen.aimine.purpose`).
- **Entry points.** `settings` (no row drawn there yet: see Differences); `aiconnect` A9; direct address.

**Content**
- C1. Heading "Your AI" (`screen.aimine.title`); "Which AI serves your work, what you may choose, and what it costs. Your team's administrators decide what is offered." (`.intro`).
- C2. Section "What serves you now" (`.now.head`): numbered rows, each an account with "The team's account" (`.now.team`) or "Your own account" (`.now.own`) and "On"; "Work goes to them in this order." (`.now.note`).
- C3. Section "Choose among what the team allows" (`.choose.head`): choice "Provider and plan" (`.choose.prov`); choice "Model" (`.choose.model`), help "Which version of the AI answers." (`.choose.model.help`); choice "How much effort it spends" (`.choose.effort`), help "More effort is slower and costs more." (`.choose.effort.help`); "Models and effort levels are listed exactly as the provider offers them. Your choice applies to work you start, and an administrator or a project can narrow it." (`.choose.note`).
- C4. Section "Your own accounts" (`.own.head`): "Your team allows members to add their own accounts." (`.own.team`); "A personal subscription is yours alone: it is never the team's or a project's account, and it is used only for your own work." (`.own.personal`); where a project's check excludes it, "Not used for work in {project}: that project requires “{check}”, which this subscription's AI does not meet." (`.own.fails`).
- C5. Section "Checks in force for you" (`.chk.head`): the seven checks as a member's rows; "When you work in a project, that project's checks also apply to the work done directly in it." (`.chk.proj`); "You can require any check the team does not. An AI that fails one you require is not used for your work, and you are told why." (`.chk.rule`).
- C6. Section "Your use and cost" (`.use.head`): a table "Last 30 days" (`.use.th`), "Requests" (`.use.calls`), "Cost" (`.use.cost`), one row per account; a plan with no cost per answer shows "not measurable in money" (`.use.nomoney`); "Only you see this: your own use across every account that served you." (`.use.note`).
- C7. Section "The first time material goes to a provider" (`.first.head`): "The assistant names the provider and waits for you before material first goes to it, and after any switch to another provider." (`.first.note`); "You can see this notice, and the others like it, on When the AI can't go on." (`.first.see`) with link "When the AI can't go on" (`.first.link`).

**States**
| State | When | What shows (exact) |
|---|---|---|
| S1 Team requires all seven | No check left open by the team | C5: seven rows "Required by the team", no checkboxes |
| S2 Team left two unchecked | Two checks not required | C5: those two each with checkbox "Require this for my own work" |
| S3 No AI serves you | No account on, none of your own (the internal walk) | C2 lists no row (no word row for an empty list); C3's choices are empty; C6's table has no rows |
| S4 Own accounts not allowed | The team unchecked "Members may add their own accounts" | C4 without `.own.team` and without A2 (no word row says so) |

**Actions**
| Control | When offered | Where it leads |
|---|---|---|
| A1. button "Use this for my work" (`.choose.go`) | Always | Same screen; C2 reorders to the choice |
| A2. button "Add an account of my own" (`.own.add`) | The team allows own accounts | `aiconnect` for a member's own account |
| A3. button "Save my checks" (`.chk.save`) | S2 | Same screen; the checked rows stay checked after a reload |
| A4. link "When the AI can't go on" (`.first.link`) | Always | `aimoments` |

---

## aiproject: "AI for this project"

Mark: `not built`. Not the alpha's `projectai`, which stays as it is.

- **Address.** `/app/aiproject/<project id>`.
- **Frame.** Working. Rail place Projects; path "<project name> › AI for this project".
- **Who can see it.** Every member who can see the project; only its owners change it.
- **Purpose.** The AIs this project uses, its budget and order, and the checks that apply to the work done directly in it (`screen.aiproject.purpose`).
- **Entry points.** The project (`project`); the design draws no link there yet (see Differences); direct address.

**Content**
- C1. Heading "AI for this project" (`screen.aiproject.title`); "Which of the team's AIs {project} uses, its own limit and its order." (`.intro`).
- C2. Section "Which AIs this project uses" (`.use.head`): checkboxes "The team's allowed AIs" (`.use.legend`), one per account the team allows; "A project can use fewer of the team's AIs, never more." (`.use.note`).
- C3. Section "This project's limit" (`.bud.head`): a meter of the month's cost against the limit; field "Monthly limit for this project" (`.bud.field`).
- C4. Section "Its order" (`.order.head`): numbered rows, one per AI the project uses; "Within the team's order." (`.order.note`).
- C5. Section "Checks for this project" (`.chk.head`): the seven checks as a project owner's rows; "These apply to all work done directly in {project}, not to work in the record or other areas that belong to no project." (`.chk.line`).
- C6. Section "Changes" (`.chg.head`): a list, each "{who} {what} · {date} · {level}" (`screen.aiproviders.chg.row`), level project.

**States**
| State | When | What shows (exact) |
|---|---|---|
| S1 The project's owner | The viewer owns the project | C1 to C6 with every control enabled |
| S2 A member | The viewer does not own it | First "{owner}, the project's owner, decides this. You can ask them to change it." (`.member`); every checkbox, field and save button disabled; no "Move up"/"Move down" |
| S3 No AI allowed | The team allows no AI (the internal walk) | C2 has no checkboxes and C4 no rows (no word row for either) |

**Actions**
| Control | When offered | Where it leads |
|---|---|---|
| A1. button "Save which AIs this project uses" (`.use.save`); "Asks for a reason" | S1 | Same screen; C4 lists only the checked AIs; a line in C6 |
| A2. button "Set the limit" (`.bud.save`); "Asks for a reason" | S1 | Same screen; the meter's limit changes |
| A3. buttons "Move up" (`.order.up`), "Move down" (`.order.down`) | S1 | Same screen; the order changes |
| A4. button "Save the checks for this project" (`.chk.save`); "Asks for a reason" | S1 | Same screen; a line in C6 |

---

## aimoments: "When the AI can't go on"

Marks: `not built`; `AI` (every moment needs a connected AI account).

- **Address.** Drawn inside the assistant panel (the dock beside a working screen), one moment at a time; the page listing the moments, reached from `aimine`, at `/app/aimoments`.
- **Frame.** Dock: the panel labelled "The assistant" (`screen.aimoments.panel`).
- **Who can see it.** The member whose work the assistant is doing.
- **Purpose.** What the assistant shows when an account reaches its limit, a provider stops answering, a model is retired or material is about to go to a new provider (`screen.aimoments.purpose`).
- **Entry points.** The assistant panel, on any working screen, when a moment occurs; `aimine` C7.

**Content**
- C1. On the listing page: heading "When the AI can't go on" (`screen.aimoments.title`); "What the assistant panel shows, one moment at a time. It never changes account, model or provider without telling you, and it waits for your choice." (`.intro`).
- C2. The panel, headed "The assistant" (`.panel`), showing one moment (S2 to S9). Every moment waits for the member's choice; none changes account, model or provider silently.

**States: the moments, each with its exact words**
| State | When | What shows (exact) |
|---|---|---|
| S1 No AI account | The assistant is unreachable (the internal walk) | No panel and no moment: the dock is absent, not greyed. The listing page shows C1 only |
| S2 An answer continues on another account | The account in use reached its limit and a later account is on | "The team's {from} account reached its monthly limit at {time}, so this answer continues on {to}." (`.a.what`); "The order is set by the team's administrators. You may decline the switch, and the answer waits until you choose." (`.a.note`); buttons "Keep going on {provider}" (`.a.keep`), "Stop here" (`.a.stop`) |
| S3 Before material first goes to a new provider | Material has never gone to this provider from the team | "{provider} would receive {sent}. It runs in {where}, keeps it {keep}, does not train on it and shares it only with companies it names." (`.b.what`); "This is the first time material goes to this provider from your team." (`.b.note`); buttons "Send it to {provider}" (`.b.send`), "Don't send" (`.b.nosend`) |
| S4 The limit is reached and no account is left | The limit is reached and no later account is on | "The team's {from} account reached its monthly limit at {time}, and no later account is on." (`.c.what`); "Only an administrator can raise the limit: {admins}." (`.c.who`); buttons "Wait until {date}" (`.c.wait`), "Continue without AI" (`.without`) |
| S5 The provider is down or slow | The provider does not answer | "{provider} is not answering." (`.d.what`); "Your question is kept. Nothing goes to another provider unless you choose it." (`.d.note`); buttons "Wait a little longer" (`.d.wait`), "Switch to {account}" (`.d.switch`), "Continue without AI" |
| S6 The model was retired | The chosen model is retired | "{provider} retired {old}. It says {new} replaces it." (`.e.what`); choice "Use this model instead" (`.e.choose`) of the provider's models; button "Use this model" (`.e.go`); "If the provider names no replacement, you choose another model from the ones it offers." (`.e.none`) |
| S7 The AI is not suited for this part | The AI chosen has not passed the part asked of it | "The AI you chose has not passed drafting letters. Choose another for this, or continue without AI." (`.f.what`); buttons "Choose another AI" (`.f.choose`), "Continue without AI" |
| S8 A use was switched off | An administrator switched that use off on the account | "{use} is switched off on {account}, so the assistant stopped. It was not moved to another account." (`.g.what`); "Switched off by {who} on {date}. They can switch it back on." (`.g.who`); buttons "Ask {who} to switch it on" (`.g.ask`), "Continue without AI" |
| S9 The cost before and after a run | Before a run starts, then when it ends | "Estimated: about {cost} on {account}" (`.h.before`); buttons "Start the run" (`.h.start`), "Choose another account" (`.h.pick`); after the run, "Cost: {cost}" (`.h.after`); "The estimate comes from the provider's published prices. The provider's own bill is what counts. A plan that reports no cost says “not measurable in money”." (`.h.note`) |

The design draws eight moments; their twelve choices are below.

**Actions** (the twelve choices)
| Control | When offered | Where it leads |
|---|---|---|
| A1. "Keep going on {provider}" (`.a.keep`; act "Keep going on the next account", `act.owed_aicontinue.label.aimoments`) | S2 | The answer continues on that account; the panel shows the answer |
| A2. "Stop here" (`.a.stop`; `act.owed_aistop.label.aimoments`) | S2 | The run stops; nothing more is sent |
| A3. "Send it to {provider}" (`.b.send`; "Send it to the provider", `act.owed_aisend.label.aimoments`); "Asks for a reason" | S3 | The material goes; the work continues |
| A4. "Don't send" (`.b.nosend`; `act.owed_aisendrefuse.label.aimoments`) | S3 | Nothing is sent; the run stops |
| A5. "Wait until {date}" (`.c.wait`) or "Wait a little longer" (`.d.wait`) (`act.owed_aiwait.label.aimoments` "Wait") | S4, S5 | The question is kept and waits |
| A6. "Continue without AI" (`.without`; `act.owed_aiwithout.label.aimoments`) | S4, S5, S7, S8 | The panel closes; the screen's own way without the assistant remains |
| A7. "Switch to {account}" (`.d.switch`; "Switch to another account", `act.owed_aiswitchaccount.label.aimoments`) | S5 | The work continues on that account |
| A8. "Use this model" (`.e.go`; "Use another model", `act.owed_aimodelchoose.label.aimoments`) | S6 | The work continues on the chosen model |
| A9. "Choose another AI" (`.f.choose`; `act.owed_aichooseother.label.aimoments`) | S7 | A choice of the AIs that passed this part |
| A10. "Ask {who} to switch it on" (`.g.ask`; "Ask an administrator", `act.owed_aiaskadmin.label.aimoments`) | S8 | The administrator is asked; the run stays stopped |
| A11. "Start the run" (`.h.start`; `act.owed_airunstart.label.aimoments`) | S9 | The run starts; on its end, "Cost: {cost}" |
| A12. "Choose another account" (`.h.pick`; `act.owed_aiaccountpick.label.aimoments`) | S9 | A choice of accounts; the estimate is shown again |

---

## aitest: "Test an AI that isn't listed"

Marks: `not built`; the test itself needs an AI endpoint: `AI`.

- **Address.** `/app/aitest`.
- **Frame.** Working. Path "Settings › AI providers › Test an AI that isn't listed".
- **Who can see it.** Administrators. Anyone else: `unavailable`, something they may not see.
- **Purpose.** Test a custom endpoint or an unlisted plan before it is used: the cost first, the result by part, and exactly what would be sent (`screen.aitest.purpose`).
- **Entry points.** `aiproviders` A2 and A3.

**Content**
- C1. Heading "Test an AI that isn't listed" (`screen.aitest.title`); "Only administrators run this. Until a release lists an AI, it can be used only after this test." (`.intro`).
- C2. Section "The AI to test" (`.what.head`): choice "What kind of AI" (`.what.kind`) of "An AI you run yourself, or one from a smaller provider" (`.what.custom`), "A plan that is not listed" (`.what.plan`); field "Web address of the AI" (`.what.endpoint`); field "Key" (`.what.key`), help "It is stored safely when you give it and is never shown again, to you or to anyone." (`.what.keyhelp`).
- C3. Section "What the test costs" (`.cost.head`): "Civicsmith's standard test is estimated at about {cost}, from {n} requests sent to the AI." (`.cost.est`); field "Spend ceiling" (`.cost.ceiling`), help "The test stops before it spends more than this." (`.cost.ceilinghelp`); "The cost is shown before the test runs. The test sends none of your team's material." (`.cost.note`).

**States**
| State | When | What shows (exact) |
|---|---|---|
| S1 Before the test | On opening | C1 to C3 |
| S2 The test running | After A2 | Section "The test is running" (`.prog.head`): one row per part, each "Done" (`.prog.done`), "Running" (`.prog.now`) or "Waiting" (`.prog.wait`); "The test is at {spent} of the {ceiling} ceiling so far. Leave this page open." (`.prog.note`) |
| S3 The result by part | The test ended | Section "The result, part by part" (`.res.head`): one row per part with why, and "Passed" (`.res.pass`), "Passed with limits" (`.res.lim`) or "Not suitable" (`.res.no`); "It becomes Reproduced when another team's test agrees." (`.res.grade`) |
| S4 What would be sent | S3, and the member looks at the bundle | S3, then section "What would be sent" (`.send.head`): "This is exactly what will be sent, in plain text. Nothing is sent until you press Send the results." (`.send.about`); the bundle as preformatted text (the AI, the test and its version and date, a line per part, speed and cost); "Not in it: the test conversations, your key, the AI's address, or anything your team holds." (`.send.not`); checkbox "Your team" (`.send.legend`): "Include our team's name, so others can see who tested it" (`.send.name`) |

**Actions**
| Control | When offered | Where it leads |
|---|---|---|
| A1. button "Save the address and key" (`.what.save`); "Asks for a reason" | S1 | Same screen; the key field empties |
| A2. button "Run the test" (`.cost.run`), `AI` | S1, address and key saved | Same screen, S2, then S3 |
| A3. button "Send the results" (`.send.go`); "Ends something" | S4 | The bundle is sent; it appears to other teams on `airesults` |
| A4. button "Don't send" (`.send.no`; act "Don't send the results") | S4 | Nothing is sent; the result stays with the team |

---

## airesults: "Results other teams sent"

Mark: `not built`.

- **Address.** `/app/airesults`.
- **Frame.** Working. Path "Settings › AI providers › Results other teams sent".
- **Who can see it.** Every member.
- **Purpose.** What other teams' tests found for each AI: the parts it passed, its limits, its speed and cost, and the grade (`screen.airesults.purpose`).
- **Entry points.** `aiproviders` A4.

**Content**
- C1. Heading "Results other teams sent" (`screen.airesults.title`); "Every member may read these. They hold the parts each AI passed and its limits, never a test conversation." (`.intro`).
- C2. Choice "Show the results for" (`.show`) of "Every AI" (`.all`) and each AI with results.
- C3. One row per AI: its name; "Passed: {parts}.", "Passed with limits: {parts}.", "Not suitable: {parts}."; "Standard jobs: {speed}, {cost}." (`.speed`); "Tested by {who} on {date}." (`.by`); its grade.
- C4. "A team is named only when it agreed to be. Otherwise it is “a team”." (`.note`).

**States.** One state: the list, narrowed by C2. With no results received (the internal walk), C3 has no rows (no word row for an empty list).

**Actions**
| Control | When offered | Where it leads |
|---|---|---|
| A1. choice "Show the results for" (act "Read the results for an AI", `act.owed_airesultsread.label.airesults`) | Always | Same screen; only that AI's row shows |

---

## Differences seen in the code

- None of the seven screens has code (`bio-plane/src` names them only in generated data: `setup-words/rows.mjs`, `wizard-scripts/screen-registry.mjs`); each address draws `unavailable` (`interface-shell/browser.mjs:1266`).
- Design gaps, not code: no row on `settings` leads to `aiproviders` or `aimine`, and no link on `project` leads to `aiproject`; the design reaches them only by their paths. The mockup shows `aimoments` as a page under a project's path while its frame is the dock.

## Changes

- 22 Nov 2026: written.
