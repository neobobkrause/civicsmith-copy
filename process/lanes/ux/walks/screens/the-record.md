Length: 444 lines. Last section: "Changes".

# Screens: The record

Page `the-record` of the Screens document (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

What the record follows: people and organizations, time, money, calculations, connections, proceedings, due dates and standards, with two help pages. What binds every screen is on the page "Every screen" and is not repeated. Words are quoted from the interface word table with their key; a sample value in a quote (a name, a date, a count) stands for the record's own. "(no word row)" marks a sentence the table lacks. In a screen's section, a key starting with a dot stands for `screen.<that id>` followed by it (in `people`, `.q` is `screen.people.q`). A key given alone, in place of words, means the screen shows that row's whole sentence there.

**The assistant on these screens.** None of these screens needs the assistant. The walk runs with no AI account, and then sees: no "Help me write this" (`act.writinghelp.label.person`) on `person`; on `standard` only proposals members made; on `explore` the line "Ask the assistant to research this" (`screen.explore.later.assist`) as a thing that "Comes in the first beta" (`screen.explore.later.when`), not as a control. Anything the assistant made, where shown, carries "Machine work · the assistant, at {who}'s request" (`ai.machine.request`) and is not a standard, a fact or a step until a member adopts it.

**"Follow from here".** Rows on `people`, `timeline`, `money` and `explore` carry a fold "Follow from here" (`screen.follow.label`). Its buttons that follow into another dimension (act "Follow this item into another dimension", `act.owed_followfrom.label.people`) and search the registers (`act.owed_registersearch.label.people`) are `not built`; its "Documents that …" button (act `search`) leads to `finder` with the item's names, and "Connections to…" (`screen.follow.conn`) leads to `explore` from the item.

## The screens on this page

| id | heading | address | built? |
|---|---|---|---|
| `people` | "People" (`screen.people.name`) | `/app/people` | built (`screens-investigate/people.mjs`) |
| `person` | the person's or thing's name (screen name "Person") | `/app/person/<entity>` | built (`screens-investigate/person.mjs`) |
| `timeline` | "Timeline" (`screen.timeline.name`), or the matter's or progression's name | `/app/timeline/<project>[/…]` | built (`screens-investigate/timeline.mjs`) |
| `money` | the money trail's name (screen name "Money trail") | `/app/money/<project or trail>` | built (`screens-investigate/money.mjs`) |
| `calculation` | the computed fact's name (screen name "Calculation") | `/app/calculation/<calculation>` | built (`screens-investigate/calculation.mjs`) |
| `help-records` | "How a records request works" (`screen.help-records.title`) | `/app/help-records[/<action>]` | built (`screens-action/help-records.mjs`) |
| `help` | "How spot-checks work" (`screen.calculation.help`) | `/app/help` | built (`screens-investigate/calculation.mjs`) |
| `explore` | "Explore connections" (`screen.explore.name`) | `/app/explore[/<start>]` | built (`screens-investigate/explore.mjs`) |
| `proceeding` | the proceeding's name and number (screen name "Proceeding") | `/app/proceeding/<proceeding>` | built (`screens-investigate/proceeding.mjs`) |
| `due-date` | "Due {date}" (`screen.due-date.due`) | `/app/due-date/<due date>` | built (`screens-investigate/due-date.mjs`) |
| `standard` | the standard's own words (screen name "Standard") | `/app/standard/<standard>[/<project>]` | built (`screens-investigate/standard.mjs`) |

## people: "People"

**Address.** `/app/people`. Rail place People.
**Frame.** working.
**Who can see it.** Any signed-in member. The team's own members are never listed here (they are on `members`).
**Purpose.** A directory of the people and organizations the record follows, those named in the member's projects first.
**Entry points.** The rail's "People"; `person` breadcrumb; `explore` breadcrumb.

**Content (S1)**
- C1. Heading 1 "People" (`.name`); `.notmembers`; a link "Settings › Members" (`.members`) to `members`.
- C2. A search field (placeholder "Name or office", `.q`) and button "Search people and organizations" (`act.search.label.people`); selects "Show" (`.show`: "People and organizations", "People", "Organizations", "Offices", "Ordinances", "Contracts", "Funds and programs", "Sources", "Everything the record follows"; `.show.*`), "Holding an office in" (`.office`, first "Any body"), "Named in" (`.named`: "Any project", "Your projects", then each project), "Named recently" (`.since`: "At any time", "In the last 30 days", "In the last 90 days", "In the last year").
- C3. The count line `.countline` ("The record follows {following} people and organizations; {mine} are named in your projects. …").
- C4. Heading 2 "In your projects" (`.yours`), then heading 2 "Everyone else the record follows" (`.others`), newest added first in each. Each row: the name as a link to `person`, who they are today, "named in {documents}, {questions} and {projects}" (`.counts.three`; or `.counts.docsonly`, `.counts.none`), "newest added {date}" (`.newest`), and button "Explore connections" (`act.explore.label.people`).
- C5. Button "Add someone the record follows" (`act.entitycreate.label.people`), Asks for a reason.
- C6. Over many rows: "The first {n} are shown. Search or filter to find the rest." (`.more`).

**States**

| State | When | What shows (exact) |
|---|---|---|
| S1 In use | the record follows people | C1 to C5. |
| S2 Follows no one | the record follows no one | C1; "Your team's record follows no one yet." (`.none`) and `.none.how`; button "Add someone the record follows"; link "Capture a document" (`.none.capture`) to `capture`. No search. |
| S3 No match | a search finds no one | C1, C2; "No one the record follows matches “{q}”." (`.nomatch`) and `.nomatch.how`; button "Add someone the record follows"; link "Look for them in documents" (`.nomatch.find`) to `finder`. |
| S4 A new team | just after setup | C1; rows for the public bodies and offices of the team's place, each "not named in any document yet" (`.counts.none`) and "added at setup, from the public offices of your team's place" (`.today.seeded`), each with "Follow from here". |
| S5 Adding someone | "Add someone the record follows" pressed | Heading 2 "Add someone the record follows" (`.add.head`); field "Their name" (`.add.name`); radios "A person or an organization?" (`.add.kind`): "A person", "An organization"; field "Your note: who they are, and why the team follows them" (`.add.note`) with "Facts about them are then added from documents, each cited." (`.add.note.help`); button "Follow them" (`.add.submit`). |
| S6 Other things | "Show" set to something other than people | `.other.note`; heading 2 "Other things the record follows" (`.other.heading`); each row its name, what it is, its kind and its count. |
| S7 Adding a thing | adding with a kind other than person or organization | Heading 2 "Add something the record follows" (`.addother.head`); field "What it is called" (`.addother.name`); select "What kind of thing is it?" (`.addother.kind`) with `.addother.kind.help` and the kinds (`.add.kind.*`); field "Other names it answers to, one per line" (`.addother.aliases`); field "Your note: what it is, and why the team follows it" (`.addother.note`); `.addother.preflight`; button "Follow it" (no word row). |

**Actions**

| Control | When offered | Where it leads |
|---|---|---|
| A1. button "Search people and organizations" | always but S2 | same screen; the rows filter, or S3 |
| A2. a row's name | always | `person` |
| A3. button "Explore connections" | a row named in a document | `explore` from that row |
| A4. button "Add someone the record follows" | always | S5 |
| A5. button "Follow them" / "Follow it", Asks for a reason | S5, S7 | the new `person` page |
| A6. link "Capture a document"; link "Look for them in documents" | S2; S3 | `capture`; `finder` |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. Add someone | name or note empty | "Give their name and your note on who they are." (`.add.empty`) |

## person: the person's or thing's name

**Address.** `/app/person/<entity>`. Breadcrumb: People › the name.
**Frame.** working.
**Who can see it.** Any signed-in member; what a member cannot see is not counted. An unknown entity leads to `unavailable`.
**Purpose.** A person or an organization the record follows (or an office, a law, a contract, a fund, a source): positions, career, credentials, memberships, interests; same person?; what the team says about them.
**Entry points.** `people` (a row); `document` (people it names); `explore` (a step); `proceeding` (a party); `standard`.

**Content (S1, a person)**
- C1. Heading 1 the name; under it who they are today and how many documents name them.
- C2. Section "Connections" (`.connections`): the graph, with its legend; button "Explore connections" (`act.explore.label.person`).
- C3. Section "Positions" (`.positions`): each post with dates, source and grade.
- C4. Section "Career, credentials, memberships, interests" (`.facts`): each fact with source and grade, or "Undetermined" with "no validity is stated"; fold "Withdrawn facts · {n}" (`.facts.withdrawn`); buttons "Add a fact from a document" (`act.recordpersonfact.label.person`) and "Follow a register" (`act.followregister.label.person`). The fact form: "What the passage says" (`.fact.kind`), "The fact, as the passage states it" (`.fact.value`), "True from (optional)" (`.fact.from`), "True until (optional)" (`.fact.to`), "The document it is read from" (`.fact.sha`), "Page (optional)" (`.fact.page`).
- C5. Section "What the team says about them" (`entity.says.title`; for anything not a person, "What the team says about it", `entity.says.title.org`), with:
  - heading 3 "Other names" (`entity.alias.title`): each name, its origin; field "Another name they go by" (`entity.alias.label`; else `entity.alias.label.org`); button "Add the name" (`entity.alias.add`); `not built` button "Withdraw a name" (`act.owed_aliaswithdraw.label.person`).
  - heading 3 "Ties a member declared" (`entity.relation.title`): each tie "declared, not evidenced"; select "Their tie" (`entity.relation.kind`), field "With" (`entity.relation.with`), "Why you say so" (`entity.relation.why`), "Where it is said" (`entity.relation.cite`); button "Declare the tie" (`entity.relation.declare`). With none: `entity.relation.none`.
  - heading 3 "Documents that may name them" (`entity.naming.title`): each passage with buttons "Match it" (`entity.naming.match`) and "I know this is them…" (`entity.naming.testify`); field "How you know (for “I know this is them”)" (`.testify.basis`); button "Connect the documents that name them" (`entity.connect`).
- C6. Section "Same person?" (`.same`): each claim "claimed the same person, grade {grade}, because …"; fold "Say another record is this person…" (no word row for the fold) with select "The other record" (`.claim.other`), "You say" (`.claim.kind`), "Because" (`.claim.basis`) with `.claim.basis.help`, the two documents (`.claim.sha.a`, `.claim.sha.b`), field "Why, in your words" (`.claim.note`), button "Say another record is this person" (`act.identityclaim.label.person`); fold "Withdraw a same-person claim" with field "Why you withdraw it" (`.claim.withdraw.reason`) and button "Withdraw a same-person claim" (`act.withdrawidentityclaim.label.person`).
- C7. Section "Correction" (`.expunge.head`): `.expunge.title`; `.expunge.statement`; field "The law or order that requires it" (`.expunge.reason`); button "Remove it for good, with this reason" (`.expunge.button`), Irreversible; link "Cancel" (`shell.cancel`). On a phone: "On a phone this can be read but not done: …" (`.expunge.phone`) and no button. A removed value leaves `.expunge.marker`.

**States**

| State | When | What shows (exact) |
|---|---|---|
| S1 A person | an entity of kind person | C1 to C7. |
| S2 An organization | an organization | C1, C2; an "Offices in it" section (no word row) with each office and its holder; "Same organization?" (`.same.org`); select "What kind of fact" with `.kind.help.org`; section "Records its offices keep" (`.keeper.heading`) with `.keeper.intro.a`, `.keeper.intro.b`, each statement with button "Withdraw this statement, with a reason" (`act.linewithdraw.label.person`), the form "The office" (`.keeper.office.label`), "What it does with them" (`.keeper.kind.label`: "Keeps the records on the subject", "Is responsible for the subject"), "The subject" (`.keeper.subject.label`), "What says so" (`.keeper.source.label`: "A document in this project", "It is my own word, from what I know"), "Which document, and where in it" (`.keeper.doc.label`), "Since (optional)", "Until (optional)", button "Record that the office keeps them" (`.keeper.button`); then C5 headed "What the team says about it", with "Connect the documents that name it" (`entity.connect.org`). |
| S3 No connections yet | a person nothing links yet | C1; section "Connections" with "No connections are recorded yet. One is added when a document names this person beside another, or when you add a fact from a document, below." (`person.graph.none`); C4. |
| S4 An ordinance (or contract, fund, source) | an entity of such a kind | C1, C2's button; section "Where the record cites it" (`.cited`) with each citing document, section and grade; C5 headed "What the team says about it", ties none: `.ties.none.ordinance`. |
| S5 An office as a post | an entity of kind office | C1, C2's button; section "Who has held it" (`.holders`), each holder (a link to `person` where followed) with dates, source and grade; C5, ties none: `.ties.none.office`. |
| Assistant not reachable (the walk) | no AI account | No "Help me write this" beside "Why you say so" or "How you know"; nothing else changes. |

**Actions**

| Control | When offered | Where it leads |
|---|---|---|
| A1. button "Explore connections" | always | `explore` from this entity |
| A2. "Add a fact from a document" (Asks for a reason); "Follow a register" | S1, S3 | same screen; the fact is listed in C4; the register is followed |
| A3. "Add the name" (Asks for a reason); "Declare the tie" (Asks for a reason) | always | same screen; listed in C5 |
| A4. "Match it"; "I know this is them…" (Asks for a reason) | a passage listed | same screen; the passage leaves the list and counts as naming them (by testimony: grade D) |
| A5. "Connect the documents that name them" | always | same screen; C2 gains the links |
| A6. "Say another record is this person"; "Withdraw a same-person claim" (both Asks for a reason) | S1, S2 | same screen; C6 |
| A7. "Remove it for good, with this reason", Irreversible | a value the law requires removed; not on a phone | same screen; the value is replaced by `.expunge.marker` |
| A8. "Record that the office keeps them"; "Withdraw this statement, with a reason" | S2 | same screen; listed or marked withdrawn |
| A9. a holder's or a citing document's link | S4, S5 | `person`; `document` |
| A10. `AI` "Help me write this" (`act.writinghelp.label.person`) | the assistant reachable | a labeled draft in the field |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. Fact | empty | "Give the fact as the passage states it and the document it comes from." (`.fact.empty`) |
| V2. Register | no address | "Give the register's public address, starting https://." (`.follow.empty`) |
| V3. Same-person claim | other record or reason empty | fold "The other record or the reason left empty" (`.claim.empty.summary`): "Name the other record and say why." (`.claim.empty`) |
| V4. Removal | empty | "Choose the value and name the law or order that requires its removal." (`.expunge.empty`); for an order, "Name the court order." (`.expunge.noorder`) |
| V5. Records its offices keep | refused (fold "When it is refused", `.keeper.refused.summary`) | "No source was named." "Choose a document that says so, or say it is your own word." (`.keeper.refused.nobasis.a`, `.keeper.refused.nobasis.b`); "The office and the subject are the same." "Choose a different subject." (`.keeper.refused.self.a`, `.keeper.refused.self.b`); "The end date is before the start date." "Check the two dates." (`.keeper.refused.dates.a`, `.keeper.refused.dates.b`) |
| V6. Office holder | empty | "Choose who holds it and cite what shows it. Nothing was recorded." (`.holds.empty`) |

## timeline: "Timeline"

**Address.** `/app/timeline/<project>`; a matter's steps (S2) and a progression's steps (S3) at further steps of the same address. Breadcrumb: Projects › the project › "Timeline".
**Frame.** working.
**Who can see it.** A member of the project. Unknown project: `unavailable`.
**Purpose.** What they did and what we did, in two lanes; the matters the project follows through a progression, one matter's steps (S2), and a progression's steps and basis (S3).
**Entry points.** `project` (C11 "Timeline"); a progression's link on this screen; `action` (a records request followed).

**Content (S1)**
- C1. Heading 1 "Timeline" (`screen.timeline.name`); the project's name.
- C2. Two lanes, "What they did" (`.lane.world`) and "What we did" (`.lane.ours`): each event with its date and precision, a link to the `document` it rests on, who decided or took part, and its grade; each with "Follow from here".
- C3. Where two events cannot be ordered: an "Undetermined order: …" line naming them and why, the evidence that would order them, and buttons "Cite an exact date for one of them" (`.cite.date`), "Cite which came first" (`.cite.first`), "Look for their dates in this project" (`.find.dates`). They are never placed in a guessed order.
- C4. Heading 2 "Undated" (`.undated.head`): each undated event, "listed apart, never guessed into place" (`.undated.apart`).
- C5. Buttons "Record an event" (`act.createevent.label.timeline`), "Add who took part" (`act.addparticipant.label.timeline`), "Link events" (`act.relate.label.timeline`), "Record a dated fact" (`act.recorddatedfact.label.timeline`), "Keep a suspected cause as a hunch" (`act.hypothesishold.label.timeline`).
- C6. Heading 2 "Progressions it follows" (`progression.follows`): each matter as a link to its S2, with its progression and how many steps are threaded.
- C7. Heading 2 "Dated in the documents" (`timeline.dated.title`): each dated fact, its precision ("To the day", `label.timeprecisions.day`; "Partly known: a month, a year, or about", `label.timeprecisions.edtf`), source and grade.

**States**

| State | When | What shows (exact) |
|---|---|---|
| S1 The two lanes | the project's timeline | C1 to C7. |
| S2 A matter through a progression | a matter of C6 opened | Heading 1 the matter's name; which progression and version it follows; `progression.finding.never`; heading 2 "Its steps" (`progression.steps`): each step, its document or "No document threaded …", with buttons "Thread a document…" (`progression.thread`), "Record a lawful skip…" (`progression.discharge`), "Set this finding aside…" (`progression.setaside`); heading 2 "How sure the chain is" (`progression.chain`), e.g. `progression.chain.undetermined`; heading 2 "Findings" (`progression.findings`). |
| S3 A progression's steps | a progression opened | Heading 1 its name; its version and who declared it; heading 2 "Steps" (no word row), each with when and whether required; heading 2 "Its basis" (`progression.basis`) with its citation; button "Revise the steps…" (`progression.revise`); fold "Define a progression" (`progression.define`) with fields "Its name", "Its basis" and button "Declare the progression" (`progression.define.go`). |

**Actions**

| Control | When offered | Where it leads |
|---|---|---|
| A1. C5's buttons; C3's buttons | S1 | same screen; the event, participant, link, dated fact or hunch is listed |
| A2. "Look for their dates in this project" | C3 shown | `find-in`, set to the project |
| A3. an event's or a step's document link | S1, S2 | `document` |
| A4. a progression link | S1 | S2 |
| A5. "Thread a document…"; "Record a lawful skip…" (Asks for a reason); "Set this finding aside…" (Asks for a reason) | S2 | same screen; the step or finding changes |
| A6. "Revise the steps…"; "Declare the progression" (both Asks for a reason) | S3 | same screen; a new version |
| A7. "Follow from here": the documents button; "Connections to…" | each event | `finder`; `explore` |

**Form messages.** Refusals of these acts are drawn by their refusal code (see "Every screen").

## money: the money trail's name

**Address.** `/app/money/<project>` or `/app/money/<trail>`. Breadcrumb: Projects › the project › "Money trail" (`screen.money.name`).
**Frame.** working.
**Who can see it.** A member of the project.
**Purpose.** Money facts with stage and period; a trail; reconciling sources.
**Entry points.** `project` (C11 "Money trail"); `explore` (a money step); `capture` (the "Follow the money" wizard).

**Content**
- C1. Heading 1 the trail's name; what it holds and who started it.
- C2. Buttons "Read a figure" (`.read`; act `act.recordfact.label.money`), "Start a money trail" (`act.createset.label.money`), "Committed against paid" (`act.committedagainstpaid.label.money`).
- C3. Heading 2 "Where the money went, as a graph" (`.graph.heading`).
- C4. A filter button for figures with something undetermined; `.table.how` ("Open a figure to act on it; tick several to act on them together.").
- C5. The table, columns "Pick", "Figure" (`column.money.figure.name`), "From" (`column.money.from.name`), "To, where it went" (`column.money.to-where-it-went.name`), "When it moved" (`column.money.when-it-moved.name`), "Stage" (`column.money.stage.name`), "Period" (`column.money.period.name`), "Amount" (`column.money.amount.name`), "Source" (`column.money.source.name`), "In this trail?" (`column.money.in-this-trail.name`). A figure opened shows who read it from which passage; for a budget figure, `.budget.about` ("A budget figure says what was planned, not what happened. …"). A column the source does not state reads "Undetermined: …" with the evidence that would settle it, never a guess.
- C6. A figure's buttons: "Compare two sources" (`act.reconcile.label.money`), "What authorized it" (`act.authoritychain.label.money`), "Leave out with a reason" (`act.exclude.label.money`) or "Include with a reason" (`act.include.label.money`), "Why B, and what would raise it" (`act.gradenote.label.money`), "Get the city's own copy" (`act.acquire.label.money`); for an undetermined column, "Look for it in this project" (`act.findin.label.money`), "Read it from another source" (`.readother`), "Ask the city for the record" (`act.actioncreate.label.money`), "Record when it moved" (`act.createevent.label.money`); and "Ask a member who knows budgets" (`act.checkrequest.label.money`), "Keep my reading as a hunch" (`act.hypothesishold.label.money`); and "Follow from here".
- C7. The picked-figures bar: "{n} figures picked" with buttons "Include with a reason", "Leave out with a reason", "Compare the two" (no word row), "Ask a member who knows budgets", "Unpick all" (`shell.unpick`).
- C8. A closing note (no word row in this form, 3 sentences): each column is read from the figure's own source; adding evidence never changes a figure; where two sources disagree both stay, in tension.

**States.** One drawn state (the trail in use). A project with no trail yet shows C1, C2 and an empty table; an unknown trail leads to `unavailable`.

**Actions**

| Control | When offered | Where it leads |
|---|---|---|
| A1. "Read a figure"; "Read it from another source" (Asks for a reason) | always; an undetermined column | the figure form on the same screen; then a new row in C5 |
| A2. "Start a money trail" | always | a new trail; its `money` page |
| A3. "Committed against paid"; "What authorized it" | always | the comparison, or the chain of authority, on the same screen |
| A4. "Compare two sources"; "Include with a reason"; "Leave out with a reason" (Asks for a reason) | a figure | same screen; "In this trail?" changes, with the reason |
| A5. "Ask the city for the record" (Asks for a reason) | an undetermined column | `request` (a records request) |
| A6. "Look for it in this project" | an undetermined column | `find-in` |
| A7. "Record when it moved" (Asks for a reason) | "When it moved" undetermined | the event form; then `timeline` lists it |
| A8. "Ask a member who knows budgets" (Asks for a reason) | always | a check request reaches members with that expertise |
| A9. "Get the city's own copy" | a figure | `capture` |
| A10. "Why B, and what would raise it" | a graded figure | the grade note on the same screen |

**Form messages.** Refusals are drawn by their refusal code.

## calculation: the computed fact's name

**Address.** `/app/calculation/<calculation>`. Breadcrumb: Projects › the project › "Calculation" (`.name`).
**Frame.** working.
**Who can see it.** A member who may see the project it belongs to.
**Purpose.** A computed fact with its method, or a member's spreadsheet bound to the record.
**Entry points.** `question` (a computed fact cited); `project` (C11); `find-in`.

**Content**
- C1. Heading 1 the fact's name; "A computed fact · method shown · recomputed when an input changes" (`.sub`); the result, e.g. "812 of 903", its share and what it counts.
- C2. Heading 2 "Method" (`.method`): the formula; its inputs with capture date and grade; who checked it and when.
- C3. Buttons "Work it out" (`.work`), "Declare the table" (`act.tabledeclare.label.calculation`), "Record a second member's check" (`act.recordcheck.label.calculation`), "Accept the result" (`act.calculationaccept.label.calculation`).
- C4. Heading 2 "Your own spreadsheet" (`.workbook`): buttons "Bind your spreadsheet" (`act.addworkbook.label.calculation`), "Tie an input to the record" (`act.bind.label.calculation`).
- C5. Heading 2 "Spot-check" (`.spot`): rows "The draw" (`.draw`), "What members found" (`.found`), "What it estimates" (`.estimate`), with the seed, the counts and the exact range; what it does not say; link "How spot-checks work" (`.help`) to `help`. Buttons "Draw a random sample" (`act.calculationdraw.label.calculation`), "Record what you saw at a report" (`act.testify.label.calculation`), "Count it for the drawn report" (`act.spotcheckvisit.label.calculation`).

**States.** One drawn state. Before a sample is drawn, C5 shows only "Draw a random sample".

**Actions**

| Control | When offered | Where it leads |
|---|---|---|
| A1. "Work it out" (Asks for a reason); "Declare the table" | always | same screen; C1 and C2 recomputed |
| A2. "Record a second member's check" (Asks for a reason) | a member other than its author | same screen; C2 names the check |
| A3. "Accept the result" (Asks for a reason) | always | same screen; the result can be cited from `question` |
| A4. "Bind your spreadsheet"; "Tie an input to the record" | always | same screen; C4 lists the binding |
| A5. "Draw a random sample" | no draw yet | same screen; C5 "The draw" with its seed |
| A6. "Record what you saw at a report"; "Count it for the drawn report" (both Asks for a reason) | a draw exists | same screen; "What members found" and "What it estimates" recount |
| A7. link "How spot-checks work" | C5 | `help` |

**Form messages.** Refusals are drawn by their refusal code.

## help-records: "How a records request works"

**Address.** `/app/help-records`, or `/app/help-records/<action>` for the law that action goes under. Breadcrumb: "Help: How a records request works" (`.name`).
**Frame.** working.
**Who can see it.** Any signed-in member.
**Purpose.** What the place's public records law requires of the office, the place's faster request where it has one, what the city's portal shows, and what Civicsmith does with a request; the place's own facts come from the team's places.
**Entry points.** `request`; `action`; `start-send`.

**Content (S1)**
- C1. Heading 1 "How a records request works" (`.title`); "Help · for a request under the {law}, to an office in {place}" (`.sub`).
- C2. Heading 2 "What the office must do" (`.must`): up to seven points, `.must.1` to `.must.7`, each with its citation (a point whose citation the place's profile lacks is not drawn).
- C3. Heading 2 "The faster request in {place}" (`.faster.in`): `.faster.what`. Not drawn where the place has none.
- C4. Heading 2 "What a public portal shows" (`.portal`): `.portal.where`, `.portal.1`, `.portal.2`, `.portal.3`.
- C5. Heading 2 "What Civicsmith does with it" (`.does`): `.does.text`.
- C6. "Sources" (`.sources`): the law's sections and the pages read, with dates.

**States**

| State | When | What shows (exact) |
|---|---|---|
| S1 Help held | the team's places hold records help | C1 to C6. |
| S2 Not held (likely on the walk's made-up place, Lakeshore) | the team's places hold no records law | C1 and "Your team's Civicsmith doesn't hold records help for this place yet, so none is shown here. The law's own text is the place to look." (`.notheld`); no C2 to C6. |

**Actions.** None: a help page (registry: no acts). Links in C6 open the sources outside Civicsmith.

## help: "How spot-checks work"

**Address.** `/app/help`. Breadcrumb: Help › "How spot-checks work".
**Frame.** working.
**Who can see it.** Any signed-in member.
**Purpose.** A help page: one method explained in plain words, linked from where it is used.
**Entry points.** `calculation`, link "How spot-checks work" (`screen.calculation.help`).

**Content**
- C1. Heading 1 "How spot-checks work" (`screen.calculation.help`); "Help · for any calculation your team can test against what members see" (`.sub`).
- C2. Five headings 2, each with one paragraph: "What a spot-check does" (`.does`), "Why the sample is random, and recorded" (`.random`), "What the result says" (`.says`), "What it does not say" (`.notsays`), "Each visit is evidence" (`.evidence`).

**States.** One: a fixed help page.
**Actions.** None (registry: no acts). Back by the browser or the breadcrumb.

## explore: "Explore connections"

**Address.** `/app/explore`, or `/app/explore/<start>`. Breadcrumb: People › the start's name › "Explore connections".
**Frame.** working.
**Who can see it.** Any signed-in member; chains through what the member may not see are not drawn.
**Purpose.** Chains between a start and an end, each step cited and graded.
**Entry points.** `people` and `person` ("Explore connections"); "Connections to…" on any "Follow from here".

**Content (S1)**
- C1. Heading 1 "Explore connections" (`.name`); a line naming the start, the end, what is followed and as of when.
- C2. Group "Follow" (`.follow.legend`) with checkboxes "Positions and memberships" (no word row), "Money" (`connection.kind.money.name`), "Took part" (`connection.kind.part.name`), "Mentioned together" (`connection.kind.ment.name`), "Same person?" (`connection.kind.same.name`); buttons "Explore" (`act.explore.label.explore`), "Use a preset" (`act.explorepreset.label.explore`), `not built` "List every connection" (`.all.button`) and "Find the most direct path" (`.direct.button`).
- C3. Heading 2 for the graph from the start, with its legend.
- C4. Heading 2 "Most direct path" (`.direct.head`): the chain, each step a link (`person`, `document`, `money`), its grade, steps, weakest step and date; a note on how the most direct path is chosen ("a fact about the chains, not a judgment of them").
- C5. Heading 2 "Every connection between them" (`.all.head`): each chain with grade, steps and weakest step; a chain through a hub "a hub: shown, not walked through"; a chain with a declared step "a lead, not a finding" with button "Attach a source to a declared step" (`act.stepsource.label.explore`); an evidenced chain with button "Check a chain" (`act.exploreverify.label.explore`). If cut short: "The explorer stopped early so as to answer quickly, and shows what it found. More may exist." (`.all.cut`) and `not built` button "Keep looking" (`.all.continue`).
- C6. Heading 2 "Chains that stop at a name the record lacks" (`.all.stops`).
- C7. Heading 2 "A chain you built" (`.shorter.head`): the member's chain; where shorter ones exist, `not built` buttons "See the shorter paths" (`.shorter.see`) and "Keep mine" (`.shorter.keep`); then "Evidenced paths" (`.shorter.evidenced`) and "Leads" (`.shorter.leads`).
- C8. Two lines marked "Comes in the first beta" (`.later.when`): "Combined walks, such as who gave to the official whose department paid this vendor" (`.later.walks`) and "Ask the assistant to research this" (`.later.assist`). Neither is a control.
- C9. Button "Open a question from this chain" (`act.promote.label.explore`), Asks for a reason.

**States**

| State | When | What shows (exact) |
|---|---|---|
| S1 Connections from a start | opened from a person, document or payment | C1 to C9. |
| S2 Nowhere to start from | opened with no start | Heading 1 "Explore connections"; "Choose where to start: a person, an organization, a document or a payment. Its connections are then drawn here, each step cited and graded." (`.nocentre`); field "From" (`.from`); C2. No graph or chains. |

**Actions**

| Control | When offered | Where it leads |
|---|---|---|
| A1. "Explore"; "Use a preset" | always | same screen; C3 to C7 redrawn |
| A2. a step's link | S1 | `person`, `document` or `money` |
| A3. "Check a chain" | an evidenced chain | same screen; the chain's steps checked against their sources |
| A4. "Attach a source to a declared step" (Asks for a reason) | a lead | same screen; the step graded from its source |
| A5. "Open a question from this chain" (Asks for a reason) | a chain chosen | a new `question` |
| A6. `not built`: "List every connection", "Find the most direct path", "Keep looking", "See the shorter paths", "Keep mine" | owed | — |

**Form messages.** Refusals are drawn by their refusal code.

## proceeding: the proceeding's name and number

**Address.** `/app/proceeding/<proceeding>`. Breadcrumb: Projects › the project › "Proceeding" (`.name`).
**Frame.** working.
**Who can see it.** A member of the project.
**Purpose.** A court case or regulatory proceeding: parties, register, orders and their dates.
**Entry points.** `project` (C11); `capture` (the "Follow a proceeding" wizard); `person` (a party).

**Content**
- C1. Heading 1 the proceeding's name and number; the court and a neutral label.
- C2. Selects "The court or tribunal" (`.forum`) and "The kind of proceeding" (`.kind`); fold "When no court is held yet" (`.court.none.summary`): "No court is known for your team's place yet. Add the one this proceeding is in." (`court.none`), field "The court's name" (`court.add.name`), button "Add a court" (`court.add`); button "Register the proceeding" (`.register`).
- C3. Heading 2 "Parties" (`.parties`): each by role and name; button "Add a party by role" (`act.recordline.label.proceeding`).
- C4. Heading 2 "The register" (`.register.head`): each filing with its date, the newest marked new; where the register needs a login, "The court's register needs a login, so new filings come only by a member's own capture." (`.login.note`); button "Follow its register" (`act.followregister.label.proceeding`).
- C5. Heading 2 "Dates" (`proceeding.dates.title`): "Now: awaiting the {event}" (`.now`); two lanes "The proceeding" (`proceeding.dates.lane.proceeding`) and "Our deadlines on it" (`proceeding.dates.lane.group`).
- C6. Heading 2 "Orders, held as obligations" (`.orders`): each obligation as a "To do" with its due date; buttons "Hold an order as obligations" (`act.declare.label.proceeding`), "Link a decision to what it interprets" (`act.courtlink.label.proceeding`).
- C7. "Procedural facts (which form, which court, which deadline) are facts, never advice on what to file." (`.facts`).

**States.** One drawn state; the fold in C2 shows when the team holds no court.

**Actions**

| Control | When offered | Where it leads |
|---|---|---|
| A1. "Add a court"; "Register the proceeding" (Asks for a reason) | C2 | same screen; the court is listed; the proceeding is registered |
| A2. "Add a party by role" (Asks for a reason) | always | same screen; C3 |
| A3. "Follow its register" | always | same screen; new filings are listed in C4 and reach `queue` |
| A4. "Hold an order as obligations" (Asks for a reason) | an order captured | same screen; C6 lists a "To do", and `queue` holds it |
| A5. "Link a decision to what it interprets" (Asks for a reason) | an order | same screen |
| A6. a party's name | C3 | `person` |

**Form messages.** Refusals are drawn by their refusal code.

## due-date: "Due {date}"

**Address.** `/app/due-date/<due date>`. Breadcrumb: Queue › the due date (`shell.step.due-date`).
**Frame.** working.
**Who can see it.** A member who may see the action the date belongs to.
**Purpose.** A due date's basis and counting; confirm it; download it.
**Entry points.** `queue` (a due date); `action`; `request` after sending.

**Content**
- C1. Heading 1 "Due {date}" (`.due`); "{who}'s reply" (`.of`).
- C2. Heading 2 "How this was worked out" (`.how`): the steps, "Basis: {basis}" (`.step.basis`), "Received by the office: {date}." (`.step.received.receipt`) or "Counted from sending: {date} (receipt not recorded)." (`.step.received.sent`), "Counted {amount} {units}." (`.step.counted`), each skipped day (`.step.skipped`, `.step.rolled`), "Falls due {date}, {zone}." (`.step.due`).
- C3. Buttons "Work out the due date" (`act.clockpropose.label.due-date`) and "Confirm the due date" (`act.clockadopt.label.due-date`), Asks for a reason, with field "Why this date is right, in your words" (`.why`) and `.why.help`.
- C4. Field "Remind me on" (`.on`); button "Remind me" (`act.reminderset.label.due-date`); link "Download to my calendar" (`.download`).
- C5. "Once confirmed it goes into your queue. If no reply comes by then, the queue says so once." (`.queue`).
- C6. Folds "When a reminder is set" (`screen.reminder.set.when`), "When your rules state no deadline for this kind of action" (`.rule.summary`), "When your rules list no deadline at all" (`.nodeadlines.summary`).

**States**

| State | When | What shows (exact) |
|---|---|---|
| S1 Worked out | the date is proposed | C1 to C6. |
| S2 Reminder set | "Remind me" done | "We will remind you on {date}." (`screen.reminder.on`). |
| S3 No rule for this kind of action | the places' rules state no deadline for it | "No rule in your places' rules states a deadline for this kind of action, so none was set. Nothing was written." (`refusal.NO_SUCH_RULE`); select "A deadline your rules list" (`.rule.pick`) with `.rule.help`; button "Work out the due date"; link "See your places' rules" (`.rule.go`) to `settings`. |
| S4 No deadlines at all | the places list no deadline | "A member can draft a deadline as your team's own rule, under Your team's own rules." (`.nodeadlines`). |
| S5 Cannot be worked out | the record lacks a needed date | "the date cannot be worked out from what is recorded" (`.nodate`) in C2. |

**Actions**

| Control | When offered | Where it leads |
|---|---|---|
| A1. "Work out the due date" | always | same screen; C2 redrawn, or S3 |
| A2. "Confirm the due date" (Asks for a reason) | a date is worked out | same screen; the date enters `queue` |
| A3. "Remind me" | a date confirmed | S2 |
| A4. link "Download to my calendar" | a date | a calendar file is saved |
| A5. link "See your places' rules" | S3 | `settings` |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. Remind me on | empty | "Choose the due date and the day to be reminded." (`.remind.empty`) |

## standard: the standard's own words

**Address.** `/app/standard/<standard>`, or `/app/standard/<standard>/<project>` from a project's list. Breadcrumb: Projects › the project › "Standard: {name}" (`screen.standard.crumb`).
**Frame.** working.
**Who can see it.** A member who may see it; a standard's text behind a paywall is readable only inside the team (S2).
**Purpose.** A requirement the city set itself, held and searchable.
**Entry points.** `project` (C11 "Standards"); `document` (held as a standard); `question`; `plan`; `matter`.

**Content (S1)**
- C1. Heading 1 the requirement's words; its citation, "in force since {from}" (`.inforce.since`) or "in force {from} to {to}" (`.inforce.span`), and whose policy.
- C2. Labels: force ("Requires", `label.standardforce.requires`; "Recommends", `label.standardforce.recommends`), binding, access ("Free to read", `label.standardaccess.free`; "Behind a paywall", `label.standardaccess.paywalled`), copy ("Official copy", `label.standardcopy.official`); the passage, quoted.
- C3. Heading 2 "Was it in force on a date?" (`.inforce.heading`): field "The day" (`.inforce.day.label`) with "Choose a day from the calendar." (`.inforce.day.help`); button "Check a date" (`act.standardinforce.label.standard`); the answer "On {date} it was: {state}" (`.inforce.result.line`), state "In force", "Not in force", "Overridden" or "Undetermined" (`.inforce.state.*`), with `.inforce.result.meta`; folds "The other answers it can give" (`.inforce.others.summary`) and "When it cannot say" (`.inforce.refused.summary`) with `.inforce.refused.body` and "Choose a day that exists and ask again." (`.inforce.refused.body2`).
- C4. Heading 2 "Whom it binds, and until when" (`.binds.head`): each recorded day in force (button "Withdraw this, with a reason", `act.standardinforcethroughwithdraw.label.standard`), law, adoption and benchmark; fold "If no end date is stated" (`.through.none.summary`). Folds with their forms: "Record a day it was still in force" (fields "The last day it is known to be in force" `.f.through`, "Where it shows" `.f.source`, "Your reason" `.f.reason`); "Record that a body adopted it" (`.f.act`, `.f.edition`, `.f.mode`, `.f.passage`); "Record a law that makes it binding" (`.f.body`, `.f.law`, `.f.passage`); "Hold it only as a benchmark for a body" (`.f.body`), each ending in a button of the same words (`act.standardinforcethrough.label.standard`, `act.standardadoption.label.standard`, `act.standardimpose.label.standard`, `act.standardbenchmark.label.standard`), Asks for a reason.
- C5. Buttons "Hold this as a standard" (`act.standarddeclare.label.standard`), "Adopt a proposed standard" (`act.standardadopt.label.standard`), "Relate to a law" (`act.lawrelate.label.standard`).
- C6. The project's proposed standards: each "proposed by {by}, {date}" (`.proposedby`) with "Not a standard until a member adopts it." (`.notyet`); one the assistant proposed also carries `ai.machine.request`.

**States**

| State | When | What shows (exact) |
|---|---|---|
| S1 Held | a standard the team holds | C1 to C6. |
| S2 A benchmark behind a paywall | not public, not binding | C1, C2 with "Recommends", "Benchmark · not binding on {body}" (`standard.binding.benchmark`), "Behind a paywall", "Not public" (`standard.notpublic`); "This standard's words can be read only by the team's members, inside the team." (`standard.text.withheld`); button "Relate to a law". |
| S3 Cited, not seen | cited by a document, no copy held | C1; "Cited, not seen" (`label.standardheld.cited`) and what cites it; button "Relate to a law". |
| S4 Looked for, not found | searched for, not found | C1; "Looked for, not found" (`label.standardheld.absent`) and where it was looked for; button "Relate to a law". |
| Assistant not reachable (the walk) | no AI account | C6 lists members' proposals only; no machine-work label is drawn. |

**Actions**

| Control | When offered | Where it leads |
|---|---|---|
| A1. "Check a date" | S1 | same screen; C3's answer |
| A2. C4's four buttons (Asks for a reason); "Withdraw this, with a reason" | S1 | same screen; C4 lists or marks it withdrawn |
| A3. "Hold this as a standard"; "Adopt a proposed standard" (Asks for a reason) | S1; a proposal | same screen; the proposal leaves C6 and is held |
| A4. "Relate to a law" (Asks for a reason) | always | same screen; the law is named in C4 |
| A5. a citing document's link | S1, S3 | `document` |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. The day | not a day | `.inforce.refused.body`, "Choose a day that exists and ask again." (`.inforce.refused.body2`) |

## Differences seen in the code

Paths are under `bio-plane/src/`.

- `screens-investigate/people.mjs:106`: "Explore connections" is drawn only on a row named in at least one document; the design draws it on every row (and in S4 inside "Follow from here").
- `screens-investigate/people.mjs`, `timeline.mjs`, `money.mjs`, `explore.mjs`: the "Follow from here" buttons for `followfrom` and `registersearch` (owed, DEC-409 and DEC-406) are not drawn; on `explore`, `exploreall`, `explorepath`, `exploreshorter` and `explorecontinue` are not drawn either. Marked `not built` above.
- `screens-investigate/people.mjs:58-62`: adding a thing that is not a person or organization (S7) ends in "Follow them" (`screen.people.add.submit`); the design draws "Follow it", which has no word row.
- `screens-action/help-records.mjs:1-8`: no place is named in the screen's words; every fact is filled from the team's places, and a section the profile cannot fill is not drawn. The design mockup draws Oakland's law in full; on the walk's made-up place S2 is expected.

## Changes

- 22 Nov 2026: written.
