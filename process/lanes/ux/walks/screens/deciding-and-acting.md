Length: N lines. Last section: "Changes".

# Screens: Deciding and acting

Page `deciding-and-acting` of the Screens document (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

Matters, plans and actions: what the team could do about a problem, starting and sending an action, a records request, following one action, litigation holds and their notice, a packet for counsel, the team's own rules, and one government act's matter. What binds every screen (frames, rail, refusals, the assistant dock, the read-only note) is on the page "Every screen".

## The screens on this page

| id | heading | address | built? |
|---|---|---|---|
| `plan` | the plan's title; "Action plans" for a project | `/app/plan/<plan id>`; `/app/plan/<project id>` | built |
| `start-send` | "Start “{option}”"; "The action started" | `/app/start-send/<plan id>~<option id>`; `/app/start-send/<action id>` | built |
| `glossary` | "Glossary" | `/app/glossary` | built |
| `actionnew` | "Start an action" | `/app/actionnew/<project id>` | built |
| `request` | "Request records" | `/app/request/<project id>`; `/app/request/<action id>` | built |
| `action` | the action's kind and title | `/app/action/<action id>` | built |
| `hold` | "Litigation hold" | `/app/hold/<subject>` | built |
| `holdnotice` | "Hold notice" | `/app/holdnotice/<the hold's place>` | built |
| `counsel` | "Brief counsel" | `/app/counsel/<action id>` | built |
| `grouprules` | "Your team's own rules" | `/app/grouprules` | built |
| `matter` | the act's title | `/app/matter/<determination id>[~<escalation id>]`; `/app/matter/<project id>` | built |

## How to read this page

- A key written with a leading dot (`.title`) stands for `screen.<id>.title` of the screen whose section it is in. Every other key is written in full.
- Weights (the mark drawn on a button, from `mock-kit.js` `WEIGHT`, the design's): **W1** no mark (undoable); **W2** "Asks for a reason" (`weight.reasoned.name`); **W3** "Ends something" (`weight.terminal.name`); **W4** "You sign this" (`weight.signed.name`); **W5** "Irreversible" (`weight.irreversible.name`). **Outward** means the button also carries the outward icon. Each button's hover text is `act.<op>.does`.
- **Protected words** (`words.json` `protected: true`) are words that must show before an outward, signed or irreversible act is done. They are listed under "Before it is done" in the actions table and must appear exactly.
- Every screen here is in the working frame: a visitor without a session is shown `front` and the address is kept. A member who cannot see the project the subject belongs to is shown `unavailable` ("You can't open this", `shell.unavailable.notyours.title`). A member who may read and not act sees the note `shell.readonly` ("You can read this {noun} and cannot act on it. What each member may do is set under {members}.") and no act buttons. A member invited to the project but not joined sees, under the disclosure "If you were invited and have not joined yet", `refusal.PROJECT_ACT_NOT_A_PARTICIPANT.invited` ("You have been invited to this project but have not joined it yet, so you can't do this here. Looking, capturing and citing stay open to you. Join the project to go on. Nothing was changed.") and button "Join" (`act.projectjoin.label.<id>`, W1), which joins the project and leaves the member on the same screen.
- Without an AI account (the walk's case) the assistant is absent, not greyed: "Help me write this" (`act.writinghelp.label.<id>`) is not drawn under any field, and no machine-drafted text or machine proposal is drawn.

---

## plan: "Action plan"

- **Address.** `/app/plan/<plan id>` for one plan; `/app/plan/<project id>` for a project's plans.
- **Frame.** Working. Path: Projects › {project} › "Action plan" (`screen.plan.name`).
- **Who can see it.** A member who can see the project. Anyone else: `unavailable`.
- **Purpose.** The options for what to do about a problem, the order to try them, and what each waits on (`.purpose`).
- **Entry points.** `project` (its plans); `question` (a plan's title as a link, and "Plan what to do"); the queue; this screen's list (S2).

**Content (S1, one plan)**
- C1. Heading: the plan's title (data). Sub-line: the state "Open" / "Paused" / "Closed" (`.state.open`, `.state.paused`, `.state.closed`) and "opened {date} by {name}" (`.opened`). A closed plan adds "Closed: {reason}" (`.closedwhy`).
- C2. Checks strip: "Checks · {n}" (`.checks`), then one line per check, e.g. "Scenario {scenario}: no branch answers a hostile response (refusal, obstruction, retaliation) to {item}." (`.check.hostile`).
- C3. Section "Matters" (`.matters`), help `.matters.holds`. Each matter numbered, with its support: "Assumed: not shown yet" (`.support.hypothetical`), "established" (`.support.established`), "short of established" (`.support.short`) or "undetermined" (`.support.undetermined`); its source "from the question "{title}" ({status}, {date})" (`.subject.from`); its escalation "escalation: {stage}" (`.escalation`). Button "Add a matter" (A1).
- C4. Section "Options" (`.options`), help `.options.holds`. A sort line "Sort by {column}" (`shell.sort`) over "Category", "Legal deadline", "Matter", "Disposition" (`.col.category`, `.col.ends`, `.col.matter`, `.col.disposition`). Each option is a row with a pick checkbox, its summary, its category (`.category.*`: mitigation, legal, awareness, journalistic, grassroots, other) and disposition (`.disposition.*`: undecided, chosen, declined, done, blocked), with a declined or blocked option's reason. Below: "An option is undecided, chosen, declined, done or blocked." (`.an.option.is.undecided.chosen.declined`) "Declined and blocked each keep their reason." "Any option can be returned to undecided."
- C5. Disclosure "Add an option" (A2): note `.one.thing.the.team.could.do` + `.say.who.it.is.for.and`; fields "In a line, what the option is" (help "Up to 200 characters."), "More about it (optional)" (`.option.detail`), choice "What kind of option" (Mitigation, Legal, Awareness, Journalistic, Grassroots, Other; `.option.kind.*`; help "Only a legal option can carry a tier."), checks "The matters it serves", choice "Who it is directed to" ("No one in particular", "A named office or public body", "The press", "An organization", "An audience, described in words"; help `.never.a.private.individual` + `.name.an.office.by.its.role`), fields "The role" and "The body or organization", sub-section "Dates that bind it" (`.dates.that.bind.it`) with "The date" and "Because: the law, order or commitment" and link "Add another date" (`.add.another.date`), choice "How careful to be (legal options only)" ("Not assessed yet", "1 · file freely", "2 · file with caution", "3 · do not file without counsel"; `.option.tier.*`), check "This option asks someone to enforce or restore a requirement (lobbying)" under "Seeking enforcement", choice "The requirement it seeks" (help `.a.standard.you.can.read.or` + `.required.when.the.option.is.lobbying`).
- C6. Disclosure "Decide the options you picked" (`.decide.the.options.you.picked`): note `.each.decision.is.recorded.with.who` "Nothing here starts an action." "Starting a chosen option is done further down."; radio "What to do with them": "Choose them", "Decline them", "Mark them done", "Mark them blocked", "Return them to undecided"; field "Why (required to decline or to mark blocked)" (help ends "It stays on the plan beside your name."); sub-section "Remind me as a date comes near" with "Which date" and "Remind me on" (`screen.action.remindon`).
- C7. Button "Start…" (A6), the primary act.
- C8. Section "Scenarios" (`.scenarios`), help `.scenarios.holds`: tabs, one per scenario; each phase row "{item} → checkpoint: "{checkpoint}" (judged by a member, once it is due)" (`.phase.checkpoint`) with button "Judge" (`.judge`), or "You can judge this checkpoint from {date}." (`.judge.notdue`). Disclosure "Lay out a scenario" (A4): note `.a.scenario.is.a.story.of`; "Name of the scenario"; "A phase" with "Name of the phase", "Options in this phase", "When it starts" ("At the start of the plan", "After another phase", "When another phase's checkpoint is met", "When another phase's checkpoint is not met"), "Which phase", "Check back after (days)", "What the checkpoint tests", "If the checkpoint is met, go to", "If it is not met, go to"; link "Add another phase".
- C9. Section "Started" (`.startedsec`), help `.startedsec.holds`: each started option's action with its state (`.actionstate.*`: planned, active, awaiting a response, resolved, abandoned) and "Open the action" (`.openaction`); an untaken checkpoint "nobody has taken it up" (`.item.untaken`) with "Take this up" (`.takeup`).
- C10. Button "Close plan…" (`.close`).

**States**

| State | When | What shows |
|---|---|---|
| S1 one plan | Address names a plan | C1 to C10. |
| S2 a project with several plans | Address names a project with plans | Heading "Action plans" (`.list.title`), section "This project's action plans" (`.list`), help `.list.help`; one row per plan: its title, state and "opened {date} by {name}". Over 200 plans adds "Not every plan is shown here. Find lists them all: choose Plans under Show." (`.list.more`). |
| S3 a project with no plan | Address names a project with none | Heading "Action plans"; note "This project has no action plan yet. To start one, choose “Plan what to do” under the project's questions, or on one question's own page." (`.none`). |
| S4 closed plan | The plan was closed | C1 shows "Closed" and "Closed: {reason}"; no add, decide, start, scenario or close controls. A plan closed empty shows "Nothing was put in this plan before it was closed." (`.empty`). |
| S5 assistant at work | After A3 | In the tray: "The assistant is looking for options. They will wait here, labeled, when it finishes." (`.ask.running`); asked twice: `.ask.already`; finished: `.ask.ended`. `AI` |
| S6 assistant unreachable | No AI account (the walk) | No tray "Suggested by the assistant · not yet in the plan" (`.suggested`), no "Ask the assistant for options", no "Help me write this". In their place the design shows the note "No options are suggested yet: none of this project's matters has a route to suggest from." (`.nosuggestions`). |

**Actions**

| Control | When offered | Where it leads / weight |
|---|---|---|
| A1 button "Add a matter" (`act.plansubjectadd.label.plan`) | Open plan | Same screen, the matter added under C3. W2. |
| A2 button "Add an option" (`act.optionadd.label.plan`) | Open plan | Same screen, the option added to C4. W2. |
| A3 button "Ask the assistant for options" (`act.planask.label.plan`) | Open plan, assistant reachable | Same screen, S5. W1. `AI` |
| A4 button "Adopt" (`.adopt`; act "Adopt a suggestion") | A suggestion in the tray | The suggestion becomes an option in C4. W2. `AI` |
| A5 buttons "Choose" (`.choose`), "Decline" (`.decline`), "Mark done" (`.dispose.done`), "Mark blocked" (`.dispose.blocked`), "Return to undecided" (`.dispose.open`) | Options picked | Same screen, each picked option's disposition changes in C4. W2. |
| A6 button "Start…" (`act.optionstartpreview.label.plan`) | A chosen option is picked | `start-send` for that option. W1. |
| A7 button "Lay out a scenario" (`act.scenarioset.label.plan`) | Open plan | Same screen, C8 shows the scenario. W2. |
| A8 button "Judge" (`.judge`; act "Judge a checkpoint") | A due checkpoint | Asks "How did it turn out?" (`.judge.outcome`), "met"/"not met" (`.judged.met`, `.judged.not_met`), "A note (optional)"; the phase shows the result. W2. |
| A9 button "Take this up" (`.takeup`; act "Take an item up yourself") | An untaken item in C9 | Same screen: "You took this up." (`.tookup`). W2. |
| A10 button "Close plan…" (`.close`; act "Close the plan") | Open or paused plan | Asks how it ended, then S4. W3. Before it is done: `act.planclose.does` "Closes the plan, with how it ended. It stays readable." (protected). |
| A11 a plan's title in S2 | S2 | `plan` for that plan (S1). |
| A12 "Open the action" (`.openaction`) | A started option | `action`. |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1 option line | empty or over 200 characters | "An option needs a line saying what it is, up to 200 characters. Write one and add it again." (`.an.option.needs.a.line.saying` + `.write.one.and.add.it.again`) |
| V2 matters it serves | none chosen | "Choose at least one matter the plan is about. An option cannot serve a matter that is not in this plan." (`.choose.at.least.one.matter.the` + `.an.option.cannot.serve.a.matter`) |
| V3 tier | tier on a non-legal option | "A tier belongs only on a legal option. Change the kind, or clear the tier." |
| V4 lobbying | no requirement named | "An option marked as lobbying must name the requirement it seeks to have enforced. Choose it, or clear the mark." |
| V5 date | no basis or not a real day | "A date needs the law, order or commitment it comes from, and a real calendar day. Fix the date and add again." |
| V6 directed to | a private individual | "An option can be directed to an office, the press, an organization or an audience, never to a private individual. Change who it is for." |
| V7 the press | outlet or role empty | `.press.empty.role`, `.press.empty.organisation`, `.press.empty.both` ("State the outlet and the person's role there. Nothing was written.") |
| V8 why (decide) | declining or blocking with no reason | "Declining an option or marking it blocked needs a reason in your own words. Write one and decide again." |
| V9 reminder | set without choosing; or a date the option lacks | "Reminders are set only when you choose an option. Choose it, or leave the reminder out." / "A reminder names a date the option has. Pick one of its dates, or add the date to the option first." |
| V10 picks | none picked | "Pick at least one option. An option that is not in this plan cannot be decided here." |
| V11 closed plan | deciding on a closed plan | "This plan is closed, so its options can no longer be decided. Ask an owner to reopen it." |
| V12 phase | unchosen option; a cycle; a missing target; a missing part | `.a.phase.can.hold.only.options` + `.choose.the.option.first.or.take`; `.following.when.each.phase.starts.leads` + `.no.phase.can.start.after.itself.2`; `.a.phase.points.to.a.phase` + `.choose.one.that.is.in.it`; `.a.phase.needs.a.name.the` + `.fill.in.the.one.that.is` |

Each group of messages sits under a disclosure: "When an option is not added", "When a decision is not recorded", "When a scenario is not laid out".

---

## start-send: "Start “{option}”"

- **Address.** `/app/start-send/<plan id>~<option id>` before the action exists; `/app/start-send/<action id>` after.
- **Frame.** Working. Path: Projects › {project} › Action plan › "Start and send" (`.name`).
- **Who can see it.** A member who can see the project. Anyone else: `unavailable`. An invited, unjoined member: the note and "Join" (see "How to read").
- **Purpose.** Start an option from a plan: prepare what is sent, check who it goes to today, and send it after the warning (`.purpose`).
- **Entry points.** `plan` "Start…"; `action` (an approved, unsent action opens here at its step).

**Content (S1, a records request)**
- C1. Heading "Start “{option}”" (`.title`); once started "The action started" (`.titlestarted`). Sub-line "Nothing runs until you confirm. This is what the action will say and rest on." (`.nothingruns`).
- C2. Section "Step 1 · Start" (`.step1`), a list: "Kind" (`.kind`, e.g. "records request" `.kind.records_request`); "Addressed to" (`.to`) the office as a card, "an office, by its role" (`.byrole`) or "nobody named yet" (`.noaddressee`); "Rests on" (`.rests`) the matter and its support, or "no matter" (`.restsnothing`); "Clock" (`.clock`) "{days} days, from the law your profile names" (`.clock.law`) or `.noclock`; "Asserts a breach" (`.breach`) "no" / "yes, this action says the office broke a rule".
- C3. Choice "The team's contact for this action (optional)" (`.contact.label`; first option "No one yet" `.contact.none`; help `.contact.help1`-`.contact.help3`).
- C4. Where the start would be refused: "Would be refused" (`.wouldrefuse`), the reason, `.resolve`, field "Proceed anyway, with this reason (optional)" (`.override`, help `.override.help`).
- C5. Section "Step 2 · Prepare and send" (`.step2`): field "What the team sends" (`.text`, help `.text.help`) with its origin line: "From your team's template · each filled blank names its source" (`.draft.template`), "Your own words" (`.draft.own`), each blank "{name}: {value} (from {source})" (`.blank`), and "Still to fill: {names}" (`.unfilled`).
- C6. "Sent with" the team's statement, and "In this matter" the project's stake (data).
- C7. Section "The exhibits, against the court's or office's standard" (`.exhibits.heading`): intro `.exhibits.intro1`-`.exhibits.intro3`; each exhibit "captured {date}" with its grade and one of "Within the grades this court or office accepts." (`.exhibits.accepted`), `.exhibits.contestable1`+`2`, `.exhibits.below1`+`2`, or "Grade not determined" + `.exhibits.undetermined`; disclosure "When the court's or office's standard is not stated" (`.exhibits.refused.*`).
- C8. Section "A sentence the record contradicts" (`.release.head`), the sentence, field "Why you release it" (`.release.why`, help `.release.why.help`), button "Release this sentence" (`act.release.label.start-send`); once released "Released by {who} on {date}: {reason}" (`.release.done`).
- C9. Notes: "Approving fixes the text." (`.approvefixes`) and "Your team's Civicsmith sends nothing: you send it by the office's own means (its web form, mail, or in person), then record it here." (`.nosend`). Where a second approval is needed: "Waiting for a second member's approval. Any member of this project other than the first approver can give it." (`.waitsecond`).
- C10. The outward panel: tag "Outward · seen outside your team" (`.outward`), "Sending this tells the office what your team is looking at." (`.outward.says`), fields "The day you sent it" (`.sentat`, help "Reply deadlines count from this day."), "How you sent it" (`.how`), "The office's reference for it (optional)" (`.reference.field`), button "I have sent it · record the sending" (`.recordsent`).
- C11. Once recorded: "Recorded as sent on {date}" (`.sent`), "reference {reference}" (`.reference`), "Sent. The action is still planned: open it and move it to active." (`.sent.next`), link "Open the action" (`.openaction`).
- C12. Section "Keep this filing as your team's template" (`.template.heading`): notes `.template.note1`-`.template.note3`; "The template's name" (`.template.name.label`), "What it is for" ("A filing" / "A brief for counsel"), "Notes for the team (optional)"; button "Keep as a template".

**States**

| State | When | What shows |
|---|---|---|
| S1 a records request | Option of kind records request | C1 to C12 as above. |
| S2 an action with higher stakes | Kind such as taking part as a party | As S1, plus the section asking about the action's stake: field "This action's stake (optional)" and button "Save this action's stake" (`act.owed_actionstake.label.start-send`). The design keys the question's heading and note under `stake.*`. |
| S3 started, not yet sent | After A3 | Heading `.titlestarted`; Step 2 open. |
| S4 approved, waiting for a second approval | Project needs two approvals | C9's `.waitsecond` and button "Give the second approval". |
| S5 sent | After A8 | C11. |
| S6 assistant unreachable | No AI account | The text is never "Drafted by the assistant · a proposal until a member approves it" (`.draft.machine`); it starts from the template or is empty; no "Help me write this". |

**Actions**

| Control | When offered | Where it leads / weight |
|---|---|---|
| A1 "Go on to prepare and send" (`.tostep2`) | Step 1 shown | Same screen, Step 2. |
| A2 button "See what starting does" (`act.optionstartpreview.label.start-send`) | Before start | Same screen, C2 and C4 refreshed. W1. |
| A3 button "Start the action" (`act.optionstart.label.start-send`), primary | Before start | `start-send` for the new action (S3). W2. |
| A4 button "Prepare what is sent" (`act.communicationprepare.label.start-send`) | Started | Same screen, C5 filled. W2. |
| A5 button "Prepare the filing" (`act.filingprepare.label.start-send`) | Started | Same screen. W2. |
| A6 button "Approve this text" (`act.filingapprove.label.start-send`) | Text prepared | Same screen; text fixed. W3. Before it is done: `consequence.filingapprove` "Approving makes this text yours, recorded with your name, the time and its digest. A filing is approved once, and the approval is not walked back: what is sent is the text you approved." (protected); `act.filingapprove.does` (protected). |
| A7 button "Give the second approval" (`act.filingsecondapprove.label.start-send`) | S4, a member other than the first approver | Same screen. W3. `act.filingsecondapprove.does` (protected). |
| A8 button "I have sent it · record the sending" (`.recordsent`; act "I have sent it") | Approved | S5. W2, Outward. Before it is done: C10's "Outward · seen outside your team" and "Sending this tells the office what your team is looking at."; `act.filingrecordsent.does` "Records that you sent it, when and how. Civicsmith never sends for you; reply deadlines count from here." (protected). |
| A9 button "Release this sentence" (`act.release.label.start-send`) | A contradicted sentence | Same screen, C8 shows the release. W3. |
| A10 button "Keep as a template" (`act.templatesave.label.start-send`) | Filing approved | Same screen. W1. |
| A11 button "Save this action's stake" | S2 | Same screen. W1. |
| A12 "Open the action" (`.openaction`) | S5 | `action`. |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1 contact | not a member | "The contact must be a member of your team. Choose one of the members listed, or leave it empty, then start the action again." (`.contact.refused.body1` + `2`), under "When the contact is not a member" |
| V2 text | empty | "Write what is sent first." (`.text.needed`) |
| V3 day sent | empty | "Give the day you sent it first." (`.sentat.needed`) |
| V4 how sent | empty | "Say how you sent it first." (`.how.needed`) |
| V5 template | not approved; name taken; tier needs counsel | `.template.refused.unapproved1`+`2`; `.template.refused.taken1`+`2`; `.template.refused.tier1`+`2`, under "When the template is refused" |

---

## glossary: "Glossary"

- **Address.** `/app/glossary`. **Frame.** Working. Path: Settings › "Glossary" (`.name`).
- **Who can see it.** Every member. No act.
- **Purpose.** What the terms and marks in the record mean (`.purpose`).
- **Entry points.** `account` (link "Glossary"); any term underlined with dots, when chosen.

**Content**
- C1. Heading "Glossary"; sub-line "What the terms and marks in the record mean." (`.sub`).
- C2. Paragraph `.intro` ("A term underlined with dots in the record explains itself when you rest on it, and opens this page when you choose it. …").
- C3. Section "Money and budgets" (`.money.heading`): ACFR, CAFR, GPF, FY (`.money.<t>.name`), each with its meaning (`.money.acfr` etc.).
- C4. Section "How the record is kept honest" (`.honest.heading`): Fingerprint, Timestamp, Signature, Manifest, Provenance, each with its meaning (`.honest.<t>`).
- C5. Section "What each state allows" (`.states.heading`): sixteen rows, each a state chip (review, reviewed, retired, open, concluded, deferred, dismissed, divided, published, waiting, planned, active, resolved, abandoned, flagged, watched) with `state.item.<k>.means`, `.can` and, where held, `.cannot`.
- C6. Note "A document can bring terms of its own. They open from the word on that document and are kept with it, not listed here." (`.documentterms`).

**States.** One: the page reads nothing and is the same for every member.

**Actions.** None (no act). A term chosen elsewhere opens this page.

---

## actionnew: "Start an action"

- **Address.** `/app/actionnew/<project id>`. **Frame.** Working. Path: Projects › {project} › "Start an action".
- **Who can see it.** A member who can see the project. Anyone else: `unavailable`.
- **Purpose.** Start an action of any kind: who it goes to, what it asks, how carefully to act, what it rests on, and when it is due and why (`.purpose`).
- **Entry points.** `request` (link "Start another kind of action"); `project`.

**Content**
- C1. Heading "Start an action"; sub-line "Something your team does to get an answer, a record or a decision from someone." (`.sub`).
- C2. Choice "What kind of action" (`.kind`, help `.kind.help`): the kinds the record knows (`screen.start-send.kind.*`) and "Another kind" (`.kind.other`).
- C3. Note "A records request has its own steps, which work out the law and the due date for you." (`.records`), link "Request records" (to `request`).
- C4. Section "Who it goes to" (`.to`): radio "A named office or public body" / "Not determined yet" ("Say what is known so far and what would settle it"); field "Who" (`.to.who`); button "Choose the office"; field "What is known so far, and what would settle it" (`.to.basis`); note "This action will not be sent while who it goes to is undetermined." (`.to.unsent`).
- C5. Section "What it asks": field "In a line, what this action asks for" (`.asks`).
- C6. Section "How carefully to act" (`.care`): choice "How careful to be" (`.care.field`, "1 · file freely", "2 · file with caution", "3 · do not file without counsel"; help `.care.help`).
- C7. Section "What it rests on" (`.rests`): "Point at what this rests on or advances" (the project's questions), "What the link does" ("Rests on" / "Advances" `.rests.advances`), note `.rests.needed`.
- C8. Section "When things are due" (`.due`): "What is due", "When", "Because: where this date comes from"; note `.due.note`.
- C9. Note "Templates are offered once the action is started, for its kind. None is suggested here, before you have chosen what to do." (`.templates.after` + `.templates.none`).
- C10. Button "Start the action", primary.

**States.** S1 the form (the only state the design draws: the composer has no variants). S2 assistant unreachable: no "Help me write this" under C5.

**Actions**

| Control | When offered | Where it leads / weight |
|---|---|---|
| A1 link "Request records" | always | `request` for this project. |
| A2 button "Choose the office" (`act.addresseesuggest.label.actionnew`) | "A named office" chosen | Same screen, the office suggested in "Who". W1. |
| A3 button "Start the action" (`act.actioncreate.label.actionnew`), primary | always | `action` for the new action. W2. |
| A4 "Help me write this" | assistant reachable | Same screen, a labelled draft. `AI` |

---

## request: "Request records"

- **Address.** `/app/request/<project id>` (a new request); `/app/request/<action id>` (a request already started opens at the step it reached: approved and not sent opens at the send).
- **Frame.** Working. Path: Projects › {project} › "Request records" (`.name`).
- **Who can see it.** A member who can see the project. Anyone else: `unavailable`. Invited, unjoined: note and "Join".
- **Purpose.** Ask an office for records under the law that requires it to answer; the due date is worked out (`.purpose`).
- **Entry points.** The wizard "Get a record" (from `finder`); `actionnew` (link "Request records"); `action` (link "Prepare the text"); `project` (link "Records requests"); the queue ("Pick up where you left off").

**Content (S1, offices are known)**
- C1. Heading "Request records"; sub-line "Look first: if the record is public, capture it instead." (`.lookfirst`); the wizard mark "Get a record".
- C2. Note "Asking for something other than records?" (`.other`), link "Start another kind of action" (`.other.go`).
- C3. Choice "Which name the records concern" (`.subject.label`, help `.subject.help`); choice "The office that holds the records" (`.office`, each option "… · held today by {holder}" `.holder`; help `.office.help`); button "Choose the office".
- C4. Field "What records you want, in plain words" (`.what`, help `.what.help`); button "Start the request".
- C5. Choice "The law it goes under" (`.law`; options "{citation} · {window}" `.law.option` with "an answer within {n} days" / "an answer within {n} business days"; help `.law.help`); button "Choose the law it goes under"; link "How a records request works" (to `help-records`).
- C6. Fields "Records from", "to", "In what form" ("Electronic, as the office keeps them", "A spreadsheet", "PDF", "Paper copies"), "Tell us first if copies cost more than" (help "An amount, such as $25.").
- C7. Field "The request" (`.text`, help `.text.help`), drafted from the team's template; note `.describe` ("Describe the records, not why you want them. …").
- C8. "Sent with" the team's statement; "In this matter" the stake; disclosure "When the stake can't be read".
- C9. Buttons "Prepare the text" and "Approve this text".
- C10. Section "How to send it" (`.howsend`): four numbered steps `.howsend.1`-`.howsend.4`.
- C11. The outward panel: tag "Outward · seen outside your team" (`screen.start-send.outward`), `.outward` ("Sending this tells the office what your team is looking at, and the portal shows the request's text to anyone. Whatever the request says about your work becomes public."), field "The portal's request number" (`.reference`, help `.reference.help`), button "I have sent it · record the sending" (`screen.start-send.recordsent`).

**States**

| State | When | What shows |
|---|---|---|
| S1 offices are known | Offices hold such records | C1 to C11. |
| S2 no office is known yet | None is known | In place of C3 to C11: note "No office is known to hold such records yet." (`.nooffice`) "If you know which office holds them, name it yourself below." (`.nooffice.admin`); disclosure "Name the office yourself" (`.nameoffice.head`) with note `.nameoffice.note`, fields "The agency", "The office within it", "Where requests go", "The law it goes under", "Why you are naming this office", button "Use this office"; note `.nooffice.pointer.a` + `.nooffice.pointer.b`; links "The office's page" (to `person`) and "Places and offices" (to `places`). |
| S3 assistant unreachable | No AI account | The request text is the template's, never a machine draft. |

**Actions**

| Control | When offered | Where it leads / weight |
|---|---|---|
| A1 link "Start another kind of action" (`.other.go`) | always | `actionnew`. |
| A2 button "Choose the office" (`act.addresseesuggest.label.request`) | S1 | Same screen, offices suggested. W1. |
| A3 button "Start the request" (`act.actioncreate.label.request`) | Office and records given | Same screen at `/app/request/<action id>`. W2. |
| A4 button "Choose the law it goes under" (`act.actionlaws.label.request`) | Started | Same screen. W2. |
| A5 button "Prepare the text" (`act.communicationprepare.label.request`) | Started | Same screen, C7 drafted. W2. |
| A6 button "Approve this text" (`act.filingapprove.label.request`) | Text prepared | Same screen; text fixed. W3. Before it is done: `consequence.filingapprove` (protected). |
| A7 button "I have sent it · record the sending" (act "I have sent it", `act.filingrecordsent.label.request`) | Approved | `action` for this request. W2, Outward. Before it is done: C11's tag and `.outward`; `act.filingrecordsent.does` (protected). |
| A8 button "Use this office" (`act.entitycreate.label.request`) | S2 | Same screen, S1 with the office chosen; the office shows "Named by a member" (`.nameoffice.mark`). W2. Before it is done: `consequence.entitycreate` (protected). |
| A9 link "How a records request works" | always | `help-records`. |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1 office | none chosen | "Choose the office first." (`.office.needed`) |
| V2 records wanted | empty | "Say what records you want first." (`.what.needed`) |
| V3 request number | malformed | "The request number is one line of at most 100 characters." (`.reference.malformed`) |
| V4 office (S2) | team has no body | `.office.nobody` ("Your team has no body listed yet, so no office can be named here. …") |

---

## action: "{kind}: {title}"

- **Address.** `/app/action/<action id>`. **Frame.** Working. Path: Projects › {project} › "Action" (`.name`).
- **Who can see it.** A member who can see the project. A member who may read and not act: S4. Anyone else: `unavailable`.
- **Purpose.** One action: what was sent, to whom, when a reply is due, and what came back (`.purpose`).
- **Entry points.** `plan` ("Open the action"); `start-send` and `request` after the sending; the queue (an overdue reply); `projects`; `dash-action`.

**Content (S1, waiting on a reply)**
- C1. Heading: the kind (`.kind.*`, e.g. "Records request") and the action's title. Sub-line "to {office}" (`.to`) · "sent {date} by {who}" (`.sentby`). Where they apply: "Confidential: seen inside the team and never published." (`.confidential`), "Approved, not yet sent: nothing has gone to the office." (`.unsent`) with link "Pick up where you left off" (`.pickup`), "A litigation hold is in place." (`.held`).
- C2. Due line "Response due {date}" and "Waiting on {office}'s reply" (`.waiting`).
- C3. Section "Due dates" (`.dates`), help `.dates.holds`: each date with its state "pending", "met", "overdue, as a member determined", "waived" (`.clock.*`), linking to `due-date`.
- C4. Section "Replies" (`.replies`): each reply dated, "received" or "no response"; note `.a.recorded.reply.stays.on.the` + `.it.is.never.edited.or.removed`; the reply form: "What came back" ("A reply came" / "No reply came by the date"), "The day it came, or the day the reply was due", "How it came" (Email, Letter, The city's portal, In person, Another way), "Who it came from", "What you record it from" ("Your account of it" / "The reply itself, a document you added"), "Your account of the reply", "The document that holds the reply"; disclosure "Where this reply stands in the request" ("What kind of reply" `.reply.stage.*`, "It follows", "What the office decided" `.reply.outcome.*`, "The exemptions the office cites", "The office says it will answer by", "The law that date comes from"); disclosure "If the reply quotes a fee" ("The amount quoted", "Currency", "What the fee is for", "It answers this sending", "It revises this quote"). Buttons "Record a reply", "Mark a reply as pressure".
- C5. Section "Pressure on this action" (`.pressuremarks`), help `.pressuremarks.holds`: each mark "a reply marked as a legal threat by {member}" (`.legalmark`) with "No hold is placed for it yet." (`.holdnone`); a profile fact "From your jurisdiction's profile" (`.profilefact.from`); note "The fact is shown here once, because a reply was marked as a legal threat." (`.profilefact.shown`) "Legal information, not legal advice" (`guide.procedure.legalinfo`); links "Place a hold" (`.hold.link`) and "Draft a rule your profile lacks" (`.rule.link`).
- C6. Section "The law it goes under": the law, who stated it, "Proposed, not chosen:" (`law.proposed`) proposals; choice "Choose a law"; buttons "Change the law…" (`law.change`) and "Propose another law…" (`law.propose`); help `law.help`. Where the places list none: `.law.none` with "Level" and "Citation".
- C7. Section "How this kind of action goes" (`.guide.heading`): "From your jurisdiction's profile" · "listed in the profile's order, not ranked" (`.guide.order`) · "Legal information, not legal advice"; each route "Expect: {expectation}" (`.guide.expect`) · "Source: {citation}" (`.guide.source`); note `.guide.sourced` + `.guide.team` + `.guide.teamnone`; button "Show the routes". With none: "No route is known for this kind of action yet." (`.routes.none`).
- C8. Section "Templates for this action" (`.templates.heading`): `.templates.offered`, `.templates.nocourt`; rows with "approved by {member}, {date}" or "Not offered yet: …" (`.templates.notyet`); note `.templates.own` + `.templates.never`; link "Prepare the text" (to `request`).
- C9. Section "Its risk" (`risk.title`): "Tier {n} · …", who set it and why; button "Revise, with a reason…" (`risk.revise`).
- C10. Disclosure "How it ended": choice "How it ended" ("The office complied", "The office denied it", "It was escalated", "Your team withdrew it", "Your team carried it out"; `.ended.*`, help `.ended.help`), field "In your own words" (`.ended.own`, help `.ended.own.help`). Buttons "Move the action", "Remind me" ("Remind me on" `.remindon`), and the confidentiality act.

**States**

| State | When | What shows |
|---|---|---|
| S1 waiting on a reply | Sent, reply not yet due | C1 to C10. |
| S2 the date passed with no reply recorded | Due date passed, no reply | Above C3: "No reply recorded by {date}" (`action.noreply.title`, protected), `action.noreply.says` ("The date the law gives has passed with no reply on the record. If a reply came, record it below. If none came, that silence may be worth asking about."), button "Open a question from this". |
| S3 asking about the silence | After choosing to ask | Section "Ask about the silence" (`.ask.heading`): `action.noreply.question.help`; field "Your question"; button "Open a question from this", primary. After: "Your question is open in {project}, with this action as its reference." (`.ask.done`) and link "Open the question" (`.openquestion`). |
| S4 a member who may read and not act | Read-only member | The read-only note; no button and no act row anywhere. |
| S5 recording a reply to a request for comment | A public comment's reply | Section "Record a reply to your team's public comment" (`.minutes.heading`): `.minutes.says`; fieldset "Where the minutes record your team's comment" with "The meeting", "The meeting's date", "The document that holds the minutes", "The passage"; button "Record the reply" (`.minutes.record`); disclosure "When it cannot be done yet" with `.minutes.notpublic`. |
| S6 resolved | Moved to resolved | "Resolved: the office complied." etc. (`.resolution.said.*`). |
| S7 assistant unreachable | No AI account | Section "Its risk" shows no "Proposed, not set:" machine proposal; no "Help me write this". |

**Actions**

| Control | When offered | Where it leads / weight |
|---|---|---|
| A1 button "Record a reply" (`act.actioncorrespond.label.action`), primary | Not read-only | Same screen, the reply under C4. W2. |
| A2 button "Mark a reply as pressure" (`act.actionpressure.label.action`) | A reply recorded | Asks "What kind of pressure" (legal, retaliation, discrediting, other) and "What it was"; C5 shows the mark. W2. |
| A3 button "Open a question from this" (`act.owed_actioninquiry.label.action`) | S2, S3 | `question` (new, in the action's project). W2. |
| A4 link "Place a hold" | A legal mark | `hold`. |
| A5 link "Draft a rule your profile lacks" | A legal mark | `grouprules`. |
| A6 "Change the law…" (act "Change the law it goes under") | always | Same screen, C6. W2. |
| A7 "Propose another law…" (act "Propose another law") | always | Same screen, the proposal under "Proposed, not chosen:". W2. |
| A8 button "Show the routes" (`act.procedureguides.label.action`) | always | Same screen, C7. W1. |
| A9 link "Prepare the text" | always | `request`. |
| A10 "Revise, with a reason…" (act "Revise the risk tier, with a reason") | always | Same screen, C9. W2. |
| A11 button "Move the action" (`act.actionmove.label.action`) | always | Same screen, the action's state changes; resolving needs C10. W2. |
| A12 button "Remind me" (`act.reminderset.label.action`) | always | Same screen. W1. |
| A13 button "Make the action confidential, or not" (`act.actionscope.label.action`; mock "Make confidential…") | always | Same screen, C1 shows `.scope.confidential` or `.scope.open`. W3. Before it is done: `act.actionscope.does` (protected). |
| A14 "Record the reply" (`.minutes.record`) | S5 | Same screen. W2. |

**Form messages** (under "When a reply is not recorded")

| Field | Condition | Message |
|---|---|---|
| V1 the day | not a real day | "The day is not a real calendar day. Write it as a day that exists, such as October 3, 2026." |
| V2 held from | both or neither | "A reply needs either the document itself or your account of it, and not both. Choose one and record again." |
| V3 silence | a document or account given | "A silence has no document or account to hold. Record it with its date alone." |
| V4 silence | no reply owed | "This action says no reply is owed, so a silence cannot be recorded. Change that on the action first if it is wrong." |
| V5 kind of reply | does not fit | `.that.kind.of.reply.does.not` + `.a.sending.is.a.request.a` |
| V6 outcome | missing or on a sending | `.a.decision.needs.what.it.decided` + `.choose.what.the.office.decided.or` |
| V7 fee | malformed | `.a.fee.quote.needs.an.amount` + `.fix.the.quote.and.record.again` |
| V8 office's date | no law | `.the.date.the.office.gave.needs` + `.add.the.law.first.or.leave` |
| V9 any line | a quotation mark, backslash, line break or too long | "A line has a quotation mark, a backslash or a line break, or is too long. Take them out and record again." |
| V10 any | another member recording | "Another member is recording on this action right now. Wait a moment and try again." |
| V11 reply (code form) | day or account empty | "Give the day the reply came first." (`.reply.at.needed`); "Say what the reply said first." (`.reply.account.needed`) |
| V12 pressure | empty | "Say what the pressure was first." (`.pressure.needed`) |
| V13 minutes | words not found; parts missing | `.minutes.notfound`; `.minutes.needed` |

---

## hold: "Litigation hold"

- **Address.** `/app/hold/<subject>`: an action id, or the place a hold is for. **Frame.** Working. Path: Projects › {project} › "Litigation hold".
- **Who can see it.** Any member who can see the action or the case. Anyone else: `unavailable`.
- **Purpose.** Where a legal threat reached the team and what it keeps because of it (`.purpose`).
- **Entry points.** `action`, `docket` and `counsel` (link "Place a hold").

**Content**
- C1. Heading "Litigation hold"; sub-line `.sub1` + `.sub2` ("A hold records that the team is keeping what a legal matter may reach. While a hold lasts, what it covers is not purged, a scheduled publication of it does not go out, and the doorbell clears nothing.").
- C2. Section "Where the pressure arrived" (`.where.heading`): each mark with no hold, as "A reply on an action" (`.reply`), "A docket entry", "Pressure recorded outside any action" (`.outside`) or "A counsel matter" (`.counsel.row`); "Marked as a legal threat by {member}" (`.marked`) · "No hold is placed for it yet." (`.nohold`).
- C3. Section "Place the hold": choice "The hold is for" (`.for.label`, help `.for.help1` + `.for.help2`); field "Why the team is keeping this" (`.reason.label`, help `.reason.help1` + `.reason.help2`); field "Other projects it should cover (optional)" (`.projects.label`); note "Any member who can see the action or the case may place a hold. You place it yourself; nobody has to approve it." (`.who` + `.who.own`); button "Place the hold, with a reason".
- C4. Section "Tell members what to keep" (`.tell.heading`): `.tell.inside` + `.tell.outside`; link "Prepare the hold notice" (`.notice.link`).
- C5. Section "Pressure that arrived outside any action" (`.press.heading`): field "What it was and how it arrived" (help `.press.help1` + `.press.help2`); button "Record pressure from elsewhere".
- C6. Section "Releasing a hold": note `.release` + `.release.form`; field "Why the team no longer needs to keep this" (`.release.reason`, help `.release.reason.help`); button "Release the hold, with a reason".

**States.** S1 the page as above (the design draws one state; which rows C2 lists depends on the record). S2 no mark without a hold: C2 lists nothing. S3 assistant unreachable: no "Help me write this" under C5.

**Actions**

| Control | When offered | Where it leads / weight |
|---|---|---|
| A1 button "Place the hold, with a reason" (`act.actionhold.label.hold`), primary | A mark chosen | Same screen; the mark no longer shows "No hold is placed for it yet." W2. |
| A2 link "Prepare the hold notice" | always | `holdnotice` for that hold. |
| A3 button "Record pressure from elsewhere" (`act.pressurerecord.label.hold`) | always | Same screen, the record added to C2. W2. |
| A4 button "Release the hold, with a reason" (`act.actionholdrelease.label.hold`) | A hold in place | Same screen. W2 in the design's table; irreversible in effect. Before it is done: `.release.form` ("… releasing cannot be undone."), the projects whose deletion restarts, and `consequence.actionholdrelease` "Releasing this hold restarts deletion for the projects shown beside this: their material may be purged again, and assistant transcripts for them past the time limit will be deleted on each member's device when it is next opened. This cannot be undone." (protected). |

---

## holdnotice: "Hold notice"

- **Address.** `/app/holdnotice/<the hold's place>`. **Frame.** Working. Path: Projects › {project} › "Hold notice".
- **Who can see it.** A member who can see the hold. Anyone else: `unavailable`.
- **Purpose.** The notice that tells members what to keep outside Civicsmith; the member sends it (`.purpose`).
- **Entry points.** `hold` (link "Prepare the hold notice").

**Content**
- C1. Heading "Hold notice"; sub-line `.sub1` + `.sub2` ("… You send it yourself; Civicsmith sends nothing.").
- C2. Section "The notice": field "The notice, as prepared" (`.label`, help `.help1` + `.help2`), drafted from the template; button "Prepare the notice"; note "A released hold prepares no notice." (`.released`).
- C3. Section "Sent by your own hand" (`.sent.heading`): `.sent.how` + `.sent.none`; the outward panel: tag "Outward · seen outside your team" (`screen.start-send.outward`), `.outward.1` + `.outward.2` ("The notice goes to the members you choose, by your own message. What it says about the matter leaves Civicsmith with it."); fields "The day you sent it", "How you sent it" ("An email", "A message", "In person", "Another way"; `.how.*`), "A copy of what you sent, or your account of it" (`.account.label`, help `.account.help`); button "Record that I sent it", primary.
- C4. Section "What is not recorded" (`.not.heading`): `.not.records` + `.not.nomember`.

**States.** S1 a hold in place (as above). S2 a released hold: `.released`; no notice is prepared. S3 assistant unreachable: no "Help me write this".

**Actions**

| Control | When offered | Where it leads / weight |
|---|---|---|
| A1 button "Prepare the notice" (`act.holdnoticeprepare.label.holdnotice`) | Hold in place | Same screen, C2 filled. W2. |
| A2 button "Record that I sent it" (`act.holdnoticesent.label.holdnotice`), primary | Notice prepared | Same screen, the sending recorded. W2, outward panel. Before it is done: the tag, `.outward.1` + `.outward.2`, `act.holdnoticesent.does`. |

---

## counsel: "Brief counsel"

- **Address.** `/app/counsel/<action id>`. **Frame.** Working. Path: Projects › {project} › Action › "Brief counsel".
- **Who can see it.** A member who can see the action; reading or saving a version needs sight of every project the packet draws on. Anyone else: `unavailable`.
- **Purpose.** A packet for the team's lawyer: what the record holds on one action, as it stands, for a claim or for a defense; never published or filed (`.purpose`).
- **Entry points.** Its address (the design draws no link to it on another screen; `start-send` says "A packet for a lawyer to read can be prepared beside this text." `screen.start-send.offer.counsel_packet`).

**Content (S1, a packet for a claim)**
- C1. Heading "Brief counsel"; sub-line `.sub` ("… It is never published and never filed.").
- C2. Section "Who it is for, and why" (`.who.heading`): "Counsel's name", "Counsel's organization"; note `.who.required` + `.who.optional`; choice "What the packet is for" ("Claim: a case the team may bring" / "Defense: pressure or a claim against the team"; help `.purpose.help1` + `2`); field "Why you are assembling it" (help `.reason.help1` + `2`).
- C3. Section "What the packet says about each matter" (`.matters.heading`): `.matters.each`, `.matters.determined`, `.matters.undetermined`, `.matters.nothing`; each matter "A determination is held: {state}" (`.matters.held`) or "Findings: {n} (checked and held: {checked}; unpublished: {unpublished})" (`.matters.findings`); note `.matters.other`.
- C4. Section "The exhibits, against the court's or office's standard" (as on `start-send` C7).
- C5. Section "If the action belongs to a counsel matter" (`.matter.heading`): `.matter.seen` + `.matter.hold`; link "Place a hold".
- C6. Section "How the packet is marked" (`.marked.heading`): "Prepared for review by {name}, {organization}. Not legal advice. Not for filing." (`filings.prepared_review_legal`); note `.marked.every` + `.marked.none`.
- C7. Button "Assemble the packet, with a reason", primary.
- C8. Section "Packets assembled for this action" (`.made.head`): `.made.lead`; each version "Version {n}" with "Assembled by {who}, {date}, for {counsel}, {organization}" (`.made.by`), the reason, "The record changed since version {n}: {what}" (`.made.changed`) or "Saved as a file by {who}, {date}, for {counsel}." (`.made.exported`); buttons "Read this version", "Save as a file"; disclosure with the sections ("The matters, each as the record stands", "Chronology", "Exhibits, with their fingerprints and grades", "Standards, candidate theories and remedies", "Deadlines") and `.sections.marking`; note `.export.note`.

**States**

| State | When | What shows |
|---|---|---|
| S1 a packet for a claim | "Claim" chosen | C1 to C8. |
| S2 a packet for a defense | "Defense" chosen | As S1, plus section "The statements challenged" (`.chal.heading`): `.chal.says`, "The statement, as your team made it", "Where it was said", link "Add another statement" (`.chal.add`); and section "Added for a defense" (`.defense.heading`): "Challenged statements" (`.defense.challenged`, rows "said in {where}" · `.defense.restson`), "Pressure received" (`.defense.pressure`, rows "a reply marked as a legal threat"), "Defense deadlines" (`.defense.deadlines`, rows "Date undetermined: no start event is recorded yet" `.defense.undetermined`), link "Place a hold". |

**Actions**

| Control | When offered | Where it leads / weight |
|---|---|---|
| A1 button "Assemble the packet, with a reason" (`act.counselpacket.label.counsel`), primary | A reason given | Same screen, a new version in C8. W2. |
| A2 button "Read this version" (`act.counselpacketread.label.counsel`) | A version listed | Same screen, that version's text. W2. |
| A3 button "Save as a file" (`act.counselpacketexport.label.counsel`) | A version listed | A file saved by the browser, marked on every page; C8 records "Saved as a file by …". W2. Before it is done: `act.counselpacketexport.does`. |
| A4 link "Place a hold" | S2, or a counsel matter | `hold`. |

**Form messages.** V1 counsel's name: required at tier 3 or with no tier (`.who.required`); refusal words come from `refusal.*`.

---

## grouprules: "Your team's own rules"

- **Address.** `/app/grouprules`. **Frame.** Working. Path: Settings › Places and offices › "Your team's own rules" (`.name`).
- **Who can see it.** Every member. A member confirms only a rule another member drafted.
- **Purpose.** A deadline or a legal fact the profile lacks, drafted by one member and applied only after another confirms it (`.purpose`).
- **Entry points.** `places` (links "Your team's own rules", "See the rules"); `action` (link "Draft a rule your profile lacks").

**Content**
- C1. Heading "Your team's own rules"; sub-line `.sub1` + `.sub2`.
- C2. Note `.note` + `.note2` ("A drafted rule does not take effect until a member other than its drafter confirms it. Until then it is shown as drafted, and no date or notice relies on it.").
- C3. Section "Waiting for a second member" (`.waiting`): each rule's name, "A deadline for {kind}" / "A legal fact for {kind}" (`.deadline.for`, `.fact.for`), "Drafted by {member}, {date}" or "Drafted by you, {date}" (`.drafted`, `.drafted.you`), its source as a link to `document`, "Set off by: {trigger}", "Requires: {requires}", "Citation: {citation}", "In effect from {date}" (`.row.*`), and button "Confirm this rule"; a rule the viewer drafted shows "You drafted this rule, so a different member has to confirm it." (`.self`) and no button. Note `.inprofile` + `.inprofile2`.
- C4. Section "What confirming asks of you" (`.confirm.heading`): `.confirm.says`, `.confirm.qual`, `.confirm.kept`; field "What qualifies you to confirm this rule (tier 2 or 3 only)" (`.qual.label`, help `.qual.help`).
- C5. Section "Rules in force" (`.inforce`): rows with "Confirmed by {member}, {date}" · "In effect for your team since then" (`.confirmed`, `.applies`) and button "Withdraw this rule, with a reason"; note `.withdrawn`.
- C6. Section "Draft a rule" (`.draft`): "What kind of rule" ("A deadline" / "A legal fact"; help `.kind.help1` + `2`); "Its name" (help `.name.help1` + `2`); fieldset "The deadline" (`.deadline.legend`): "The kind of action it applies to", "How long", "Counted in" (Days, Hours, Business hours, Months, Years), "Which days count" ("Every day" / "Business days only"), "Counted from" (`.trigger.start.*`), "Before or after it" ("After it" / "Before it"), "Who must act by then" ("The office", "Your team", "The source doesn't say"), "By what time on the last day" ("Any time that day", "Close of business", "A set time"); disclosure "For a legal fact, these instead of the deadline" (`.fact.summary`): "When it is shown" (`.trigger.fact.*`), "What it says", "The kinds of action it bears on" (help `.bears.help1`); "Its citation"; "In effect from"; fieldset "Where the source states it": "Its primary source" ("A capture your team holds" / "Capture the source first"), "The document that states it", "The passage" (help `.pass.help1` + `2`); "Why your team needs it" (`.why.label`); button "Draft the rule", primary; note `.machine` + `.machine2`.

**States.** S1 the page (the design draws one state; its lists depend on the record). S2 the viewer drafted a waiting rule: that row shows `.self` and no confirm button. S3 assistant unreachable: no "Help me write this" under "What it says"; `.machine`'s draft is not offered.

**Actions**

| Control | When offered | Where it leads / weight |
|---|---|---|
| A1 button "Confirm this rule" (`act.ruleconfirm.label.grouprules`) | A rule another member drafted | Same screen, the rule moves to C5. W2. |
| A2 button "Withdraw this rule, with a reason" (`act.rulewithdraw.label.grouprules`) | A rule in force | Same screen, the rule withdrawn. W2. |
| A3 button "Draft the rule" (`act.ruledraft.label.grouprules`), primary | always | Same screen, the rule in C3. W2. |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1 the passage | not in the document | "Those words are not in that document as written. Copy them exactly, or choose the document that holds them. Nothing was written." (`.pass.notfound1` + `2`), under "When it cannot be done yet" |
| V2 primary source | none held | `.src.refuse` ("Nothing was drafted: a team rule needs its primary source held here. Capture the source first, …") |

---

## matter: "{the act's title}"

- **Address.** `/app/matter/<determination id>`, with `~<escalation id>` for one escalation; `/app/matter/<project id>` for a project with no determination yet. **Frame.** Working. Path: Projects › {project} › "Matter" (`.name`).
- **Who can see it.** A member who can see the project. Anyone else: `unavailable`.
- **Purpose.** What the team is pursuing about one problem, from the first letter to the outcome (`.purpose`).
- **Entry points.** `project` (link "Matters"); `plan` (a matter in "Matters"); `dash-action`.

**Content (S1, the matter with a determination recorded)**
- C1. Heading: the act's title (data); sub-line its outcome and support, e.g. "noncompliant · established · against {rule}" (`.outcome.*`). "Recorded by {member} on {date}." and "It is your team's judgment, not a court's." (`.it_is_your_team_s_judgment_not`).
- C2. Button "Record a determination".
- C3. The stage ladder: "Documentation", "Notification", "Clock starts", "Response evaluation", "Legal tools", "Sustained attention", "Political accountability" (`.stage.1`-`.stage.7`), the current stage marked; "Proposed next: {stage}. Civicsmith proposes; a member decides." (`.proposed`); "It ends only when both hold" (`.endswhen`): "compliance restored", "consequences addressed".
- C4. Section "Consequences: what the breach did" (`.what_the_breach_did`): each part with how it is known ("computed", "assessed", "undetermined" `.known.*`); note `.neverzero`.
- C5. Buttons "Start the response clock" (`.advance_to_clock_starts`), "Decline to escalate, with a reason", "Open an escalation", "End", "Stop pursuing, with a reason", "Reopen where it stopped".
- C6. Disclosures, each with its refusal: "When it cannot be ended: compliance is not restored" (`.compliance_is_not_restored_why` + `.an_escalation_ends_only_after_your_team` + `.record_it_then_end_the_escalation`); "When it cannot be ended: the consequences are not settled" (`.whether_the_consequences_are_addressed_is_undetermined` + `.if_your_team_judges_the_breach_had`); "When it cannot be ended: the consequences are not addressed" (`.the_consequences_are_not_addressed_why` + `.say_with_evidence_that_each_part_was`).

**States**

| State | When | What shows |
|---|---|---|
| S1 with a determination | A live determination | C1 to C6. |
| S2 no determination yet | Project address, none recorded | Sub-line "No determination yet" (`.nodet`); section "Where this matter stands" (`.where_this_matter_stands`): `.your_team_has_not_yet_said_whether` + `.what_a_breach_did_and_every_stage`, button "Record a determination", primary; section "Not available yet" (`.unavailable`): "Opening an escalation" · `.needs_a_recorded_determination_that_the_act`; "Saying what the breach did" (`.saying_what_the_breach_did`) · "Needs the same determination."; `.attaching_an_action_holding_at_a_stage` · `.needs_an_escalation_which_needs_the_same`; disclosure "When the determination is compliant or unclear" with `.an_escalation_pursues_a_breach_so_it` + two sentences. |
| S3 recording a determination | After "Record a determination" | Heading "Record a determination", sub-line `.whether_the_act_met_the_rule_with`. Sections "The act" (`.act`: "The event it was part of", "Role that acted", "Office or body" with help `.f.body.help`, "The evidence that the act happened"; disclosure "When the project has no dated event" `.event.none`); "What it rests on" ("Published findings", note `.a_determination_rests_on_findings_your_team`, a concluded question "Concluded. It becomes a finding once a case that carries it is published." `.concluded.unpublished`; disclosure "When no finding is published yet" `.determine.needscase`); "The rule it is measured against" ("Rule", "What the rule requires", "What was done", "How the two compare": Matches, Differs, Open); "Your determination" (`.f.determination`: "Against this rule, the act is" Compliant / Noncompliant / Unclear; note `.each_rule_gets_its_own_outcome` + `.they_are_never_combined_into_one_verdict`; disclosure "If you choose unclear" with "The question that would settle it"); "Why it happened (optional)" ("Cause"; note two sentences). Button "Record this determination" (`.record.this`), primary. Line "This cannot be edited afterward. A mistake is put right by recording a new determination that replaces it, with a reason." |
| S4 revising a determination | A determination exists | Heading "Revise the determination" (`.revise`), sub-line `.a_new_determination_that_replaces_the_earlier`; section "What it replaces" (`.replaces`) with the earlier one, note `.the_earlier_determination_stays_readable_with_a` + `.it_is_not_edited`, field "Why this replaces it"; then S3's form; button "Record the revised determination". |
| S5 what the breach did | Recording consequences | Heading "Consequences: what the breach did", sub-line `.each_part_says_what_was_done_and`. Section "Parts recorded" (`.parts`), each part with "Revise a consequence, with a reason"; note `.a_part_your_team_assesses_is_never`. Section "Record what the breach did": "The rule it breached", "Who or what was affected" (`.kind.*`), "Describe them", "What it is measured in" (`.unit.*`), "Amount, or the lowest and highest it could be", "From", "To", "How you know" ("Worked out from figures in the record", "My own assessment, with my reason", "Not known yet"), disclosure "If you assess it yourself" ("Your reason"), "The question showing the harm follows from the breach", note `.without_a_concluded_question_the_part_is` + `.zero_is_recorded_as_no_harm_claimed`; button "Record what the breach did", primary. Section "Revise the second part" with "Why you are revising it". |
| S6 saying a consequence was addressed | One part | Heading "Say whether a consequence was addressed"; sub-line `.one_part_at_a_time_with_evidence`. Section "The part" (`.f.part`): "This part was" Addressed / Not addressed; "In what way (addressed only)": Remedied, Mitigated, Compensated, Acknowledged, "Can't be undone" (`.way.cannot`); "Evidence"; "Your reason"; button; note `.there_is_no_percentage_of_redress` + `.part_of_a_remedy_does_not_end`. |
| S7 recording a success | A change brought about | Heading "Record a success"; sub-line `.a_change_the_matter_brought_about_in`. "What changed", "When it changed" (`.f.when`), "Evidence", "The order of events (optional)" (note `.the_order_of_events_is_shown_as`), disclosure "If you say why it happened" ("Cause", note `.your_team_s_own_act_cannot_be`); button "Record what this matter achieved". |
| S8 an escalation at the notification stage | Escalation open, stage 2 | Sub-line "Notification stage · open". Section "Attach an action to this stage": "Action", "Your reason for attaching it", button; disclosure "At the political accountability stage" ("Its purpose" `.f.purpose.*`, "The rule it seeks enforced", note `.only_a_breach_action_that_rests_on`). Section "Starting the response clock is proposed": `.the_notice_was_sent_so_clock_starts` + `.you_can_move_to_it_or_hold`; "Why you are holding at this stage"; buttons "Start the response clock", "Hold at this stage, with a reason"; note `.holding_keeps_the_proposal_in_view_with` + `.the_escalation_stays_open`. Section "Pause it" (`.pause`): "Why you are pausing it", button "Pause, with a reason", note `.a_suspended_escalation_proposes_no_stage` + `.it_is_not_ended_and_any_deadline`. |
| S9 an escalation at the response evaluation stage | Stage 4 | Sub-line "Response evaluation stage · open". Section "Record the government's response": "The response you are reading", "Your reading" (Complied, Partly complied, Denied, No response by the deadline), "Your reason", button, note `.a_reading_of_complied_does_not_end` + `.it_ends_only_when_compliance_is_restored`. |
| S10 a paused escalation | Escalation paused | Sub-line "Notification stage · paused since {date}". Section "Paused": `.no_stage_is_proposed_while_it_is` + `.nothing_already_recorded_is_lost`; "Why you are resuming it (optional)"; button "Resume", primary. |
| S11 assistant unreachable | No AI account | No "Help me write this" under any own-words field. |

**Actions**

| Control | When offered | Where it leads / weight |
|---|---|---|
| A1 "Record a determination" (`act.determine.label.matter`) | S1, S2 | S3 (S4 when replacing). The form's button records it and returns to S1. W2. |
| A2 "Open an escalation" (`act.escalationopen.label.matter`) | Noncompliant determination | S8 for the new escalation. W2. |
| A3 "Start the response clock" (act "Advance") | A stage proposed | Same screen, the next stage marked. W2. |
| A4 "Decline to escalate, with a reason" (`act.declinetoescalate.label.matter`) | Noncompliant, no escalation | Same screen: "The team declined to escalate: {reason}" (`.declined`). W2. |
| A5 "End" (`act.escalationend.label.matter`) | Escalation open | Same screen, state "ended" (`.escstate.ended`); or a C6 refusal. W3. Before it is done: `act.escalationend.does` "Ends the escalation, with how it ended." (protected). |
| A6 "Stop pursuing, with a reason" (`act.escalationstoppursuing.label.matter`; mock "Stop pursuing…") | Escalation open | Same screen, state "stopped pursuing". W3. Before it is done: `act.escalationstoppursuing.does` (protected). |
| A7 "Reopen where it stopped" (`act.escalationreopen.label.matter`) | Stopped | Same screen, "open". W2. |
| A8 "Record what the breach did" (`act.consequencerecord.label.matter`) | S5 | S1 with the part in C4. W2. |
| A9 "Revise a consequence, with a reason" | A part recorded | Same screen. W2. |
| A10 "Say whether a consequence was addressed" | S6 | S1. W2. |
| A11 "Record what this matter achieved" (`act.successrecord.label.matter`; mock "Record a success") | S7 | S1. W2. |
| A12 "Attach an action to this stage" | S8 | Same screen. W2. |
| A13 "Hold at this stage, with a reason" (`act.escalationdecline.label.matter`) | A stage proposed | Same screen. W2. |
| A14 "Pause, with a reason" (`act.escalationsuspend.label.matter`) | Open | S10. W2. |
| A15 "Resume" (`act.escalationresume.label.matter`) | S10 | S8 or the stage it was at. W1. |
| A16 "Record the government's response" (`act.escalationevaluate.label.matter`) | S9 | Same screen. W2. |

**Form messages** (each under its disclosure; each ends "Nothing was recorded.")

| Field | Condition | Message |
|---|---|---|
| V1 determination | finding, rule, role, body or evidence missing | `.it_needs_at_least_one_published_finding` + `.add_what_is_missing_then_record_it`, under "When it cannot be recorded" |
| V2 rule | does not bind the office | `.noncompliant_is_recorded_only_against_a_rule` + `.if_this_rule_does_not_bind_it` |
| V3 rule | not in force | `.the_rule_was_not_in_force_when` + `.choose_the_rule_that_was_in_force` |
| V4 unclear | no question | `.unclear_needs_at_least_one_question_that` + `.write_the_question_then_record_it_again` |
| V5 cause | no evidence | `.a_cause_is_recorded_only_when_evidence` + `.add_the_evidence_or_leave_the_cause` |
| V6 seriousness | says how serious or what to do | `.a_determination_says_what_was_required_what` + `.it_does_not_say_how_serious_the` + `.propose_an_action_for_that` |
| V7 revision | reason missing; already replaced | `.a_new_determination_that_replaces_an_earlier` + `.write_the_reason_then_record_it_again`; `.an_earlier_determination_is_replaced_only_once` + `.replace_the_newest_one_instead` |
| V8 consequence | wrong rule; figure; named person | `.a_consequence_is_what_a_breach_did` + `.choose_such_a_rule_or_record_the`; `.a_figure_is_worked_out_only_from` + `.name_the_figures_or_assess_it_yourself`; `.a_named_person_must_appear_in_a` + `.choose_the_passage_that_names_them_or` |
| V9 addressed | evidence or reason missing | `.whether_a_part_was_addressed_is_said` |
| V10 success | statement, date or evidence missing; own act only | `.a_success_needs_a_statement_a_real`; `.evidence_that_your_team_s_own_letter` + `.add_evidence_from_elsewhere_or_leave_the` |
| V11 attach | wrong action or stage; already attached; office wrong kind | `.only_an_action_that_states_a_breach` + `.choose_such_an_action_or_move_the`; `.that_action_is_already_attached_to_an`; `.an_official_request_goes_to_an_elected` + `.choose_a_purpose_that_fits_the_office` |
| V12 hold at stage | nothing proposed | `.stage_3_is_not_proposed_yet_missing` + `.there_is_nothing_to_hold_at` |
| V13 pause / resume | already paused; not paused | `.this_escalation_has_been_suspended_since_october` + `.resume_it_before_suspending_it_again`; `.this_escalation_is_open_not_suspended_so` |
| V14 response | nothing to read; wrong stage | `.a_reading_other_than_no_response_names` + `.choose_the_reply_or_choose_no_response`; `.a_response_is_read_at_stage_4` + `.this_escalation_stands_at_stage_2` |

---

## Differences seen in the code

- `plan`, assistant unreachable: the code draws nothing where the design shows the note `.nosuggestions` (bio-plane/src/screens-action/plan.mjs:457).
- `plan`: the code draws none of the design's explanatory tips `screen.plan.tip.*` and no `.purpose`; several design sentence keys (`.decide.the.options.you.picked`, `.what.to.do.with.them`, `.a.scenario.is.a.story.of`, `.name.of.the.scenario`, the `.when.*.not.*` disclosures) are not read by the screen (bio-plane/src/screens-action/plan.mjs).
- `start-send`: the design's `.secondapproval` note and the six later kinds `.kind.records_petition` … `.kind.constitutional_claim` are not read; the template refusal sentences are not read (bio-plane/src/screens-action/start-send.mjs).
- `action`: the code draws a link to `counsel`, which the design's `action` does not draw (bio-plane/src/screens-action/action.mjs:516).
- `action`: the design's reply-refusal disclosure "When a reply is not recorded" (V1 to V10) and the "How it ended" words `.ended.*` and `.resolution.said.*` are not read by the screen (bio-plane/src/screens-action/action.mjs).
- `counsel`: the code has no section "Packets assembled for this action" and no acts "Read this version" or "Save as a file"; only `counselpacket` (bio-plane/src/screens-action/counsel.mjs:84-88).
- `glossary`: the term names are read from `glossary.term.<t>` keys, not `.money.<t>.name` / `.honest.<t>.name` (same English) (bio-plane/src/screens-settings/glossary.mjs:19).
- `matter`: the design's refusal disclosures (V1 to V14) and the success heading words are not read by key (bio-plane/src/screens-action/matter.mjs).
- `request`: the state words `.state.offices`, `.state.nooffice` and `.law.help` are not read (bio-plane/src/screens-action/request.mjs).

## Changes

- 22 Nov 2026: written.
