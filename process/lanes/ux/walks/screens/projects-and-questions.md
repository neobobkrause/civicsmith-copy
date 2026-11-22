Length: <N> lines. Last section: "Changes".

# Screens: Projects and questions

Page `projects-and-questions` of the Screens document (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

A project, its objective, who pays for the assistant in it, its questions, asking, and the assistant panel. What binds every screen is on the page "Every screen" and is not repeated. Words are quoted from the interface word table with their key; a sample value in a quote (a name, a date, a count) stands for the record's own. "(no word row)" marks a sentence the table lacks. In a screen's section, a key starting with a dot stands for `screen.<that id>` followed by it (in `project`, `.opened` is `screen.project.opened`). A key given alone, in place of words, means the screen shows that row's whole sentence there.

## The screens on this page

| id | heading | address | built? |
|---|---|---|---|
| `project` | the project's title (screen name "Project", `screen.project.name`) | `/app/project/<project>` | built (`screens-inquiry/project.mjs`) |
| `objective` | "Objective" (`screen.objective.name`) | `/app/objective/<project>` | built (`screens-inquiry/objective.mjs`) |
| `projectai` | "AI for this project" (`screen.projectai.name`) | `/app/projectai/<project>` | built (`screens-inquiry/projectai.mjs`) |
| `question` | the question's own words (screen name "Question", `screen.question.name`) | `/app/question/<question>/<project>` | built (`screens-inquiry/question.mjs`) |
| `answers` | "Ask" (`screen.answers.name`) with the assistant; "Find and count" (`screen.answers.offtitle`) without it | `/app/answers` | built (`screens-daily/answers.mjs`) |
| `assistant` | "The assistant panel" (`screen.assistant.name`), a dock, not a page | no address of its own: drawn in the dock beside a working-frame screen | built (`screens-inquiry/assistant.mjs`) |

## The assistant on these screens: what a walk without AI sees, and what its work always carries

The internal walk runs with no AI account. On these six screens it then sees the assistant **absent, not greyed**: no control that only the assistant can answer is drawn, disabled or explained in its place, and nothing says it is missing. In particular, with no account serving the member:

- The masthead has no button "Assistant" (`shell.assistant`), and no dock is drawn beside any screen. `assistant` is not seen at all.
- `question` draws no "Ask the assistant to look" (`question.empty.ask`), no "Read in my language" (`act.readtranslate.label.question`), no "Help me write this" (`act.writinghelp.label.question`), no run, no proposal, no limit section, and no reading the assistant composed.
- `project` and `objective` draw no "Help me write this" (`act.writinghelp.label.project`, `act.writinghelp.label.objective`) and no suggested questions.
- `answers` is "Find and count" (S5 on `answers`), not "Ask".
- `projectai` is drawn in full: it is where owners say who pays, and it needs no AI to show.

Every piece of the assistant's work, wherever it is drawn (when an account serves the member), carries all of these; a walk with AI checks each, and never expects exact words from the assistant:

1. The machine-work label, by its words: "Machine work · the assistant, at {who}'s request" (`ai.machine.request`), "Machine work · the assistant, at your request" (`screen.answers.machine`), or "Machine work · found while exploring" (`ai.label.explored.member`); with the "Machine work" mark (`mark.origin.machine.name`). It is never drawn as a member's words or as evidence.
2. Its citations: each passage it relies on is named with a link to the `document` holding it, beside "Checked by Civicsmith before it was shown" (`ai.progress.checked.all`). Nothing it wrote shows before that check: while it works, only its progress rows show (`ai.progress.hold.answer`, `ai.progress.hold`).
3. "Legal information, not legal advice." (`screen.answers.legal`) on every answer that says what a law, a rule or a standard requires.
4. On a test instance, `ai.label.untested` ("Not yet tested: …").
5. It never concludes, grades, signs or sends: every proposal waits for a member's act ("Accept this reading", `act.versionaccept.label.question`), and no single confidence score is shown.
6. Its cost ("So far: {cost}, on {account}.", `screen.assistant.run.cost.sofar`; "It used {cost}, on {account}.", `screen.assistant.run.cost.final`) is shown only to the owners of the account that pays.


## project: "Pothole repairs" (the project's title)

**Address.** `/app/project/<project>`. Breadcrumb: Projects › the project's title.
**Frame.** working.
**Who can see it.** Any signed-in member: a member who has joined the project sees all of it (S1); a member who has not sees S4; an administrator of a project every owner has left sees S3. An address naming no project leads to `unavailable`.
**Purpose.** A project's home: its objective, bar, questions, stage, plans, what the team has at stake in it, and its members.
**Entry points.** `projects` (a project's row); `home` (an open project); `dash-project`; the breadcrumb on `question`, `objective`, `projectai` and every screen under a project.

**Content (S1, a member of the project)**
- C1. Heading 1: the project's title; under it the line the project asks, e.g. "Is the city repairing reported potholes as its own policy requires?" (the record's text; label "What the project wants to get to the bottom of", `.objective`).
- C2. Section "Where it stands" (`.stage.head`): the four stages "Forming" (`.stage.forming`), "Investigating" (`.stage.investigating`), "Matured" (`.stage.matured`), "Closed" (`.stage.closed`), the one reached marked. Beneath, the project's bar ("No bar set for this project", `project.bar.none`, when none) and a fold "Other bars" (`project.bar.others.summary`).
- C3. Section "What each stage needs" (`.what.each.stage.needs`): `.the.record.decides.the.stage.by`, `.nothing.here.is.a.button.when`; one line per stage, "{stage} · reached" (`.stage.reached`) or "{stage} · not reached yet" (`.stage.not_reached`), with what it took or needs.
- C4. Fold "When the stage can't be read" (`.when.the.stage.can.t.be`): `.civicsmith.can.t.read.this.project`.
- C5. Section "The project's documents" (`.docs.head`): `.docs.about1` `.docs.about2`. One row per document: its title, a link to `document`, its kind ("Web page" `.docs.kind.web`, "Spreadsheet" `.docs.kind.sheet`, "Photo" `.docs.kind.photo`) and "captured" (`.docs.captured`) with the date. With none: `.docs.none1` "Add a document and it appears here." (`.docs.none2`).
- C6. Section "Objective" (`screen.objective.name`): `.how-far-the-project-has-come-toward-its-objectiv`, with a link to `objective` (link words: no word row).
- C7. Section "Questions" (`.questions.head`): one row per question, its words as a link to `question`, its two grades and its standing against the bar; a question with no citation shows "rests on nothing yet" (`.question.unrated`).
- C8. Fold "Draw on a question from elsewhere" (`project.draw.head`): a select "Which question" (`project.draw.which`) and button "Draw on it" (`project.draw.go`).
- C9. Section "What pays for the assistant here" (`.account.head`): one of "Paid for by the project's own API key" (`.account.project`), `.account.member`, `.account.off`; link "Open AI for this project" (`.account.open`) to `projectai`.
- C10. Section "What the team has at stake here" (`stake.project.title`): the team's own statement; a field "This project's stake (optional)" (`stake.project.label`) and button "Save this project's stake" (`stake.project.save`) `not built` (owed); "{n} earlier statements" (`stake.history`). Fold "When the stake can't be read" (`stake.unreadable.summary`): `stake.unreadable`.
- C11. Section "This project's work" (`project.work.title`): one link each to `plan` ("Action plan"), `timeline` ("Timeline"), `money` ("Money trail"), `calculation`, `proceeding`, `standard`, `request` ("Records requests"), `matter` ("Matters"), `action` ("Actions"), `case-editor` ("The case being prepared"), `review-copy` ("Review copies"), `ceremony` ("Publishing"), `published`, `docket` ("Docket"); the links to `calculation`, `proceeding`, `standard` and `published` have no word row.
- C12. Section "Members" (`.members.head`): one row per member, an owner marked with "owner since {date}" (`project.member.since`); a pending change `project.owners.pending`; the rule `project.owners.rule`.
- C13. Section "Telling the network" (`.notice.heading`): `.notice.an.owner.can.publish.a` `.notice.it.is.public.and.it`.
- C14. Fold "This project's settings" (`project.settings.fold`): section "Who can find it" (`project.visibility.title`) with `project.visibility.discoverable` or the hidden line (`project.visibility.hidden`), and its history (`project.visibility.history`); section "Close this project now" (`.closenow.head`) with `.closenow.open`.
- C15. `AI` `not built`: a section "Suggested questions" (no word row), each a question the assistant suggested or found while exploring, with its machine-work label and button "Open this question" (no word row). Absent without the assistant.

**States**

| State | When | What shows (exact) |
|---|---|---|
| S1 In use | a member of the project, the project holding questions | C1 to C14 as above. |
| S2 New, no questions | the project holds no question | Heading 1 the title; "Opened by {name} on {date}." (`.opened`); `.questions.empty`; field "Your first question" (`project.firstquestion`) with help (`project.firstquestion.help`); buttons "Open a question" (`act.promote.label.project`) and "Draw on a question from elsewhere" (`act.drawquestion.label.project`). |
| S3 Every owner gone (an administrator) | every owner has left the team; an administrator opens it | `.rescue.opened`; heading `project.rescue.title` with `project.rescue.says`; field "Why" (`.rescue.why.help`); button "Become its owner" (`project.rescue.go`); `project.rescue.own`. Nothing else of the project. |
| S4 Not a member | a member of the team who has not joined | Heading 1 and the line it asks; `project.notmember`; button "Ask to join" (`act.projectrequest.label.project`). After asking: "You asked to join on {date}. Its owners decide." (`projects.request.asked`) and button "Withdraw your request" (`act.projectrequestwithdraw.label.project`). No documents, questions or members. |
| S5 An owner standing down | a vote to end an owner's ownership is open | `.dev.is.standing.down.as`; section "What it takes" (`.standdown.heading`) with `.this.takes.2.of.2`, each owner `.standdown.agreed` or `.standdown.notyet`, `.1.of.2.have.agreed`; button "Agree: {member} stands down as owner" (`.agree.dev.stands.down.as`); table "How it changes with the number of owners" (`.how.it.changes.with.the`); section "Before you vote" (`.standdown.beforevote`) with the `.ownerstand.*` lines and field "Your reason" (`shell.reason`). |
| S6 Preparing a notice | an owner presses "Tell the network we are working on this" | Heading 1 `.notice.tell.the.network.you.are`; four fields (`.notice.what.the.team.is.working`, `.notice.a.few.words.more.optional`, `.notice.the.matter.it.belongs.to`, `.notice.working.on.it.since`); checkbox `.notice.we.welcome.others.who.want`; button "Preview the notice"; the preview marked `screen.connect.outward`; checkbox `.notice.i.understand.that.this.is`; button "Sign and publish the notice". |
| S7 Notice published | the notice is signed and published | `.notice.the.notice.is.published.at`; section "The notice" (`.notice.thenotice`) with its wording, `.notice.as.the.teams.civicsmith.worked`, `.notice.the.next.monthly.check.is`; section "Change it or stop it" (`.notice.change.it.or.stop.it`) with buttons "Change the notice" (`.notice.change`) and "Stop the notice…" (`.notice.stop`). |
| S8 A rerun of an imported case | the project reruns another team's case | `.cmp_head`, `.cmp_unchanged`; sections "How the two lenses differ" (`.cmp_lens_diff`), "Their findings and ours" (`.cmp_findings`); select `.cmp_pair_label`; `not built` buttons "Compare with the original" (`act.owed_rerunread.label.project`) and "This answers the same claim" (`act.owed_rerunpair.label.project`). |
| Assistant not reachable (the walk) | no AI account serves the member | S1 without C15 and without "Help me write this"; C9 still shows. |

**Actions**

| Control | When offered | Where it leads |
|---|---|---|
| A1. button "Open a question" (`act.promote.label.project`), Asks for a reason | a member of the project | a new question; opens `question` for it. Field "The question, in plain words" (`.question.label`). |
| A2. button "Draw on it" (`project.draw.go`) | a member of the project, a question chosen | same screen; the question is listed under Questions. Done: "This project now draws on that question." (`.draw.done`). |
| A3. button "Find in this project" (`act.findin.label.project`) | a member | `find-in`, set to this project |
| A4. link "Add a document" (`project.adddoc`) | a member | `capture`, set to this project |
| A5. button "List this project's documents" (`act.heldcaptures.label.project`) | a member | the documents list on the same screen (C5) |
| A6. link "Open it" on a document row | always | `document` |
| A7. link to the objective; link "Open AI for this project" (`.account.open`) | a member | `objective`; `projectai` |
| A8. button "Plan what to do" (`act.planopen.label.project`), Asks for a reason | a member | `plan` (fields "The plan's title" `.plan.label`, "For which question" `.plan.about`) |
| A9. button "Invite a member to the project" (`act.projectinvite.label.project`) | an owner | same screen; field "The member's handle" (`.invite.label`); the member listed "{handle} (invited)" (`.members.invited`) |
| A10. button "Join" (`act.projectjoin.label.project`) | an invited member | same screen; S1 |
| A11. buttons "Make an owner, or agree to it" (`act.projectowneradd.label.project`), "Stand down as owner" (`act.projectownerremove.label.project`), "Remove a member" (`act.projectremove.label.project`) | an owner | same screen; S5 for standing down |
| A12. button "Ask to leave this project" (`act.projectleave.label.project`) | a member | same screen |
| A13. button "Start a project from this one" (`act.projectfork.label.project`) | a member | a new project; its `project` |
| A14. button "Set this project's bar" (`act.projectbarset.label.project`); button "Change who can find this project" (`act.projectvisibilityset.label.project`) | an owner | same screen; C2 or C14 changes |
| A15. button "Tell the network we are working on this" (`.notice.tell.the.network.we.are`) | an owner | S6 |
| A16. button "Preview the notice" (`act.noticeprepare.label.project`); button "Sign and publish the notice" (`act.noticepost.label.project`), You sign this | an owner, in S6 | the preview on the same screen; then S7 |
| A17. button "Close this project with this reason" (`.closenow.do`) `not built` (owed); select "Why you are closing it" (`.closenow.why`) | an owner | same screen; stage Closed |
| A18. button "Ask to join" (`act.projectrequest.label.project`); "Withdraw your request" (`act.projectrequestwithdraw.label.project`) | S4 | same screen, the request line changes |
| A19. button "Become its owner" (`project.rescue.go`) | S3, an administrator | same screen; S1 |
| A20. `AI` button "Help me write this" (`act.writinghelp.label.project`) beside the stake field | the assistant reachable | a draft labeled as the assistant's in the field |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. "The question, in plain words" | empty | "Ask the question first." (`.question.empty`) |
| V2. Draw on a question | none chosen, or no reason | "Choose a question and say why this project draws on it." (`.draw.empty`) |
| V3. Draw on a question | already drawn on | "This project already draws on that question." (`.draw.already`) |
| V4. "The member's handle" | empty | "Name the member to invite by their handle." (`.invite.empty`) |
| V5. Plan | no title or no question | "Give the plan a title and choose its question." (`.plan.empty`) |
| V6. Close | not an owner; no reason | "Only an owner can close this project." (`.closenow.ref.owner`); "Choose one of the three reasons: resolved, superseded by other work or abandoned." (`.closenow.ref.reason`) |
| V7. Notice | refused | under "When a notice can't be prepared" (`.notice.when.a.notice.cant.be`): `.notice.this.project.already.has.an`, `.notice.the.date.is.before.the`, `.notice.your.teams.public.address.or`, `.notice.this.project.is.closed` |
| V8. Pairing (S8) | refused | "Only this project's owners and joined members can pair findings." (`cmp_refused_member`); "That finding isn't one of this project's." (`cmp_refused_own`) |


## objective: "Objective"

**Address.** `/app/objective/<project>`. Breadcrumb: Projects › the project › "Objective".
**Frame.** working.
**Who can see it.** A member of the project. A member who has not joined sees the project's S4 on `project`; acts on proposals need a joined member (V6).
**Purpose.** A project's objective on its own page: what success means and how it is measured, how it is going, what is still short, the proposals to decide, the aspirations behind it, and the goals it serves.
**Entry points.** `project`, section "Objective" (C6).

**Content**
- C1. Heading 1 "Objective" (`.name`); under it the objective's own words.
- C2. Section "What success means" (`.what-success-means`): the measure, `.success-is-reached-when-at-least-of-the-made-for`, who set it and when, and its reason.
- C3. Fold "Set how success is measured" (`.set-how-success-is-measured`): selects "Which flow of events", "About which party", "Linked to it as (optional)", "Every link at least grade (optional)"; field "Only amounts of at least (optional)"; group "Each one must have reached" with a checkbox per stage; fields "Share that must meet it, from 1 to 100 percent" and "Why you measure it this way" ("Required, in your own words."); then `.if-the-objective-or-the-party-you-chose-names-a`.
- C4. Section "How it is going" (`.how-it-is-going`): `.rent-payments-meet-the-measure-are-short` `.success-needs-so-it-is-not-yet-reached`; `.not-yet-decidable-of-the-short-payments-may-stil`; `.this-is-counted-again-each-time-you-open-the-scr` "It is never typed in." (`.it-is-never-typed-in`).
- C5. Section "What is still short" (`.what-is-still-short`): one row per shortfall with its reason and grade; `.each-shortfall-is-also-offered-to-you-as-a-propo`.
- C6. Section "Proposals to decide" (`.proposals-to-decide`): `.things-the-record-suggests-this-objective-should`, `.nothing-happens-until-a-member-decides`; each proposal marked "worked out by Civicsmith" (`.shown-by-the-machine`); select "Which proposal"; radios "Adopt it into this objective", "Open a question from it", "Defer it", "Dismiss it"; field "Why (required to defer or dismiss it)".
- C7. Section "Aspirations" (`.aspirations`): each aspiration marked "Held by the whole team", "Held by this project" or "Held by me", and "This project departed" where it did. Folds "Declare an aspiration" (select "Who holds it": "The whole team's", "This project's", "Mine"; field "What it holds to"), "Depart from the team's aspiration" (field "Why this project departs"), "Record a dead end" (field "What was tried, and why it went nowhere"; `.dead-ends-so-far`), "Retire an aspiration" (field "What pursuing it taught").
- C8. Section "Goals this objective serves" (`.goals-this-objective-serves`): folds "Open a goal" (fields "What it pursues", "What limits it"; select "Under which aspiration (optional)"), "Say this objective serves a goal" (select "Which goal"), "Close a goal" (field "Why it closes").

**States**

| State | When | What shows (exact) |
|---|---|---|
| S1 With a measure | a measure of success is set | C1 to C8; C4 gives the count; C5 lists the shortfalls. |
| S2 No measure yet | no measure is set | C2 reads `.this-objective-has-no-measure-of-success-yet-so` `.choose-what-counts-and-the-screen-works-it-out-f`; C4 reads "Not counted yet: no measure of success is set." (`.not-counted-yet-no-measure-of-success-is-set`); C5 is not drawn. |
| Assistant not reachable (the walk) | no AI account serves the member | S1 or S2 with no "Help me write this" beside any own-words field. Nothing else changes: the counts are Civicsmith's, not the assistant's. |

**Actions**

| Control | When offered | Where it leads |
|---|---|---|
| A1. button "Save this measure of success" (`act.objectivecondition.label.objective`), Asks for a reason | a joined member | same screen; C2 and C4 recount |
| A2. button "Stop measuring this objective" (`.stop-measuring-this-objective`), Asks for a reason | a measure is set | same screen; S2 |
| A3. button "Decide this proposal" (`act.triage.label.objective`), Asks for a reason | a joined member | same screen; the proposal leaves the list, or a new `question` is opened |
| A4. button "Declare this aspiration" (`act.aspirationdeclare.label.objective`) | see V4 | same screen; listed in C7 |
| A5. button "Record this departure" (`act.aspirationdepart.label.objective`) | a joined member | same screen; "This project departed" shows |
| A6. button "Record this dead end" (`act.aspirationdeadend.label.objective`) | whoever may change the aspiration | same screen; the dead end is listed |
| A7. button "Retire this aspiration" (`act.aspirationretire.label.objective`), Ends something | whoever may change it | same screen |
| A8. button "Open this goal" (`act.goaldeclare.label.objective`); "Link this objective to the goal" (`act.goallink.label.objective`); "Close this goal" (`act.goalclose.label.objective`), Ends something | a joined member | same screen; C8 changes |
| A9. `AI` button "Help me write this" (`act.writinghelp.label.objective`) beside each own-words field | the assistant reachable | a labeled draft in the field |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. Measure | not a joined member | "Only a named member can set it, and only a member who has joined this project." (`.only-a-named-member-can-set-it-and-only-a-member`) "If you have not joined, ask to join first." (`.if-you-have-not-joined-ask-to-join-first`) |
| V2. Measure | no reason | "A reason is required, also to remove the measure." (`.a-reason-is-required-also-to-remove-the-measure`) "Say why, and save again." (`.say-why-and-save-again`) |
| V3. Measure | unknown flow, party, stage, grade, or share outside 1 to 100 | `.the-measure-names-a-flow-a-party-or-a-stage-the` and "Choose from the lists and save again." (`.choose-from-the-lists-and-save-again`) |
| V4. Aspiration | not allowed, or empty | `.only-an-administrator-can-declare-change-or-reti`; `.a-member-s-own-aspiration-is-declared-by-that-me`; `.say-what-it-holds-to-and-name-only-parties-and-f` |
| V5. Departure | no reason; retired aspiration | "A departure records why." (`.a-departure-records-why`); `.this-aspiration-is-retired-so-nothing-holds-to-i` |
| V6. Proposal | no reason to defer or dismiss; no longer open; not joined | `.putting-it-off-or-dismissing-it-needs-a-reason-i`; `.that-proposal-is-no-longer-open-another-member-d`; `.you-can-act-on-a-proposal-only-in-a-project-you` |
| V7. Dead end, retiring, goal, link, closing | refused | `.write-what-was-tried-and-why-it-went-nowhere`; `.retiring-records-what-pursuing-it-taught`; `.say-what-it-pursues-and-what-limits-it`; `.a-closed-goal-takes-no-new-objective`; `.a-goal-closes-with-its-reason` |


## projectai: "AI for this project"

**Address.** `/app/projectai/<project>`. Breadcrumb: Projects › the project › "AI for this project".
**Frame.** working.
**Who can see it.** Every member of the team who can see the project; what each sees depends on their role (S1 to S5). In the first beta, `aiproject` (page `ai`) takes its place.
**Purpose.** Who pays for the assistant's work in a project: its own API key, or its sole member's sign-in; what it pays for; its limits; its use summed, naming no member; keeping the project's material away from AI; every change, seen by every owner.
**Entry points.** `project`, link "Open AI for this project" (`screen.project.account.open`).

**Content**
- C1. Heading 1 "AI for this project" (`.name`); `.sub`.
- C2. The rule of who pays (`ai.whopays`), 2 sentences: a project's own account pays first, then the member's own, then the team's key; the account chosen is the one used.
- C3. The state line: S1 `.state.key`, S2 `.state.signin`, S3 `.account.suspended`, S4 `.state.member`, S5 `projectai.notjoined`.
- C4. Section "The project's account" (`.account.head`), owners only: radios "Paid for by" (`.paidby.key`, `.paidby.signin`, `.paidby.none`); field "The project's API key" (`.key.field`) with `.key.help`; `.owners.alone`.
- C5. Section "What it pays for" (`.uses.heading`), owners only: one checkbox per use (`ai.use.*`) and select "Exploring" (`ai.use.explore.name`) with "No", "Ask every day", "Yes" (`ai.explore.no`, `ai.explore.ask`, `ai.explore.yes`); `screen.panel.uses.stops`.
- C6. Limits (the shared AI account panel, `screen.panel.*`): a table of limits, each row with button "Remove" (`screen.panel.limit.remove`); select "Limit on", field "Amount", selects "In" and "Each". S2 heads it "Limits on your sign-in here" (`.limits.signin`), in tokens or calls only.
- C7. Use (S1 only): a table by use, 30 days of bars, `.meter.month`, `.meter.explore`, and `screen.panel.usage.group` ("Summed over members; nobody is named, and nothing asked is shown.").
- C8. Section `.keepaway.head`: for owners, group `.keepaway.which` with "For every use" (`screen.members.keepaway.all`) or "Only for these uses" (`screen.members.keepaway.some`), field "Why (every member will see this)" (`screen.members.keepaway.reason`), button "Keep this project's material away" (`.keepaway.button`); when on, `.keepaway.on`.
- C9. Section "Changes, seen by every owner" (`.changes.head`), owners only: one line per change, newest first (`.change.*`).

**States**

| State | When | What shows (exact) |
|---|---|---|
| S1 Owner, the project holds its own key | an owner opens it; the project holds an API key | C1 to C9; C3 is `.state.key` ("{project} has its own Anthropic API key (ending …{last4}) · {state} · set by {name}, {date}. …"). |
| S2 Owner, own sign-in serving | the owner is the project's only member and chose their own sign-in | C3 is `.state.signin`; C6 headed "Limits on your sign-in here"; no C7. |
| S3 Owner, sign-in stopped serving | a second member joined | C3 is `.account.suspended`. |
| S4 A member who is not an owner | a joined member, not an owner | C1, C2, C3 (`.state.member`); section "Before your first question here" (`.notice.head`) with "Outward · leaves your team's Civicsmith" (`screen.connect.outward`), the disclosure (`ai.disclosure.projectkey`) and button "I have read this" (`screen.connect.read.button`); C8 reads `.keepaway.member`. No C4 to C7 or C9. After reading: "You have read what the project's key means." (`.notice.seen`). |
| S5 Not joined | a member of the team who has not joined | C1, C2 and `projectai.notjoined`, with button "Join" (`act.projectjoin.label.projectai`). Nothing else. |
| No account anywhere (the walk) | no AI account serves the team or the member | Drawn as S1 to S5 for the viewer's role; a project with no account shows "This project holds no account of its own: each member's own account, or the team's key, pays as usual." (`.account.none`). |

**Actions**

| Control | When offered | Where it leads |
|---|---|---|
| A1. button "Hold the project's API key" (`act.projectkeyset.label.projectai`), Asks for a reason | an owner | same screen; S1, switched off; the key is never shown again ("The key is sealed when held and never shown again, to anyone.", `.key.never`) |
| A2. button "Use your own sign-in for the project" (`act.projectsigninset.label.projectai`), Asks for a reason | an owner who is the only member, sign-in connected | same screen; S2 |
| A3. button "Switch the project's account on or off" (`act.projectaccountswitch.label.projectai`), Asks for a reason | an owner, an account held | same screen; C3's state changes |
| A4. button "Remove the project's account" (`act.projectaccountremove.label.projectai`), Ends something | an owner, an account held | same screen; `.account.none` |
| A5. "Set what the project's account pays for" (`act.accountusesset.label.projectai`) | an owner | same screen; C5 |
| A6. button "Set the limit" (`screen.home.ailimit.set`), "Remove" (`screen.panel.limit.remove`) (act "Set a limit on the project's account", `act.ailimitset.label.projectai`) | an owner | same screen; C6 |
| A7. button "Keep this project's material away" (`.keepaway.button`) (act `act.projectaikeepaway.label.projectai`), Asks for a reason; "Stop keeping it away, with a reason" (`.keepaway.turnoff`) | an owner | same screen; C8 |
| A8. button "I have read this" (`screen.connect.read.button`) (act `act.projectkeynoticeseen.label.projectai`) | S4 | same screen; `.notice.seen` |
| A9. button "Join" (`act.projectjoin.label.projectai`) | S5 | same screen, S4 or the owner's view |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. The project's API key | empty | "Paste the API key first." (`.key.nokey`) |
| V2. Own sign-in | the project has other members | `ai.refused.notsole` |
| V3. Own sign-in | not connected | "Connect your own Claude sign-in first, in Settings › The assistant; then it can serve this project." (`ai.refused.signinnotconnected`) |
| V4. Limit | not a positive amount | `ai.refused.limitinvalid` |
| V5. Limit in dollars on a sign-in | always | `ai.refused.unitunavailable` |
| V6. Keep away | reason missing or too long | "Say why, in 1 to 2,000 characters." (`.keepaway.noreason`) |


## question: the question's own words

**Address.** `/app/question/<question>/<project>`. Breadcrumb: Projects › the project › "Question".
**Frame.** working.
**Who can see it.** A member who may see the question. A question that does not exist leads to `unavailable`.
**Purpose.** A question and what supports it or cuts against it; what each cited passage carries; its strength against the bar; its readings and the one a project stands on; what relies on it; concluding.
**Entry points.** `project` (Questions, C7); `project` A1 (a new question, S3); `queue`; `finder` results; `document` after citing; `dash-project`; `objective` A3 (a question opened from a proposal).

**Content (S1)**
- C1. Heading 1: the question's own words. Under it "Opened by {name}, {date} · {project}" (`.opened`).
- C2. Three steps: "Bring in a source" (`question.steps.source`), "Mark what it says" (`question.steps.mark`), "Say what you conclude" (`question.steps.conclude`).
- C3. Strength: two grades, the standing against the bar, `.strength.two`, "What raises it: {raise}" (`.strength.raise`); a gap such as "Undetermined, because {reason}" (`.gap.undetermined`); what it waits on, `.waits.setaside` with `.waits.since`.
- C4. Section "Supports" (`.supports.head`): select "Reading shown" (`question.reading.shown`); one row per cited passage: its grade, the quoted words, a link to its `document` and its passage, who cited it, and `question.falls` or `question.holds`. Then "What your answer rests on" (`question.rests.title`), `question.rests.any`, "Shared origin: …" (`question.origin.shared`) where two passages share one, and `question.rests.set`.
- C5. Another team's finding cited as support, marked "Another team's" (`.citeimp.origin`) with `.citeimp.origin.meta`. Section "Cite another team's finding" (`.citeimp.head`) and "Take back another team's finding" (`.citeimp.wd.head`), both `not built` (owed).
- C6. Section "Cuts against" (`.against.head`): the passages against, same row form.
- C7. Section "Hunches" (`.hunches.head`): each "Hunch · {who}'s" (`.hunch.by`) with its words; fold "Change or take back {name}'s hunch" (`.hunch.change.summary`).
- C8. Section "Readings" (`question.readings.title`): each reading with its words, `question.reading.accepted` or `question.reading.suggested`, `question.reading.standson`, and "its strength" or `question.reading.whatif`. Folds `.affirm.head`, `.say009` (only for a reading the assistant composed), `.say022`; `question.readings.more`.
- C9. Fold "Themes and what relies on this" (`question.around`): "Themes its passages are in" (`theme.question.section`) with links to `theme`; "What relies on this" (`question.relies.title`) with links to `project`, other questions and `published`; `question.relies.outofview`.
- C10. Section `.say045`: `.frozen.count`; per case `.frozen.published`, "Frozen when it published:" and "Today:", never combined.
- C11. Section "Needs a second look" (`.reeval.heading`): "A newer edition of {document} exists" (`.reeval.edition`), `.reeval.done`; field "What you looked at and what you decided" (`.reeval.note.label`).
- C12. Section "Concluding" (`.concluding.head`), fold "Conclude": select "The reading you conclude on" (`question.conclude.reading`) with "Write the reading yourself"; fields "Your reading", "What would change it", "Why you are concluding it", "Commentary" (`question.conclude.*`); checkbox `question.conclude.nofalsifier`.
- C13. Fold "More you can do with this question" (`question.more`); fold "Divide this question into two" (`.divide.summary`), with "This cannot be undone." (`.divide.note3`); fold `.say058` with "What this touches" (`.touches.heading`).
- C14. "Its plan: {plan}" (`question.plan.link`) linking to `plan`; links "The case being prepared" (`case.links.editor`) → `case-editor`, "Review copies" (`case.links.review`) → `review-copy`, "Publishing" (`case.links.ceremony`) → `ceremony`, "The published case's record" (`case.links.docket`) → `docket`.

**States**

| State | When | What shows (exact) |
|---|---|---|
| S1 The question | a question with cited passages | C1 to C14. |
| S2 Each passage asked | passages cited, not yet each answered | Heading `question.ask.first.title`, `question.ask.first.says`; no strength. Section "What each passage carries" (`question.ask.title`): per passage `question.ask`, radios "No, my answer falls" and "Yes, because of others I cite", then `question.ask.which`; `question.rests.readback`; button "Save the answers" (`question.ask.save`). Fold `.leggrade.head` with button "Record this grade". |
| S3 New, nothing cited | a question just opened | Heading 1; C2; section "Next: bring in a source" (`question.empty.heading`) with `question.empty.note`; rows "Add a document" (`question.empty.capture`), button "Find one the team has" (`question.empty.find`), and `AI` "Ask the assistant to look" (`question.empty.ask`, only while the assistant is reachable); `question.empty.conclude.own`. |
| S4 `AI` The assistant at work | a run of the member's is working on it | Heading 2 "The assistant is working on this question" (`question.run.heading`); progress rows (`ai.progress.read`, `ai.progress.found`, `ai.progress.composing`, `ai.progress.checking`); `ai.progress.hold`; the machine-work label; `question.run.leave`; button "Stop the run" (`question.run.stop`). No words of the proposal. |
| S5 `AI` What the assistant proposes | the run ended with a proposal, checked | `screen.assistant.run.ended`; heading 2 "What the assistant proposes" (`question.proposal.heading`): the reading quoted, `.proposal.rests`, the machine-work label, `ai.progress.checked.all`, on a test instance `ai.label.untested`; button "Accept this reading" (`question.proposal.accept`); fold "Reject this reading, with a reason" (`.reject.summary`) with field "Why you reject it" and button "Reject it" (`.reject.go`). |
| S6 `AI` Limit reached | the paying account's limit is reached | `ai.refused.limit.overall`; `question.limit.note`; fold "Other reasons the assistant can't work here" (`question.ai.other`) listing reasons by key (e.g. `refusal.ASSISTANT_REMOTE_NOT_READY`, `ai.refused.off`, `ai.refused.projectkeptaway`, `ai.refused.noaccount`, `dock.withheld.AGENT_WORKER_UNBOUND`) and `question.ai.whose`; link to `connect`. |
| S7 Concluded | a member concluded on a reading | Heading 2 "Concluded" (`question.concluded.heading`); `question.concluded.by` with the reading; `question.concluded.falsifier` and its strength; buttons "Prepare a case from this" (`act.casedraft.label.question`), "Plan what to do", "Withdraw the conclusion…" (`question.withdraw`); fold "Reopen this finding, with a reason" (`.reopen.summary`) with field "Why it no longer holds", button "Reopen this finding, with a reason" (`act.reopen.label.question`) and a link "start the next edition of the case" (`.reopen.next.link.text`) to `docket`. |
| S8 Concluded on a member's own reading | concluded on a reading a member wrote | As S7, with "Written by {member}" (`question.reading.by.member`) under the reading. |
| S9 `AI` Run ended, no proposal | the run ended without a proposal | "The run ended: {why}." (`screen.assistant.run.ended`) with the reason (e.g. `ai.run.ending.wallclock`, "it reached its time limit"); to the paying account's owner, "It used {cost}, on {account}." (`screen.assistant.run.cost.final`). |
| S10 `AI` Run stopped | the member stopped the run | "The run ended: you stopped it." (`screen.assistant.run.ended` with `ai.run.ending.cancelled`); `.stopped.kept`. |
| S11 Deferred for the project | the project deferred the question | "Deferred for {project} by you, {date}." (`.say000`) with the reason; `.say001` and `.say002`; fold "Change your decision" (`.decision.change`) with "What do you want to do with it now?" (`.say003`), radios "Defer it: come back to it later" (`.say004`), "Dismiss it: it is not worth pursuing" (`.say005`), field "Your reason", button "Set this question aside for the project" (`.say007`). |
| S12 Dismissed for the project | the project dismissed it | As S11 with "Dismissed for {project} by you, {date}." (`.say008`). |
| S13 Assistant not reachable (the walk) | no AI account serves the member | S1, S2, S3, S7, S8, S11 or S12 as the record stands, with these absent (not greyed, no reason shown): "Read in my language", "Help me write this", the S3 row "Ask the assistant to look", every reading the assistant composed and its bias fold, and S4, S5, S6, S9 and S10. The masthead has no "Assistant" button and no dock is drawn. |

**Actions**

| Control | When offered | Where it leads |
|---|---|---|
| A1. button "Cite a passage" (`act.cite.label.question`) | always | `document` to choose the passage; the passage is then listed in C4 or C6 (`.cite.from`) |
| A2. link "Add a document" (`question.adddoc`) | always | `capture`, set to this question |
| A3. button "Find another source" (`act.search.label.question`) | always | `finder` |
| A4. button "Remove" on a passage (act "Remove a citation", `act.sever.label.question`); button "Reinstate" (`act.reinstate.label.question`) | a cited passage; a removed one | same screen; "Removed from the question" (`.leg.severed`) |
| A5. button "Change what a passage carries…" (`question.rests.change`) (act `act.inquiryground.label.question`); "Save the answers" (`question.ask.save`) | always; S2 | S2; then S1 with the strength |
| A6. button "Restore it, with a reason" (`.waits.restore`) | a set-aside document | same screen; the document returns to C4 |
| A7. button "Keep a hunch" (`act.hypothesishold.label.question`); "Revise this hunch" (no word row; act `act.hypothesisrevise.label.question`); "Take this hunch back" (`.hunch.withdraw.button`), Ends something | always | same screen; C7 |
| A8. reading buttons "Accept this reading" (`act.versionaccept.label.question`), "Weigh a reading", "Reject a reading", "Undo the decision on a reading", "Hide a reading" (`act.versionconsider/versionreject/versionrevert/versionhide.label.question`), "Stand on this one for {project}…" (`.reading.standfor`) | per reading | same screen; C8 |
| A9. button "Place a passage in a theme…" (`theme.question.place`) | always | `theme` choice; the theme listed in C9 |
| A10. button "Record that you looked again" (`act.reevaluationrecord.label.question`); "See what needs a second look" (`act.reevaluations.label.question`) | C11 has an item | same screen; the item becomes "Looked at again by …" |
| A11. button "Conclude" (`act.conclude.label.question`), Asks for a reason | a reading to conclude on | S7 or S8 |
| A12. buttons "Narrow the question" (`act.narrow.label.question`), "Ask for a check by expertise" (`act.checkrequest.label.question`), "Plan what to do" (`act.planopen.label.question`) | always | a new narrower `question`; the request sent to members with that expertise; `plan` |
| A13. button "Divide this question" (`.divide.button`), Ends something | not concluded, nothing rests on it | two new questions; this one ends |
| A14. button "Set this question aside for the project" (`act.proposedispose.label.question`) | a participant of the project | S11 or S12 |
| A15. "Prepare a case from this" (`act.casedraft.label.question`); "Withdraw the conclusion…" (`question.withdraw`); "Reopen this finding, with a reason" (`act.reopen.label.question`) | S7, S8 | `case-editor`; S1; S1 |
| A16. `not built` "Cite another team's finding" (`act.owed_citeimported.label.question`); "Take it back, with a reason" (`.citeimp.wd.do`) | an accepted finding from `imported` | same screen; C5 |
| A17. `AI` button "Ask the assistant" (`act.airunopen.label.question`; in S3 "Ask the assistant to look", `question.empty.ask`) | the assistant reachable | S4 |
| A18. `AI` button "Stop the run" (`question.run.stop`) | S4 | S10 |
| A19. `AI` button "Read in my language" (`act.readtranslate.label.question`) | the assistant reachable | same screen: the text in the member's language, marked "Machine translation · original in {language}" (`translate.label`); the same control shows the original again |
| A20. `AI` button "Help me write this" (`act.writinghelp.label.question`) beside a hunch or a reading field | the assistant reachable | a labeled draft in the field |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. Conclude | no reason | "Say why you are concluding it first: a question is concluded only with a reason. Write it in the box above, then conclude again." (`question.conclude.reason.needed`) |
| V2. Accept a reading of parts each enough | a part not ticked | `refusal.VERSION_AFFIRMATION_INCOMPLETE` ("Tick each part first: …") |
| V3. Hunch | empty | "Write the hunch first." (`.hunch.empty`); change refused: `.hunch.refused.body`, `.hunch.refused.body2` |
| V4. Narrow | no name or reason | "Name the narrower question and say why." (`.narrow.empty`) |
| V5. Check by expertise | empty | "Name the expertise needed and say what to check." (`.check.empty`) |
| V6. Plan | no title | "Give the plan a title." (`.plan.empty`) |
| V7. Reopen | no reason; bad reason; not in a case | `.reopen.refused.noreason`; `.reopen.refused.badreason`; `.reopen.refused.notsetdown` |
| V8. Second look | refused | `.reeval.refused.body`, `.reeval.refused.body2` |
| V9. Divide | refused | `.divide.refused.body`, `.divide.refused.body2` |
| V10. Set aside | not a participant; no reason | "You are not a participant in {project}, so you cannot set the question aside for it." (`.say074`) "Nothing was recorded."; "A reason is required." (`.say075`) |
| V11. Take back another team's finding | not cited; no reason | `.citeimp.wd.ref.notcited`; "Say why you are taking it back." (`.citeimp.wd.ref.noreason`) "Nothing was changed." (`.citeimp.wd.ref.nothing`) |


## answers: "Ask" / "Find and count"

**Address.** `/app/answers`. Breadcrumb: Find › "Ask".
**Frame.** working.
**Who can see it.** Any signed-in member. Which heading it carries depends on whether the assistant is reachable for the member.
**Purpose.** Ask in plain words (with the assistant) or by search (without); keep asking.
**Entry points.** `finder` (Find); `home`.

**Content, with the assistant (S1 to S4)**
- C1. Heading 1 "Ask" (`.name`); `.sub`.
- C2. Field "Your question" (`.question`); buttons "Ask" (`act.ask.label.answers`) and "Search instead" (`act.search.label.answers`).
- C3. The answer, as machine work: its sentences, each followed by links to the passages it rests on; "Read as: {question}" (`.asread`); "Not established" (`.notestablished`) with `.withheld` where sentences were held back; "Where it rests" (`.holdings`) with links to `document`; "Where it looked" (`.looks`), one line per level (`.level.*`) and state (`.state.*`); "Checked by Civicsmith before it was shown" (`ai.progress.checked.all`); "Legal information, not legal advice." (`.legal`); on a test instance `ai.label.untested`; `.machine`.
- C4. Buttons "Show how this was counted" (`act.ruleanswer.label.answers`), "Keep asking this" (`act.standingquestionset.label.answers`), "Stop asking" (`act.standingquestionend.label.answers`); `.keeping`; once kept, "Asked again {cadence} until {date}." (`.kept`, cadence "every week" `.cadence.weekly`).

**Content, without the assistant (S5)**
- C5. Heading 1 "Find and count" (`.offtitle`); `.offsub`.
- C6. A search field and button "Search" (`act.search.label.finder`).
- C7. Results: one row per document, its title a link to `document`, marked "Found by search" (`mark.origin.search.name`); a count line `.count.line` where a table was counted; with none, `screen.finder.none`.
- C8. C4's buttons and lines.

**States**

| State | When | What shows (exact) |
|---|---|---|
| S1 `AI` The answer | the assistant answered and Civicsmith's check passed | C1 to C4. |
| S2 `AI` At work | an ask is being answered | C1, C2; in a polite live region, rows "Reading {document}" (`ai.progress.reading.ask`), "Writing its answer…" (`ai.progress.composing.answer`), "Civicsmith checks it before you see it" (`ai.progress.checking`); "Its answer shows here once Civicsmith has checked it." (`ai.progress.hold.answer`); the machine-work label. No answer words. |
| S3 `AI` Check failed | the check found a cited passage not as quoted | `ai.progress.check.failed`; "Ask again, perhaps more narrowly, or search instead." (`.failed.next`). |
| S4 `AI` Not ready | the assistant's connection has not passed its check | `refusal.ASSISTANT_REMOTE_NOT_READY` and a link "The assistant" (`screen.connect.name`) to `connect`. |
| S5 Find and count (the walk) | no AI account serves the member | C5 to C8; no "Ask", no field "Your question", and nothing about the assistant. |
| S6 Nothing matches | S5, a search with no result | C5, C6, "Nothing your team holds matches these words." (`screen.finder.none`). |

**Actions**

| Control | When offered | Where it leads |
|---|---|---|
| A1. `AI` button "Ask" (`act.ask.label.answers`), Asks for a reason | the assistant reachable | S2, then S1 or S3 |
| A2. `AI` button "Search instead" (`act.search.label.answers`) | the assistant reachable | `finder` with the words |
| A3. button "Search" (`act.search.label.finder`) | S5 | same screen; C7 lists the results |
| A4. button "Show how this was counted" (`act.ruleanswer.label.answers`) | an answer or count is shown | same screen: "{label}: {value}" (`.rule.value`) with "Basis: {basis}" (`.rule.basis`) or "Not held: {reason}" (`.rule.notheld`) |
| A5. button "Keep asking this" (`act.standingquestionset.label.answers`) | always | same screen; `.kept` shows; new matches reach `queue` |
| A6. button "Stop asking" (`act.standingquestionend.label.answers`) | the question is kept | same screen; the kept line goes |
| A7. a passage or holding link | S1 | `document` at that passage |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. "Your question" | empty on Ask | "Write your question first." (`.questionfirst`) |
| V1b. search field (S5) | empty on Search | "Write what to search for first." (`screen.finder.wordsfirst`) |
| V2. Ask | the team keeps its material away from the assistant | "Your team keeps its material away from the assistant, so it can't answer here. Find and count still work." (`.refused.off`) |
| V3. Ask | this part not deployed | "The assistant can't yet answer questions here: this part has not passed its tests. Find and count still work." (`.refused.notdeployed`) |
| V4. Ask | a limit reached; a use switched off; a project keeps material away | `ai.refused.limit`; `ai.refused.off`; `ai.refused.projectkeptaway` |


## assistant: "The assistant panel"

**Address.** None of its own. It is drawn in the dock beside a working-frame screen (its subject is that screen's question or project), opened and closed by the masthead button "Assistant" (`shell.assistant`); the dock's close button is "Close the assistant" (`shell.assistant.close`). Breadcrumb of the screen it serves.
**Frame.** dock.
**Who can see it.** A signed-in member for whom the assistant is reachable: the assistant is on and the member holds their own account, is signed in with Claude, or the team's key is on. Anyone else never sees it, and sees no sign of it.
**Purpose.** Docked beside the screen it serves; runs on whichever account serves the member, the team's key or the member's own, and says which.
**Entry points.** The masthead button "Assistant" (`shell.assistant`) on any working-frame screen, most often `question`.

**Content**
- C1. Header "The assistant" with the machine mark; to the paying account's owner, "{used} of your {limit} today" (`.use`).
- C2. "The assistant serves you here on:" (`.serves`) "On your own account" (`ai.serves.own`) or "On the team's key" (`ai.serves.group`); "It works for you alone." (`.alone`) `.says`. If unknown: `.serves.unknown`.
- C3. Section "The assistant's run" (`.run.head`): `.run.none`, or "Working on this: step {ticks}." (`.run.running`), or "The run ended: {why}." (`.run.ended`); "A run of yours is working on this." (`dock.run.yours`); the cost to the paying account's owner ("So far: {cost}, on {account}.", `.run.cost.sofar`).
- C4. Section "What it produced" (`.productions.head`): each production with the machine-work label and `.notevidence`; on a test instance `ai.label.untested`; every answer carries `ai.progress.checked.all`, its citations as links to `document`, and "Legal information, not legal advice." (`screen.answers.legal`) where it says what a law, rule or standard requires.
- C5. Fold `dock.ifnot`: the withheld reasons by key, `dock.withheld.<CODE>` (e.g. `dock.withheld.MEMBER_PRINCIPAL_RUN`, `dock.withheld.AGENT_WORKER_UNBOUND`, `dock.withheld.CREDENTIAL_RECORD_SILENT`), else `dock.withheld.other` with a reference.
- C6. Fold "Your account's use, last 30 days" (`dock.use.head`), to the account's owner only.
- C7. Footer: field "Ask about this screen" (`.ask.label`); buttons "Ask" (`act.ask.label.assistant`), "Ask the assistant to work on this" (`act.airunopen.label.assistant`), "Suggest" (`act.suggest.label.assistant`), "Stop the run" (`act.airunclose.label.assistant`).

**States**

| State | When | What shows (exact) |
|---|---|---|
| S1 `AI` No run yet | the dock is open, no run on this subject | C1, C2, C3 with `.run.none`, C7. |
| S2 `AI` A run working | a run of the member's is working | C3 with `.run.running` and `dock.run.yours`, the cost line to the payer; "Stop the run" offered; it re-reads every 10 seconds. |
| S3 `AI` A run ended | the run ended | C3 with `.run.ended` and the reason (`ai.run.ending.*`); C4. |
| S4 `AI` A run can't start | the start is refused or withheld | C5's reason for the refusal, never blank; "Nothing was sent." is part of each reason. |
| S5 `AI` No context | the screen served is neither a question nor a project | `.run.nocontext`. |
| S6 Not reachable (the walk) | no AI account serves the member | Not drawn. No dock, no masthead button "Assistant", and no placeholder or reason in their place. |

**Actions**

| Control | When offered | Where it leads |
|---|---|---|
| A1. `AI` button "Ask" (`act.ask.label.assistant`) with field "Ask about this screen" | the dock open | the answer drawn in the dock, labeled machine work, after Civicsmith's check |
| A2. `AI` button "Ask the assistant to work on this" (`act.airunopen.label.assistant`) | a question or project served | S2; "Started: the assistant is working on this." (`.run.dispatched`) |
| A3. `AI` button "Suggest" (`act.suggest.label.assistant`) | a run on a question | a suggested reading added to the question's Readings, "Suggested by …", with the machine-work label (fields "A name for the suggested reading" `.suggest.name`, "What it would answer" `.suggest.description`) |
| A4. `AI` button "Stop the run" (`act.airunclose.label.assistant`) | S2 | S3; what it produced stays labeled as its draft |
| A5. `AI` button "Close the assistant" (`shell.assistant.close`) | the dock open | the dock closes; the screen it served stays |

**Form messages.** Refusals of a start, drawn in C5: `.dispatch.principal`, `.dispatch.notactive`, `.dispatch.silent`, `.dispatch.notprincipal`, `.dispatch.unbound`, `.dispatch.notrunning`, `.dispatch.unknown`; and "The assistant isn't ready to work here: its instructions could not be read." (`.run.notready`).


## Differences seen in the code

Paths are under `bio-plane/src/`.

- `screens-inquiry/assistant.mjs:236-243`: the dock draws "Ask the assistant to work on this", "Suggest" and "Stop the run", but no field "Ask about this screen" and no "Ask" (registry act `ask` on `assistant`); C7 and A1 above are not built.
- `screens-inquiry/project.mjs`: no "Suggested questions" section and no word rows for it (C15 is `not built`).
- `screens-inquiry/project.mjs:167`: the not-joined state is drawn with "You can see that this project exists, but not its work, until you join it." where the design draws "You aren't in this project. Ask to join, and its owners decide." (`project.notmember`), and adds "Ask an owner to invite you: {owners}." (`screen.project.notjoined.owners`).
- `screens-daily/answers.mjs:148`: without the assistant, "Show how this was counted" is drawn only after words are searched and while the rule services read on; the design shows it with every count.
- `screens-daily/answers.mjs:145`: the search field without the assistant is labeled "Your words" (`screen.finder.words`); the design draws no label.
- `screens-inquiry/question.mjs:145`: "Read in my language" is drawn only while the assistant is reachable; the design's mockup draws it without the assistant too. The page above follows the rule "absent, not greyed" and marks it `AI`.
- Not the code but the design's own sources: the objective mockup (`docs/development/ux-substrate/screens/mock-screens.js:1557`) draws "Whose it is" and "Put it off"; the word table has "Who holds it" and "Defer it", quoted here.

## Changes

- 22 Nov 2026: written.
