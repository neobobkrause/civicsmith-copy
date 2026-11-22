Length: 498 lines. Last section: "Changes".

# Screens: Deciding and acting

Page `deciding-and-acting` of the Screens document (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

Matters, plans and actions: plans, starting and sending, records requests, actions, holds, counsel, the team's own rules, and matters. What binds every screen (frames, rail, refusals, the assistant dock, the read-only note) is on the page "Every screen".

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
- Every screen here is in the working frame: a visitor without a session is shown `front` and the address is kept. A member who cannot see the project the subject belongs to is shown `unavailable` ("You can't open this", `shell.unavailable.notyours.title`). A member who may read and not act sees the note `shell.readonly` ("You can read this {noun} and cannot act on it. What each member may do is set under {members}.") and no act buttons. A member invited to the project but not joined sees, under the disclosure "If you were invited and have not joined yet", `refusal.PROJECT_ACT_NOT_A_PARTICIPANT.invited` ("You have been invited to this project but have not joined it yet, … Nothing was changed.") and button "Join" (`act.projectjoin.label.<id>`, W1), which joins the project and leaves the member on the same screen.
- Without an AI account (the walk's case) the assistant is absent, not greyed: "Help me write this" (`act.writinghelp.label.<id>`) is not drawn under any field, and no machine-drafted text or machine proposal is drawn.

---

## plan: "Action plan"

- **Address.** `/app/plan/<plan id>` for one plan; `/app/plan/<project id>` for a project's plans.
- **Frame.** Working. Path: Projects › {project} › "Action plan" (`screen.plan.name`).
- **Who can see it.** A member who can see the project. Anyone else: `unavailable`.
- **Purpose.** What to do about a problem and in what order (`.purpose`).
- **Entry points.** `project` (its plans); `question` (a plan's title as a link, and "Plan what to do"); the queue; this screen's list (S2).

**Content (S1, one plan)**
- C1. Heading: the plan's title (data). Sub-line: the state "Open" / "Paused" / "Closed" (`.state.open`, `.state.paused`, `.state.closed`) and "opened {date} by {name}" (`.opened`). A closed plan adds "Closed: {reason}" (`.closedwhy`).
- C2. Checks strip: "Checks · {n}" (`.checks`), then one line per check, e.g. "Scenario {scenario}: no branch answers a hostile response (refusal, obstruction, retaliation) to {item}." (`.check.hostile`).
- C3. Section "Matters" (`.matters`), help `.matters.holds`. Each matter numbered, with its support: "Assumed: not shown yet" (`.support.hypothetical`), "established" (`.support.established`), "short of established" (`.support.short`) or "undetermined" (`.support.undetermined`); its source "from the question "{title}" ({status}, {date})" (`.subject.from`); its escalation "escalation: {stage}" (`.escalation`). Button "Add a matter" (A1).
- C4. Section "Options" (`.options`): sort line "Sort by {column}" (`shell.sort`) over "Category", "Legal deadline", "Matter", "Disposition" (`.col.*`); a row per option with a pick checkbox, summary, category (`.category.*`) and disposition ("undecided", "chosen", "declined", "done", "blocked"; `.disposition.*`) with any reason. Below: `.an.option.is.undecided.chosen.declined` + `.declined.and.blocked.each.keep.their` + `.any.option.can.be.returned.to`.
- C5. Disclosure "Add an option" (A2): note `.one.thing.the.team.could.do`; fields "In a line, what the option is", "More about it (optional)", "What kind of option" (Mitigation, Legal, Awareness, Journalistic, Grassroots, Other), "The matters it serves", "Who it is directed to" (help `.never.a.private.individual`), "The role", "The body or organization", "Dates that bind it" ("The date", "Because: the law, order or commitment", link "Add another date"), "How careful to be (legal options only)" ("Not assessed yet", "1 · file freely", "2 · file with caution", "3 · do not file without counsel"), "Seeking enforcement" and "The requirement it seeks".
- C6. Disclosure "Decide the options you picked": note `.each.decision.is.recorded.with.who` + `.nothing.here.starts.an.action`; radio "What to do with them" ("Choose them", "Decline them", "Mark them done", "Mark them blocked", "Return them to undecided"); field "Why (required to decline or to mark blocked)"; "Remind me as a date comes near" with "Which date" and "Remind me on".
- C7. Button "Start…" (A6), the primary act.
- C8. Section "Scenarios" (`.scenarios`): a tab per scenario; each phase "{item} → checkpoint: "{checkpoint}" (judged by a member, once it is due)" (`.phase.checkpoint`) with button "Judge" or "You can judge this checkpoint from {date}." (`.judge.notdue`). Disclosure "Lay out a scenario": "Name of the scenario", and per phase "Name of the phase", "Options in this phase", "When it starts", "Which phase", "Check back after (days)", "What the checkpoint tests", "If the checkpoint is met, go to", "If it is not met, go to"; link "Add another phase".
- C9. Section "Started" (`.startedsec`), help `.startedsec.holds`: each started option's action with its state (`.actionstate.*`: planned, active, awaiting a response, resolved, abandoned) and "Open the action" (`.openaction`); an untaken checkpoint "nobody has taken it up" (`.item.untaken`) with "Take this up" (`.takeup`).
- C10. Button "Close plan…" (`.close`).

**States**

| State | When | What shows |
|---|---|---|
| S1 one plan | Address names a plan | C1 to C10. |
| S2 a project with several plans | Project address | Heading "Action plans" (`.list.title`); section "This project's action plans" (`.list`, help `.list.help`); a row per plan: title, state, "opened {date} by {name}"; over 200: `.list.more`. |
| S3 a project with no plan | Address names a project with none | Heading "Action plans"; note "This project has no action plan yet. To start one, choose “Plan what to do” under the project's questions, or on one question's own page." (`.none`). |
| S4 closed plan | Closed | C1 "Closed" and `.closedwhy`; no add, decide, start, scenario or close control; closed empty: `.empty`. |
| S5 assistant at work | After A3 | Tray: `.ask.running`; asked twice `.ask.already`; finished `.ask.ended`. `AI` |
| S6 assistant unreachable | No AI account (the walk) | No tray "Suggested by the assistant · not yet in the plan" (`.suggested`), no "Ask the assistant for options", no "Help me write this"; the design shows the note `.nosuggestions` ("No options are suggested yet: none of this project's matters has a route to suggest from."). |

**Actions**

| Control | When offered | Where it leads / weight |
|---|---|---|
| A1 button "Add a matter" (`act.plansubjectadd.label.plan`) | Open plan | Same screen, the matter added under C3. W2. |
| A2 button "Add an option" (`act.optionadd.label.plan`) | Open plan | Same screen, the option added to C4. W2. |
| A3 button "Ask the assistant for options" (`act.planask.label.plan`) | Open plan, assistant reachable | Same screen, S5. W1. `AI` |
| A4 button "Adopt" (`.adopt`; act "Adopt a suggestion") | A suggestion in the tray | The suggestion becomes an option in C4. W2. `AI` |
| A5 buttons "Choose", "Decline", "Mark done", "Mark blocked", "Return to undecided" (`.choose`, `.decline`, `.dispose.*`) | Options picked | Same screen; dispositions change in C4. W2. |
| A6 button "Start…" (`act.optionstartpreview.label.plan`) | A chosen option is picked | `start-send` for that option. W1. |
| A7 button "Lay out a scenario" (`act.scenarioset.label.plan`) | Open plan | Same screen, C8 shows the scenario. W2. |
| A8 button "Judge" (act "Judge a checkpoint") | A due checkpoint | Asks "How did it turn out?" ("met" / "not met") and "A note (optional)"; the phase shows the result. W2. |
| A9 button "Take this up" (`.takeup`; act "Take an item up yourself") | An untaken item in C9 | Same screen: "You took this up." (`.tookup`). W2. |
| A10 button "Close plan…" (`.close`; act "Close the plan") | Open or paused plan | Asks how it ended, then S4. W3. Before it is done: `act.planclose.does` "Closes the plan, with how it ended. It stays readable." (protected). |
| A11 a plan's title in S2 | S2 | `plan` for that plan (S1). |
| A12 "Open the action" (`.openaction`) | A started option | `action`. |

**Form messages.** V1 option line empty or over 200 characters: `.an.option.needs.a.line.saying` ("An option needs a line saying what it is, up to 200 characters."). V2 no matter: `.choose.at.least.one.matter.the` + `.an.option.cannot.serve.a.matter`. V3 tier on a non-legal option: `.a.tier.belongs.only.on.a`. V4 lobbying without a requirement: `.an.option.marked.as.lobbying.must`. V5 date without basis: `.a.date.needs.the.law.order`. V6 a private individual: `.an.option.can.be.directed.to`. V7 the press: `.press.empty.role` / `.press.empty.organisation` / `.press.empty.both`. V8 declining or blocking without a reason: `.declining.an.option.or.marking.it`. V9 reminders: `.reminders.are.set.only.when.you`; `.a.reminder.names.a.date.the`. V10 nothing picked: `.pick.at.least.one.option`. V11 closed plan: `.this.plan.is.closed.so.its`. V12 phases: `.a.phase.can.hold.only.options`; `.following.when.each.phase.starts.leads`; `.a.phase.points.to.a.phase`; `.a.phase.needs.a.name.the`. Each message is followed by its second sentence. Each group of messages sits under a disclosure: "When an option is not added", "When a decision is not recorded", "When a scenario is not laid out".

---

## start-send: "Start “{option}”"

- **Address.** `/app/start-send/<plan id>~<option id>` before the action exists; `/app/start-send/<action id>` after.
- **Frame.** Working. Path: Projects › {project} › Action plan › "Start and send" (`.name`).
- **Who can see it.** A member who can see the project. Anyone else: `unavailable`. An invited, unjoined member: the note and "Join" (see "How to read").
- **Purpose.** Start an option from a plan and send it (`.purpose`).
- **Entry points.** `plan` "Start…"; `action` (an approved, unsent action opens here at its step).

**Content (S1, a records request)**
- C1. Heading "Start “{option}”" (`.title`); once started "The action started" (`.titlestarted`). Sub-line "Nothing runs until you confirm. This is what the action will say and rest on." (`.nothingruns`).
- C2. Section "Step 1 · Start" (`.step1`): "Kind" (`.kind.*`), "Addressed to" (the office as a card, or "nobody named yet" `.noaddressee`), "Rests on" (or "no matter"), "Clock" ("{days} days, from the law your profile names" `.clock.law`, or `.noclock`), "Asserts a breach" ("no" / `.breach.yes`).
- C3. Choice "The team's contact for this action (optional)" (`.contact.label`; first option "No one yet" `.contact.none`; help `.contact.help1`-`.contact.help3`).
- C4. A start that would be refused: "Would be refused" (`.wouldrefuse`), the reason, `.resolve`, "Proceed anyway, with this reason (optional)" (`.override`).
- C5. Section "Step 2 · Prepare and send" (`.step2`): field "What the team sends" (`.text`) with its origin line `.draft.template` or `.draft.own`, filled blanks "{name}: {value} (from {source})" (`.blank`) and "Still to fill: {names}" (`.unfilled`).
- C6. "Sent with" the team's statement, and "In this matter" the project's stake (data).
- C7. Section "The exhibits, against the court's or office's standard" (`.exhibits.heading`): intro `.exhibits.intro1`-`3`; each exhibit "captured {date}", its grade and `.exhibits.accepted`, `.exhibits.contestable1`+`2`, `.exhibits.below1`+`2` or "Grade not determined" + `.exhibits.undetermined`; disclosure "When the court's or office's standard is not stated".
- C8. Section "A sentence the record contradicts" (`.release.head`), the sentence, field "Why you release it" (`.release.why`, help `.release.why.help`), button "Release this sentence" (`act.release.label.start-send`); once released "Released by {who} on {date}: {reason}" (`.release.done`).
- C9. Notes `.approvefixes` ("Approving fixes the text.") and `.nosend` ("Your team's Civicsmith sends nothing: …, then record it here."); with a second approval needed, `.waitsecond`.
- C10. The outward panel: tag "Outward · seen outside your team" (`.outward`), `.outward.says`; "The day you sent it" (help "Reply deadlines count from this day."), "How you sent it", "The office's reference for it (optional)"; button "I have sent it · record the sending" (`.recordsent`).
- C11. Once recorded: "Recorded as sent on {date}" (`.sent`), "reference {reference}", `.sent.next`, link "Open the action".
- C12. Section "Keep this filing as your team's template" (`.template.heading`): `.template.note1`-`3`; "The template's name", "What it is for" ("A filing" / "A brief for counsel"), "Notes for the team (optional)"; button "Keep as a template".

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
| A6 button "Approve this text" (`act.filingapprove.label.start-send`) | Text prepared | Same screen; text fixed. W3. Before it is done: `consequence.filingapprove` ("Approving makes this text yours, … what is sent is the text you approved.") and `act.filingapprove.does`, both protected. |
| A7 button "Give the second approval" (`act.filingsecondapprove.label.start-send`) | S4, a member other than the first approver | Same screen. W3. `act.filingsecondapprove.does` (protected). |
| A8 button "I have sent it · record the sending" (`.recordsent`) | Approved | S5. W2, Outward. Before it is done: C10's tag and `.outward.says`; `act.filingrecordsent.does` ("Records that you sent it, when and how. Civicsmith never sends for you; …", protected). |
| A9 button "Release this sentence" (`act.release.label.start-send`) | A contradicted sentence | Same screen, C8 shows the release. W3. |
| A10 button "Keep as a template" (`act.templatesave.label.start-send`) | Filing approved | Same screen. W1. |
| A11 button "Save this action's stake" | S2 | Same screen. W1. |
| A12 "Open the action" (`.openaction`) | S5 | `action`. |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1 contact | not a member | `.contact.refused.body1` + `2` ("The contact must be a member of your team. …"), under "When the contact is not a member" |
| V2 text | empty | "Write what is sent first." (`.text.needed`) |
| V3 day sent | empty | "Give the day you sent it first." (`.sentat.needed`) |
| V4 how sent | empty | "Say how you sent it first." (`.how.needed`) |
| V5 template | not approved; name taken; needs counsel | `.template.refused.unapproved1`; `.template.refused.taken1`; `.template.refused.tier1` (each with its second sentence) |

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
- **Purpose.** Start an action of any kind (`.purpose`).
- **Entry points.** `request` (link "Start another kind of action"); `project`.

**Content**
- C1. Heading "Start an action"; sub-line "Something your team does to get an answer, a record or a decision from someone." (`.sub`).
- C2. Choice "What kind of action" (`.kind`, help `.kind.help`): the kinds the record knows (`screen.start-send.kind.*`) and "Another kind" (`.kind.other`).
- C3. Note "A records request has its own steps, which work out the law and the due date for you." (`.records`), link "Request records" (to `request`).
- C4. Section "Who it goes to" (`.to`): radio "A named office or public body" / "Not determined yet"; "Who"; button "Choose the office"; "What is known so far, and what would settle it"; note `.to.unsent`.
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
- **Purpose.** Ask an office for records under the law (`.purpose`).
- **Entry points.** The wizard "Get a record" (from `finder`); `actionnew` (link "Request records"); `action` (link "Prepare the text"); `project` (link "Records requests"); the queue ("Pick up where you left off").

**Content (S1, offices are known)**
- C1. Heading "Request records"; sub-line "Look first: if the record is public, capture it instead." (`.lookfirst`); the wizard mark "Get a record".
- C2. Note "Asking for something other than records?" (`.other`), link "Start another kind of action" (`.other.go`).
- C3. "Which name the records concern" (`.subject.label`); "The office that holds the records" (`.office`, options "… · held today by {holder}"); button "Choose the office".
- C4. Field "What records you want, in plain words" (`.what`, help `.what.help`); button "Start the request".
- C5. Choice "The law it goes under" (`.law`; options `.law.option` with `.window.calendar` / `.window.business`); button "Choose the law it goes under"; link "How a records request works" (to `help-records`).
- C6. "Records from", "to", "In what form" (`.form.*`), "Tell us first if copies cost more than" (`.cost`).
- C7. Field "The request" (`.text`, help `.text.help`), drafted from the team's template; note `.describe`.
- C8. "Sent with" the team's statement; "In this matter" the stake; disclosure "When the stake can't be read".
- C9. Buttons "Prepare the text" and "Approve this text".
- C10. Section "How to send it" (`.howsend`): four numbered steps `.howsend.1`-`.howsend.4`.
- C11. Outward panel: tag "Outward · seen outside your team" (`screen.start-send.outward`), `.outward` ("Sending this tells the office what your team is looking at, and the portal shows the request's text to anyone. …"), "The portal's request number" (`.reference`), button "I have sent it · record the sending".

**States**

| State | When | What shows |
|---|---|---|
| S1 offices are known | Offices hold such records | C1 to C11. |
| S2 no office is known yet | None known | In place of C3 to C11: `.nooffice` + `.nooffice.admin`; disclosure "Name the office yourself" (`.nameoffice.head`, note `.nameoffice.note`; "The agency", "The office within it", "Where requests go", "The law it goes under", "Why you are naming this office"; button "Use this office"); `.nooffice.pointer.a` + `.b`; links "The office's page" (`person`) and "Places and offices" (`places`). |
| S3 assistant unreachable | No AI account | The request text is the template's, never a machine draft. |

**Actions**

| Control | When offered | Where it leads / weight |
|---|---|---|
| A1 link "Start another kind of action" (`.other.go`) | always | `actionnew`. |
| A2 button "Choose the office" (`act.addresseesuggest.label.request`) | S1 | Same screen, offices suggested. W1. |
| A3 button "Start the request" (`act.actioncreate.label.request`) | Office and records given | Same screen at `/app/request/<action id>`. W2. |
| A4 button "Choose the law it goes under" (`act.actionlaws.label.request`) | Started | Same screen. W2. |
| A5 button "Prepare the text" (`act.communicationprepare.label.request`) | Started | Same screen, C7 drafted. W2. |
| A6 button "Approve this text" (`act.filingapprove.label.request`) | Text prepared | Same screen; text fixed. W3. Before it is done: as `start-send` A6. |
| A7 button "I have sent it · record the sending" (`act.filingrecordsent.label.request`) | Approved | `action`. W2, Outward. Before it is done: C11's tag and `.outward`; `act.filingrecordsent.does` (protected). |
| A8 button "Use this office" (`act.entitycreate.label.request`) | S2 | S1 with the office chosen, marked "Named by a member" (`.nameoffice.mark`). W2. Before it is done: `consequence.entitycreate` (protected). |
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
- **Purpose.** One action: what was sent, to whom, and what came back (`.purpose`).
- **Entry points.** `plan` ("Open the action"); `start-send` and `request` after the sending; the queue (an overdue reply); `projects`; `dash-action`.

**Content (S1, waiting on a reply)**
- C1. Heading: the kind (`.kind.*`) and title; sub-line "to {office}" · "sent {date} by {who}". Where they apply: `.confidential`, `.unsent` with link "Pick up where you left off" (`.pickup`), `.held`.
- C2. Due line "Response due {date}" and "Waiting on {office}'s reply" (`.waiting`).
- C3. Section "Due dates" (`.dates`), help `.dates.holds`: each date with its state "pending", "met", "overdue, as a member determined", "waived" (`.clock.*`), linking to `due-date`.
- C4. Section "Replies" (`.replies`): each reply dated, "received" or "no response"; note `.a.recorded.reply.stays.on.the` + `.it.is.never.edited.or.removed`; the reply form ("What came back", "The day it came, or the day the reply was due", "How it came", "Who it came from", "What you record it from", "Your account of the reply", "The document that holds the reply"), disclosures "Where this reply stands in the request" (kind `.reply.stage.*`, "It follows", outcome `.reply.outcome.*`, exemptions, the office's date and its law) and "If the reply quotes a fee"; buttons "Record a reply", "Mark a reply as pressure".
- C5. Section "Pressure on this action" (`.pressuremarks`): each mark "a reply marked as a legal threat by {member}" (`.legalmark`) · `.holdnone`; a profile fact "From your jurisdiction's profile"; note `.profilefact.shown` "Legal information, not legal advice" (`guide.procedure.legalinfo`); links "Place a hold" (`.hold.link`), "Draft a rule your profile lacks" (`.rule.link`).
- C6. Section "The law it goes under" (help `law.help`): the law and who stated it; "Proposed, not chosen:" (`law.proposed`); "Choose a law"; "Change the law…" (`law.change`), "Propose another law…" (`law.propose`); with none in the places: `.law.none`.
- C7. Section "How this kind of action goes" (`.guide.heading`): "From your jurisdiction's profile" · `.guide.order` · "Legal information, not legal advice"; each route "Expect: {expectation}" · "Source: {citation}"; note `.guide.sourced` + `.guide.team` + `.guide.teamnone`; button "Show the routes"; none: `.routes.none`.
- C8. Section "Templates for this action" (`.templates.heading`): `.templates.offered` + `.templates.nocourt`; rows "approved by {member}, {date}" or `.templates.notyet`; note `.templates.own` + `.templates.never`; link "Prepare the text" (to `request`).
- C9. Section "Its risk" (`risk.title`): "Tier {n} · …", who set it and why; button "Revise, with a reason…" (`risk.revise`).
- C10. Disclosure "How it ended" (`.ended.*`: "The office complied", "The office denied it", "It was escalated", "Your team withdrew it", "Your team carried it out"), "In your own words" (`.ended.own`). Buttons "Move the action", "Remind me", and the confidentiality act.

**States**

| State | When | What shows |
|---|---|---|
| S1 waiting on a reply | Sent, reply not yet due | C1 to C10. |
| S2 the date passed with no reply recorded | Due date passed | "No reply recorded by {date}" (`action.noreply.title`, protected), `action.noreply.says`, button "Open a question from this". |
| S3 asking about the silence | After choosing to ask | Section "Ask about the silence" (`.ask.heading`): `action.noreply.question.help`; "Your question"; button "Open a question from this". After: `.ask.done` and link "Open the question". |
| S4 a member who may read and not act | Read-only member | The read-only note; no button and no act row anywhere. |
| S5 recording a reply to a request for comment | A public comment | Section "Record a reply to your team's public comment" (`.minutes.heading`, `.minutes.says`): "The meeting", "The meeting's date", "The document that holds the minutes", "The passage"; button "Record the reply"; disclosure "When it cannot be done yet" (`.minutes.notpublic`). |
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

**Form messages** (under "When a reply is not recorded"; each is two keyed sentences): V1 the day not real: `.the.day.is.not.a.real`. V2 both or neither held: `.a.reply.needs.either.the.document`. V3 a silence with a document: `.a.silence.has.no.document.or`. V4 silence where no reply is owed: `.this.action.says.no.reply.is`. V5 kind does not fit: `.that.kind.of.reply.does.not`. V6 outcome: `.a.decision.needs.what.it.decided`. V7 fee: `.a.fee.quote.needs.an.amount`. V8 the office's date without law: `.the.date.the.office.gave.needs`. V9 a quotation mark, backslash, line break or too long: `.a.line.has.a.quotation.mark`. V10 another member recording: `.another.member.is.recording.on.this`. Also: `.reply.at.needed`, `.reply.account.needed`, `.pressure.needed`, `.minutes.notfound`, `.minutes.needed`.

---

## hold: "Litigation hold"

- **Address.** `/app/hold/<subject>`: an action id, or the place a hold is for. **Frame.** Working. Path: Projects › {project} › "Litigation hold".
- **Who can see it.** Any member who can see the action or the case. Anyone else: `unavailable`.
- **Purpose.** Where a legal threat reached the team, and what it keeps (`.purpose`).
- **Entry points.** `action`, `docket` and `counsel` (link "Place a hold").

**Content**
- C1. Heading "Litigation hold"; sub-line `.sub1` + `.sub2` ("A hold records that the team is keeping what a legal matter may reach. …").
- C2. Section "Where the pressure arrived" (`.where.heading`): each mark with no hold: "A reply on an action" (`.reply`), "A docket entry", "Pressure recorded outside any action" (`.outside`), "A counsel matter" (`.counsel.row`); "Marked as a legal threat by {member}" · "No hold is placed for it yet." (`.nohold`).
- C3. Section "Place the hold": "The hold is for", "Why the team is keeping this", "Other projects it should cover (optional)"; note `.who` + `.who.own`; button "Place the hold, with a reason".
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
| A4 button "Release the hold, with a reason" (`act.actionholdrelease.label.hold`) | A hold in place | Same screen. W2 (design table); cannot be undone. Before it is done: `.release.form`, the projects whose deletion restarts, and `consequence.actionholdrelease` ("Releasing this hold restarts deletion … This cannot be undone.", protected). |

---

## holdnotice: "Hold notice"

- **Address.** `/app/holdnotice/<the hold's place>`. **Frame.** Working. Path: Projects › {project} › "Hold notice".
- **Who can see it.** A member who can see the hold. Anyone else: `unavailable`.
- **Purpose.** The notice telling members what to keep outside Civicsmith (`.purpose`).
- **Entry points.** `hold` (link "Prepare the hold notice").

**Content**
- C1. Heading "Hold notice"; sub-line `.sub1` + `.sub2` ("… You send it yourself; Civicsmith sends nothing.").
- C2. Section "The notice": "The notice, as prepared" (`.label`, help `.help1` + `.help2`), from the template; button "Prepare the notice"; note `.released`.
- C3. Section "Sent by your own hand" (`.sent.heading`): `.sent.how` + `.sent.none`; outward panel: tag "Outward · seen outside your team" (`screen.start-send.outward`), `.outward.1` + `.outward.2`; "The day you sent it", "How you sent it" (`.how.*`), "A copy of what you sent, or your account of it"; button "Record that I sent it", primary.
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
- **Purpose.** A packet for the team's lawyer on one action, for a claim or a defense (`.purpose`).
- **Entry points.** Its address (the design draws no link to it on another screen; `start-send` says "A packet for a lawyer to read can be prepared beside this text." `screen.start-send.offer.counsel_packet`).

**Content (S1, a packet for a claim)**
- C1. Heading "Brief counsel"; sub-line `.sub` ("… It is never published and never filed.").
- C2. Section "Who it is for, and why" (`.who.heading`): "Counsel's name", "Counsel's organization"; note `.who.required` + `.who.optional`; "What the packet is for" ("Claim: a case the team may bring" / "Defense: pressure or a claim against the team"); "Why you are assembling it".
- C3. Section "What the packet says about each matter" (`.matters.heading`): `.matters.each` … `.matters.nothing`; each matter `.matters.held` or `.matters.findings`; note `.matters.other`.
- C4. Section "The exhibits, against the court's or office's standard" (as on `start-send` C7).
- C5. Section "If the action belongs to a counsel matter" (`.matter.heading`): `.matter.seen` + `.matter.hold`; link "Place a hold".
- C6. Section "How the packet is marked" (`.marked.heading`): "Prepared for review by {name}, {organization}. Not legal advice. Not for filing." (`filings.prepared_review_legal`); note `.marked.every` + `.marked.none`.
- C7. Button "Assemble the packet, with a reason", primary.
- C8. Section "Packets assembled for this action" (`.made.head`): `.made.lead`; each "Version {n}" with `.made.by`, the reason, `.made.changed` or `.made.exported`, buttons "Read this version" and "Save as a file"; a disclosure of its sections with `.sections.marking`; note `.export.note`.

**States**

| State | When | What shows |
|---|---|---|
| S1 a packet for a claim | "Claim" chosen | C1 to C8. |
| S2 a packet for a defense | "Defense" chosen | As S1, plus "The statements challenged" (`.chal.heading`: "The statement, as your team made it", "Where it was said", link "Add another statement") and "Added for a defense" (`.defense.heading`): "Challenged statements", "Pressure received", "Defense deadlines" (rows "Date undetermined: no start event is recorded yet"), link "Place a hold". |

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
- **Purpose.** Rules the profile lacks, drafted by one member and confirmed by another (`.purpose`).
- **Entry points.** `places` (links "Your team's own rules", "See the rules"); `action` (link "Draft a rule your profile lacks").

**Content**
- C1. Heading "Your team's own rules"; sub-line `.sub1` + `.sub2`.
- C2. Note `.note` + `.note2` ("A drafted rule does not take effect until a member other than its drafter confirms it. Until then it is shown as drafted, and no date or notice relies on it.").
- C3. Section "Waiting for a second member" (`.waiting`): each rule's name; "A deadline for {kind}" / "A legal fact for {kind}"; "Drafted by {member}, {date}" or "Drafted by you, {date}"; its source (link to `document`); "Set off by:", "Requires:", "Citation:", "In effect from" (`.row.*`); button "Confirm this rule". A rule the viewer drafted shows `.self` ("You drafted this rule, so a different member has to confirm it.") and no button. Note `.inprofile` + `.inprofile2`.
- C4. Section "What confirming asks of you" (`.confirm.heading`): `.confirm.says`, `.confirm.qual`, `.confirm.kept`; "What qualifies you to confirm this rule (tier 2 or 3 only)" (`.qual.label`).
- C5. Section "Rules in force" (`.inforce`): rows "Confirmed by {member}, {date}" · `.applies`, button "Withdraw this rule, with a reason"; note `.withdrawn`.
- C6. Section "Draft a rule" (`.draft`): "What kind of rule" ("A deadline" / "A legal fact"), "Its name"; fieldset "The deadline" (`.deadline.legend`: kind of action, "How long", "Counted in", "Which days count", "Counted from" `.trigger.start.*`, "Before or after it", "Who must act by then", "By what time on the last day"); disclosure "For a legal fact, these instead of the deadline" ("When it is shown" `.trigger.fact.*`, "What it says", "The kinds of action it bears on"); "Its citation"; "In effect from"; fieldset "Where the source states it" ("Its primary source", "The document that states it", "The passage"); "Why your team needs it"; button "Draft the rule", primary; note `.machine` + `.machine2`.

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
- **Purpose.** One government act: determination, consequences, escalation (`.purpose`).
- **Entry points.** `project` (link "Matters"); `plan` (a matter in "Matters"); `dash-action`.

**Content (S1, with a determination)**
- C1. Heading: the act's title (data); sub-line outcome · support · rule, e.g. "noncompliant · established · against {rule}" (`.outcome.*`). "Recorded by {member} on {date}." "It is your team's judgment, not a court's." (`.it_is_your_team_s_judgment_not`).
- C2. Button "Record a determination".
- C3. Stage ladder "Documentation", "Notification", "Clock starts", "Response evaluation", "Legal tools", "Sustained attention", "Political accountability" (`.stage.1`-`7`), the current stage marked; `.proposed` ("Proposed next: {stage}. Civicsmith proposes; a member decides."); "It ends only when both hold" (`.endswhen`): "compliance restored", "consequences addressed".
- C4. Section "Consequences: what the breach did" (`.what_the_breach_did`): each part with "computed" / "assessed" / "undetermined" (`.known.*`); note `.neverzero`.
- C5. Buttons A3 to A7.
- C6. Disclosures "When it cannot be ended: compliance is not restored" (`.compliance_is_not_restored_why` …), "When it cannot be ended: the consequences are not settled", "When it cannot be ended: the consequences are not addressed".

**States** (headings and sub-lines are keyed under `screen.matter.`)

| State | When | What shows |
|---|---|---|
| S1 with a determination | A live determination | C1 to C6. |
| S2 no determination yet | Project address | Sub-line "No determination yet" (`.nodet`); "Where this matter stands" with `.your_team_has_not_yet_said_whether` and button "Record a determination", primary; "Not available yet" (`.unavailable`) listing "Opening an escalation", "Saying what the breach did", and attaching/holding/pausing/recording, each "Needs …"; disclosure "When the determination is compliant or unclear". |
| S3 recording a determination | After A1 | Heading "Record a determination", sub-line `.whether_the_act_met_the_rule_with`; sections "The act" (`.act`), "What it rests on" (with `.concluded.unpublished`, `.event.none`, `.determine.needscase`), "The rule it is measured against", "Your determination" ("Compliant", "Noncompliant", "Unclear"; `.each_rule_gets_its_own_outcome`), "Why it happened (optional)"; button "Record this determination" (`.record.this`); `.this_cannot_be_edited_afterward` + `.a_mistake_is_put_right_by_recording`. |
| S4 revising a determination | A determination exists | Heading "Revise the determination" (`.revise`); section "What it replaces" (`.replaces`) with "Why this replaces it"; then S3's form; button "Record the revised determination". |
| S5 what the breach did | Recording consequences | Heading "Consequences: what the breach did", sub-line `.each_part_says_what_was_done_and`; "Parts recorded" (`.parts`); "Record what the breach did" form ("The rule it breached", "Who or what was affected", "Describe them", "What it is measured in", amount, "From", "To", "How you know", "The question showing the harm follows from the breach"); "Revise the second part". |
| S6 saying a consequence was addressed | One part | Heading "Say whether a consequence was addressed"; "This part was" Addressed / Not addressed; "In what way (addressed only)" incl. "Can't be undone"; "Evidence"; "Your reason"; `.there_is_no_percentage_of_redress`. |
| S7 recording a success | A change brought about | Heading "Record a success"; "What changed", "When it changed", "Evidence", "The order of events (optional)", disclosure "If you say why it happened". |
| S8 escalation at the notification stage | Stage 2, open | Sub-line "Notification stage · open"; "Attach an action to this stage" (with disclosure "At the political accountability stage"); "Starting the response clock is proposed" with "Why you are holding at this stage"; "Pause it" (`.pause`) with "Why you are pausing it". |
| S9 escalation at the response evaluation stage | Stage 4 | Sub-line "Response evaluation stage · open"; "Record the government's response": "The response you are reading", "Your reading" (Complied, Partly complied, Denied, No response by the deadline), "Your reason"; `.a_reading_of_complied_does_not_end`. |
| S10 a paused escalation | Paused | Sub-line "Notification stage · paused since {date}"; "Paused": `.no_stage_is_proposed_while_it_is` + `.nothing_already_recorded_is_lost`; "Why you are resuming it (optional)"; button "Resume". |
| S11 assistant unreachable | No AI account | No "Help me write this". |

**Actions**

| Control | When offered | Where it leads / weight |
|---|---|---|
| A1 "Record a determination" (`act.determine.label.matter`) | S1, S2 | S3 (S4 when replacing); its form's button returns to S1. W2. |
| A2 "Open an escalation" (`act.escalationopen.label.matter`) | Noncompliant | S8. W2. |
| A3 "Start the response clock" (`.advance_to_clock_starts`; act "Advance") | A stage proposed | Same screen, next stage marked. W2. |
| A4 "Decline to escalate, with a reason" | Noncompliant, no escalation | Same screen: "The team declined to escalate: {reason}" (`.declined`). W2. |
| A5 "End" (`act.escalationend.label.matter`) | Open | State "ended", or a C6 refusal. W3. Before it is done: `act.escalationend.does` "Ends the escalation, with how it ended." (protected). |
| A6 "Stop pursuing, with a reason" (`act.escalationstoppursuing.label.matter`) | Open | State "stopped pursuing". W3. Before it is done: `act.escalationstoppursuing.does` (protected). |
| A7 "Reopen where it stopped" | Stopped | "open". W2. |
| A8 "Record what the breach did"; "Revise a consequence, with a reason"; "Say whether a consequence was addressed"; "Record what this matter achieved" (`act.successrecord.label.matter`) | S5, S6, S7 | S1, the part or success shown. W2. |
| A9 "Attach an action to this stage"; "Hold at this stage, with a reason"; "Pause, with a reason"; "Record the government's response" | S8, S9 | Same screen (pause: S10). W2. |
| A10 "Resume" (`act.escalationresume.label.matter`) | S10 | The stage it was at. W1. |

**Form messages.** Each is under a "When …" disclosure and ends "Nothing was recorded.": `.it_needs_at_least_one_published_finding` (anything missing); `.noncompliant_is_recorded_only_against_a_rule` (rule does not bind); `.the_rule_was_not_in_force_when`; `.unclear_needs_at_least_one_question_that`; `.a_cause_is_recorded_only_when_evidence`; `.a_determination_says_what_was_required_what` (says how serious); `.a_new_determination_that_replaces_an_earlier` (no reason); `.an_earlier_determination_is_replaced_only_once`; `.a_consequence_is_what_a_breach_did`; `.a_figure_is_worked_out_only_from`; `.a_named_person_must_appear_in_a`; `.whether_a_part_was_addressed_is_said`; `.a_success_needs_a_statement_a_real`; `.evidence_that_your_team_s_own_letter`; `.only_an_action_that_states_a_breach`; `.that_action_is_already_attached_to_an`; `.an_official_request_goes_to_an_elected`; `.stage_3_is_not_proposed_yet_missing`; `.this_escalation_has_been_suspended_since_october`; `.this_escalation_is_open_not_suspended_so`; `.a_reading_other_than_no_response_names`; `.a_response_is_read_at_stage_4`.

---

## Differences seen in the code

- `plan`, assistant unreachable: the code draws nothing where the design shows the note `.nosuggestions` (bio-plane/src/screens-action/plan.mjs:457).
- `plan`: the code draws none of the design's explanatory tips `screen.plan.tip.*` and no `.purpose`; the screen draws no disclosure: the design's "Decide the options you picked", "When an option is not added", "When a decision is not recorded" and "When a scenario is not laid out", with their words (V1 to V12 as listed), are not read (bio-plane/src/screens-action/plan.mjs).
- `start-send`: the design's `.secondapproval` note and the six later kinds `.kind.records_petition` … `.kind.constitutional_claim` are not read; the template refusal sentences are not read (bio-plane/src/screens-action/start-send.mjs).
- `action`: the code draws a link to `counsel`, which the design's `action` does not draw (bio-plane/src/screens-action/action.mjs:516).
- `action`: the design's reply-refusal disclosure "When a reply is not recorded" (V1 to V10) and the "How it ended" words `.ended.*` and `.resolution.said.*` are not read by the screen (bio-plane/src/screens-action/action.mjs).
- `counsel`: the code has no section "Packets assembled for this action" and no acts "Read this version" or "Save as a file"; only `counselpacket` (bio-plane/src/screens-action/counsel.mjs:84-88).
- `glossary`: the term names are read from `glossary.term.<t>` keys, not `.money.<t>.name` / `.honest.<t>.name` (same English) (bio-plane/src/screens-settings/glossary.mjs:19).
- `matter`: the design's refusal disclosures ("When it cannot be recorded" and the rest) are not drawn; its only disclosures are "If you choose unclear", "If you assess it yourself", "If you say why it happened", "At the political accountability stage" (bio-plane/src/screens-action/matter.mjs:156, :313, :360, :375).
- `request`: the law choice's help `.law.help` is not read (bio-plane/src/screens-action/request.mjs).

## Changes

- 22 Nov 2026: written.

