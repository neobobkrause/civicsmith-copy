Length: N lines. Last section: "Changes".

# Screens: Daily work

Page `daily-work` of the Screens document (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

This page holds thirteen of the group's fifteen screens. The other two, `document` and `contradiction`, are on the page `reading-a-document` ([reading-a-document.md](reading-a-document.md)): together they would pass the page limit. Both pages belong to the group "daily work".

What every screen shares (the working frame, the rail, the strip, the assistant dock, how a refusal is shown, signing out) is on the page `every-screen` and is not repeated here. Every screen on this page is in the working frame: a visitor who is not signed in is shown `front`, and the address is kept to return to after signing in (`every-screen`). An address naming a subject the member may not see, or that does not exist, shows `unavailable`.

The walk runs with no AI account, so the assistant is unreachable. Where a screen offers the assistant, its "Assistant unreachable" state says what shows then. The assistant is absent, not greyed: no control for it is drawn.

Words are quoted with their key from `words.json`. Values in braces, such as `{n}`, are filled in from the team's record. Data in the test team (Lakeshore Tenants, index section 5) replaces the mockups' sample names.

## The screens on this page

| id | heading | address | built? |
|---|---|---|---|
| `home` | "Lakeshore Tenants" (the team's name; "Your team" before it has one) | `/app` | built |
| `projects` | "Projects" | `/app/projects` | built |
| `theme` | "Themes"; one theme: the theme's name | `/app/theme`, `/app/theme/<theme>` | built |
| `dash-action` | "Action" | `/app/dash-action` | built |
| `dash-project` | the project's title | `/app/dash-project/<project>` | built |
| `elsewhere` | "Where else to go" | `/app/elsewhere` | built |
| `queue` | "Your queue" | `/app/queue` | built |
| `finder` | "Find" | `/app/finder` | built |
| `capture` | "Add to the record" | `/app/capture` | built |
| `held` | "Held captures" | `/app/held` | built |
| `archive` | the archive's title | `/app/archive/<archive>` | built |
| `open-file` | the file's title | `/app/open-file/<file>` | built |
| `find-in` | "Find in this" | `/app/find-in/<subject>` | built |
| `document` | the document's title | on page `reading-a-document` | built |
| `contradiction` | "Two documents in tension" | on page `reading-a-document` | built |

---

## home: "Lakeshore Tenants"

**Address.** `/app`; also `/` when signed in.
**Frame.** Working; rail place Home.
**Who can see it.** Every signed-in member. Signed out: `front`.
**Purpose.** The team's nerve center: what needs you, what needs the team, every area at a glance, the projects and what changed since you last looked (`screen.home.purpose`).
**Entry points.** Rail "Home"; signing in; `elsewhere` link "Back to Home"; `queue` link "Go to Home".

**Content (S1, a busy team)**
- C1. Heading: the team's name; beneath it the team's own description.
- C2. The strip (the chips of what is due, drawn as on `every-screen`); for example "1 of our own dates passed" (`home.strip.ours_passed.one`), whose card ends "Opens your queue at this item." (`home.strip.ours_passed.opens`).
- C3. Section "Needs you" (`screen.home.needsyou`), help: `screen.home.needsyou.holds` (what is yours to do, soonest first; not shown when nothing needs you). Rows, each with its act: "Vouch for the {count} copies you captured at {place}" (`screen.home.todo.vouch`; also `.one`, `.noplace`, `.noplace.one`); "Decide on a newer version of {document} you cited" (`screen.home.todo.newer`); "Approve the {kind} to {office}, drafted by {name}" (`screen.home.todo.approve`); "{name} asked you to check a calculation: {calculation}" (`screen.home.todo.check`); a request to join, a project invitation, an update ready ("An update to your team's Civicsmith is ready: release {version}{security}", `home.update.ready`, with ", with a security fix", `home.update.security`).
- C4. Section "Needs the team" (`screen.home.needsgroup`), help `screen.home.needsgroup.holds`. Rows: "Waiting for a member to look: {held} in Held captures, {inbox} in Inbox." (`screen.home.waiting.counts`); "{office}'s reply to “{action}” was due {date}; no reply recorded" (`screen.home.group.noreply`); "Two documents give different dates for {what}" (`screen.home.group.tension`) with "nobody has judged it" (`screen.home.group.unjudged`); "{office}'s reply to your records request is due {date}" (`screen.home.group.requestdue`). Whose move: "{who}'s move" (`screen.home.move.member`), "an administrator's move" (`screen.home.move.admin`), "any member can take the next step" (`screen.home.move.anyone`).
- C5. Section "Each area at a glance" (`screen.home.areas`), help `screen.home.areas.holds` (a reading at zero is never shown; an area with nothing to show is left out). Four blocks, each name a link: "Investigation" (`screen.home.area.investigation`), "Action" (`screen.home.area.action`), "Members" (`screen.home.area.members`), "Administration" (`screen.home.area.administration`). Each block says "{n} to do" (`screen.home.area.need.many`; "1 to do", `.need.one`) or "nothing needs you here" (`screen.home.area.nothing`).
- C6. Readings and lines in the blocks: documents, questions, people followed (`screen.home.rd.*`); "{count} questions meet the bar" (`screen.home.area.meetbar`); the edition lines (`screen.home.area.edition.*`); "{count} things came in since you last looked: {latest}" (`screen.home.area.camein`); "Our move: {n}, the earliest due {date}" (`screen.home.area.ourmove`); "Their move: {n}, the earliest due {date}" (`screen.home.area.theirmove`); "Expertise on hand: {people}" (`screen.home.area.expertise`); "{name}'s invitation link is out, unused" (`screen.home.area.invitation`); to an administrator, "Places: {places}" (`screen.home.line.places`), "languages: {languages}" (`screen.home.line.languages`), and "This month on the team's key: {used} of the {limit} limit" (`screen.home.line.ailimit`) or "This month on the team's key: {used}, estimated" (`screen.home.line.aiused`).
- C7. Section "Projects" (`screen.home.projects`): a table with columns Project, Stage, Members, Activity, 8 weeks, Last change. Stage words "Forming", "Investigating", "Matured", "Closed" (`screen.home.stage.*`); "Owner: {handle}" (`screen.home.owner`); "Last change {date}" (`screen.home.lastchange`) or "No change in the last eight weeks" (`.lastchange.none`). Over the limit: "Your team has more projects than are shown here." (`screen.home.truncated`).
- C8. Section "Since you last looked" (`screen.home.since`), help `screen.home.since.holds`. Rows "{name} captured {document}" (`screen.home.since.captured`), "{name} added {count} events to {timeline}" (`.since.events`), "{name} started the money trail “{trail}”" (`.since.trail`).
- C9. Heading "What happened?" (`door.front.head`) and six door buttons, each a name and a hint: "A problem I live with" / "Potholes, dumping, a bill, a service" (`door.front.problem.*`); "A person" / "An official, a name in the news" (`door.front.person.*`); "A payment or contract" / "A budget line, a lease, a change order" (`door.front.money.*`); "Something I read" / "A code, a court case, a story, minutes" (`door.front.read.*`); "A tip or documents" / "Something someone handed you" (`door.front.tip.*`); "Help for my own situation" / `door.front.elsewhere.hint` (a matter that is yours alone).
- C10. Button "Start a project" (`act.promote.label.home`), help `act.promote.here.home`.

**States**

| State | When | What shows (exact) |
|---|---|---|
| S1. Busy team | A member who may start projects, in a team with work | C1 to C10. |
| S2. New member's first visit, may start projects | First visit after joining | C1, the strip, a section headed "Welcome, {name}" (`home.welcome.title`) with `screen.home.welcome.what` and button "Continue the guided welcome" (`screen.home.welcome.continue`) and link "Not now" (no word row for Home); then C4, C5, C7, C9, C10. No "Needs you", no "Since you last looked". |
| S3. New member's first visit, may not start projects | As S2, member without the right to start projects | C1, the welcome section of S2; section "Getting into a project" (`screen.home.join.heading`), help `screen.home.join.says`, text "Your team's work happens in projects, and you're not in one yet. Join one you were invited to, or ask to join one the team can find." (`screen.home.join.lead`); rows of invited projects (button "Join") and findable ones (button "Ask to join", or "Withdraw your request" when asked); note "Starting a project of your own is for members your team's administrators allow. Administrators: {admins}. Ask if you have a problem to bring." (`screen.home.join.nocreate`); the door "Help for my own situation" alone. No "What happened?", no "Start a project". |
| S4. May not start projects, no project open | Nothing to join or ask for | Heading as C1; section "Getting into a project" with "No project is open to you yet. A project's owners can invite you, and your team's administrators can let you start your own. Administrators: {admins}." (`screen.home.join.none`); the door "Help for my own situation". |
| S5. Founder of a new team | A team with no members or projects yet | Heading "Your team" while unnamed; section "Your team's Civicsmith is ready" (`home.ready.title`, also `screen.home.ready`) with `screen.home.nothingyet`; numbered steps: button "Name your team" (`home.first.name`); button "Invite your first members" (`screen.home.invite`) with "Make an invitation link for each person and send it yourself: Civicsmith sends no email." (`screen.home.first.invite`); button "Say who your team is" (`screen.home.saywho`) with `screen.home.first.identity`; "Open your first project: choose below what happened." (`screen.home.first.project`); then C9 and C10. Nothing else. |
| S6. A read failed | One block's read fails | That block is drawn as failed, never left out as if empty (see `every-screen`). |
| S7. Assistant unreachable | No AI account | As S1. Home offers no assistant act; nothing changes. |

**Actions**

| Control | When | Leads to |
|---|---|---|
| A1. A strip chip | always, when items are due | `queue` at that item, or the `action` or `request` it names |
| A2. Button "Vouch for them" (`screen.queue.vouch.them`) on a vouch row (`release`) | own photos held | the captures are vouched for; the row leaves |
| A3. Buttons "Adopt the newer version" (`act.adoptversion.label.home`), "Keep the version you cited" (`act.keepversion.label.home`) | a newer version of a cited document | asks for a reason, "Why adopt the newer version" (`screen.home.why`); the row leaves |
| A4. Button "Read and approve it" (`screen.home.todo.approve.button`) (`filingapprove`) | a letter waits for a second approval | the letter's full approval dialog (`every-screen`) |
| A5. Button "Open the check" (`screen.queue.check.open`) (`taskresolve`) | a check asked of you | the screen the check concerns |
| A6. Buttons "Grant" (`screen.home.request.grant`), "Decline" (`screen.home.request.decline`) (`projectrequestanswer`) | a request to join a project you own | the row leaves; the asker is told |
| A7. Button "Join" (`act.projectjoin.label.home`) | an invitation | you join; the project opens in Projects |
| A8. Button "Ask to join" (`act.projectrequest.label.home`); "Withdraw your request" (`act.projectrequestwithdraw.label.home`) | S3: a findable project | the row reads "You asked to join on {date}. Its owners decide." (`projects.request.asked`); withdrawing restores "Ask to join" |
| A9. Link "See what changes" (`queue.update.see`) | administrator, update ready | `updates` |
| A10. Area names "Investigation", "Action", "Members", "Administration" | always | `dash-project`, `dash-action`, `members`, `settings` |
| A11. A project's name in C7 | always | `project` |
| A12. Door buttons in C9 (`startfrom`, "Start from…", `act.startfrom.label.home`) | S1, S2, S5 | the door's offer opens in place: the wizards it suggests, "Already in your team: {items}" (`door.front.matching`) and "None of these: start a project from a blank page." (`door.front.blank`) |
| A13. Door "Help for my own situation" | always | `elsewhere` |
| A14. Button "Start a project" (`promote`) | may start projects | the field "The project's title" (`screen.home.title`), help `screen.home.title.help`; then `project` |
| A15. "Continue the guided welcome" | S2, S3 | the wizard "Welcome a new member" continues at its next step |
| A16. Buttons "Pass it to another member" (`act.taskforward.label.home`), "Endorse an administrator", "Add an owner", "Confirm expertise" | a routed to-do of that kind | the row leaves once answered |
| A17. "Say who issued it, or that you could not tell" (`act.owed_taskdecide.label.home`) | a document's issuer is not known | `not built`: the form opens in place (as `queue` A12) |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. "The project's title" | empty | "Give the project a title first." (`screen.home.title.needed`) |
| V2. "What happened, in your own words" (`screen.home.words`) | empty | "Write what happened first." (`screen.home.wordsfirst`) |
| V3. Any required field | empty | "Fill this in first." (`screen.home.fieldfirst`) |

---

## projects: "Projects"

**Address.** `/app/projects`. **Frame.** Working; rail place Projects.
**Who can see it.** Every signed-in member; each sees only the projects they may see.
**Purpose.** Every project you can see: its stage, who works on it, how busy it is, and when it last changed (`screen.projects.purpose`).
**Entry points.** Rail "Projects"; `theme` breadcrumb "Projects".

**Content (S1)**
- C1. Heading "Projects" (`screen.projects.name`); beneath: "Each project is one problem the team wants to get to the bottom of. These are the ones you can see." (`screen.projects.sub`).
- C2. Field "Search projects by name" (`screen.projects.search.label`), help `screen.projects.search.help`; choice "Show only" (`screen.projects.filter.label`): "All you can see", "Ones you are in", "Ones you own" (`screen.projects.filter.all/in/own`), help `screen.projects.filter.help`; button "Search projects" (`screen.projects.search.go`).
- C3. The projects table, as on `home` C7; "Questions: not shown to you" (`screen.projects.questions.unknown`) where the member may not see them.
- C4. Section "Invited" (`projects.invited.head`), help `projects.invited.says`: each project with "hidden: only the members invited know it exists" (`screen.projects.invited.hidden`) and button "Join".
- C5. Section "Findable" (`projects.findable.head`), help `projects.findable.says`: each with "Findable: only its name shows until its owners let you in." (`projects.findable.meta`) and button "Ask to join", or "You asked to join on {date}. Its owners decide." (`projects.request.asked`) and button "Withdraw your request".
- C6. Note `screen.projects.columns.note` (what Stage, Members and Activity mean).
- C7. Section "Themes" (`theme.section`), help `theme.across` then `theme.never.evidence`; each theme's name; link "Every theme" (`theme.every`).
- C8. Fold "Start a project": field "What it is about" (`project.start.title`), help `project.start.title.help`; radio "Who can find it" (`project.visibility.title`): "Hidden: only the members you invite know it exists" (`project.visibility.start.hidden`), "Findable: every member of the team sees it in Projects and can ask to join" (`project.visibility.start.discoverable`); "Choose one: neither is chosen for you. You can change it later, with a reason." (`project.visibility.start.later`); button "Start the project" (`project.start.go`).
- C9. Link "Imported cases" (`screen.imported.list`).

**States**

| State | When | What shows (exact) |
|---|---|---|
| S1. In use | the team has projects | C1 to C9. |
| S2. A new team with no projects | no project exists | Heading "Projects" with `projects.empty.sub` ("No projects yet. A project is one problem the team wants to get to the bottom of, …"); note `projects.empty.note`; C8. No table. |
| S3. Member who may not start projects | lacks the right | C1 to C7 and C9; note "Starting a project is for members your team's administrators allow. Administrators: {admins}. Ask if you have a problem to bring." (`screen.projects.nocreate`). No C8. |
| S4. Assistant unreachable | no AI account | As S1; the screen offers no assistant act. |

**Actions**

| Control | When | Leads to |
|---|---|---|
| A1. Button "Search projects" | always | the table narrows to names holding the words; nothing in any project changes |
| A2. A project's name | always | `project` |
| A3. Button "Join" (`act.projectjoin.label.projects`) | invited | you join; the project moves into the table |
| A4. "Ask to join" / "Withdraw your request" | findable | the row changes as in C5 |
| A5. A theme's name; link "Every theme" (`themeread`, "Read the themes") | always | `theme` (one theme; or every theme) |
| A6. Button "Start the project" (`promote`) | may start projects | `project`, the new project, you its owner |
| A7. Link "Imported cases" | always | `imported` |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. "What it is about" | empty | "Give the project a title first." (`screen.projects.title.needed`) |
| V2. "Who can find it" | neither chosen | the shell's refusal for a missing choice (`every-screen`); nothing is started |

---

## theme: "Themes"

**Address.** `/app/theme` (every theme); `/app/theme/<theme>` (one theme). **Frame.** Working; rail place Projects; breadcrumb "Projects › Themes".
**Who can see it.** Every signed-in member. A theme lists only documents the member may open.
**Purpose.** The team's themes: lenses that gather documents and passages, never evidence (`screen.theme.purpose`).
**Entry points.** `projects` section "Themes"; a theme's name on `document`; `finder` choice "Theme".

**Content, every theme (S1)**
- C1. Heading "Themes" (`screen.theme.name`); beneath: "A theme gathers documents and passages so members can see them together. It is never evidence: a finding cites the document or passage itself." (`theme.never.evidence`).
- C2. Section "Every theme, newest first" (`theme.list.heading`): field "Words in a theme's name or test" (`theme.q.label`); each theme's name (a link), "Belongs when: {test}", and "{n} placed · {n} hunches · declared by {who}, {date}" ("declared by {who}, {date}", `screen.theme.declaredby`).
- C3. Fold "Declare a theme" (`theme.declare`): field "Its name" (`theme.name.label`), field "Belongs when" (`theme.test.label`), button "Declare the theme" (`theme.declare.go`).

**Content, one theme (S2)**
- C4. Heading: the theme's name; beneath: "Belongs when: {test}" and who declared it, when. Note `theme.never.evidence`.
- C5. Section "Placed in it" (`theme.placed`), help `screen.theme.tip.placed`: each document (a link) with who placed it, when, and their note; a confirmed hunch reads "Placed by {who}, {date}; confirmed a hunch the assistant proposed: “{note}”" (`screen.theme.placed.confirmed`). Button "Take it out…" (`theme.takeout`) on each.
- C6. Section "Hunches: not yet placed" (`theme.hunches`): note "A hunch is not membership. It counts for nothing until a member places it." (`theme.hunch.note`); each with buttons "It belongs" (`theme.confirm`) and "Reject…" (`theme.reject`).
- C7. Section "Taken out" (`theme.out`), help `screen.theme.tip.removed`: each with who, when and the reason.

**States**

| State | When | What shows (exact) |
|---|---|---|
| S1. Every theme | `/app/theme` | C1 to C3. |
| S2. One theme | `/app/theme/<theme>` | C4 to C7. |
| S3. Assistant unreachable | no AI account | As S1 or S2. Hunches the assistant proposed before stay listed; no new ones arrive. No control for the assistant. |

**Actions**

| Control | When | Leads to |
|---|---|---|
| A1. Field "Words in a theme's name or test" (`themeread`) | S1 | the list narrows |
| A2. A theme's name | S1 | S2 for that theme |
| A3. Button "Declare the theme" (`themedeclare`, "Declare a theme") | S1 | the theme heads the list |
| A4. Button "It belongs" (`themeplace`, "Place it in the theme") | S2, a hunch | the hunch moves to "Placed in it" |
| A5. "Take it out…", "Reject…" (`themewithdraw`, "Take out or reject, with a reason") | S2 | asks for a reason; the item moves to "Taken out" with it |
| A6. A document's name | S2 | `document` |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. "Its name", "Belongs when" | empty | the shell's refusal for a missing field (`every-screen`); nothing is declared |
| V2. The reason for A5 | empty | the shell asks for the reason before the act (`every-screen`) |

---

## dash-action: "Action"

**Address.** `/app/dash-action`. **Frame.** Working; rail place Queue; breadcrumb "Action".
**Who can see it.** Every signed-in member.
**Purpose.** The Action area as a dashboard: clocks and whose move it is first, then what needs you, then every action (`screen.dash-action.purpose`).
**Entry points.** `home` area name "Action".

**Content**
- C1. The strip, as on `home`.
- C2. Heading "Action"; beneath: "Every clock that is running, whose move it is, replies that came in, and what waits for a second approval." (`screen.dash-action.sub`).
- C3. Four tiles: "Clocks running" (`screen.dash-action.tile.clocks`) with "{n} due this week" (`.tile.dueweek`); "Our move" (`.tile.ours`) with "due {day}" (`.tile.dueday`); "Their move" (`.tile.theirs`) with "{n} with no reply recorded" (`.tile.noreply`); "Replies to read" (`.tile.replies`) with "came in {date}" (`.tile.came`).
- C4. Section "Needs you" (`screen.home.needsyou`), help "What is yours in Action: each item with whose move it is and its act." (`screen.dash-action.tip.yours`).
- C5. Section "Every action" (`screen.dash-action.every.heading`), help `screen.dash-action.tip.every` (the clock as a sentence, never a countdown). Table columns "Action", "To", "Whose move", "The clock", "Next" (`screen.dash-action.col.*`). Clock sentences: "The {office} must answer by {date}: {days} days under the {law}, rolled past a holiday." (`.clock.due`); "Sent {date}; the team gave until {due}." (`.clock.sent`); "Approve by {day}, the plan's checkpoint." (`.clock.approve`). Next: "Record what came back" (`.next.record`), "Escalate, as the plan sets" (`.next.escalate`), "the plan's next step is ready" (`.nextready`).
- C6. Button "Start an action" (`act.actioncreate.label.dash-action`).

**States.** One state: the dashboard draws what the team has; a tile or section with nothing to show is left out (a reading at zero is never shown). Assistant unreachable: no change; it offers no assistant act.

**Actions**

| Control | When | Leads to |
|---|---|---|
| A1. Button "Read and approve it" (`filingapprove`) | a letter waits for a second approval | the letter's full approval dialog |
| A2. Button "Remind me again on…" (`screen.queue.remind.button`) (`reminderanswer`) | no reply recorded | asks "Remind me again on (optional)" (`screen.queue.reminder.on`); the item returns that day |
| A3. An action's name in C5 | always | `action` |
| A4. Button "Start an action" (`actioncreate`) | always | `actionnew` |

---

## dash-project: the project's title

**Address.** `/app/dash-project/<project>`. **Frame.** Working; rail place Projects; breadcrumb "Projects › {project}".
**Who can see it.** Members of the project; anyone else: `unavailable`.
**Purpose.** One project as a dashboard: your next steps here, the project at a glance, its story so far, and its activity (`screen.dash-project.purpose`).
**Entry points.** `home` area name "Investigation".

**Content**
- C1. The strip; heading: the project's title, beneath it what it is about, its owner and its stage.
- C2. Section "Next for you here" (`screen.dash-project.next.heading`), help `screen.dash-project.tip.next`: numbered steps, each with its act: "Vouch for the {count} copies you captured at {place}" (`.next.vouch`; also `.next.vouch.one`, `.next.vouch.noplace`, `.next.vouch.noplace.one`); "Decide on the newer version of {document}" (`.next.newer`); "Then Edition {edition} can be prepared: the {count} findings meet the bar" (`.next.prepare`) with link "Prepare Edition {n}" (`.next.prepare.label`).
- C3. Section "This project at a glance" (`.glance.heading`): tiles "Documents", "Questions", "Events" (with "{n} undetermined in order", `.tile.events.undetermined`), "Members" (`.tile.*`).
- C4. Section "The story so far" (`.story.heading`), help `.tip.story`: a timeline in brief, what they did above the line and what we did below; "Undetermined order: {events}, each dated only {precision}." (`.story.undetermined`, with "to the day", "to the minute", "to the second", "to the month or year, or approximately", `.precision.*`); link "Open the timeline" (no word row).
- C5. Section "Activity" (`.activity.heading`): who works on it, the eight-week bars, and lines such as "{name} added {count} events on {day}" (`.activity.events`).

**States.** One state; a step or tile with nothing to show is left out. Assistant unreachable: no change.

**Actions**

| Control | When | Leads to |
|---|---|---|
| A1. Button "Vouch for them" (`release`, "Vouch for photos") | own captures held | vouched for; the step leaves |
| A2. Buttons "Adopt it" (no word row), "Keep the version you cited" (`act.keepversion.label.dash-project`) | a newer version | asks a reason; the step leaves |
| A3. Link "Prepare Edition {n}" | findings meet the bar | `ceremony` |
| A4. Link "Open the timeline" | always | `timeline` |

---

## elsewhere: "Where else to go"

**Address.** `/app/elsewhere`. **Frame.** Working; rail place Home; breadcrumb "Home › Where else to go".
**Who can see it.** Every signed-in member.
**Purpose.** What you see when what you need is not Civicsmith's work: the places your team's place lists for it, with how to reach them and where that came from (`screen.elsewhere.purpose`).
**Entry points.** `home` door "Help for my own situation"; the guide of a wizard a door offers; `places` link "See the list".

**Content (S1)**
- C1. Heading "Where else to go" (`elsewhere.title`); beneath: `elsewhere.says` (Civicsmith gives legal information, never legal advice; the places below can act for you).
- C2. Note "Opening this page records nothing, and nobody in your team is told." (`elsewhere.records_nothing`).
- C3. One section per kind the place lists, each with its help: "Legal help you can afford" (`elsewhere.kind.legalaid`), "The courts' own self-help" (`.selfhelp`), "The city's service line" (`.service`), "A state agency for your kind of problem" (`.agency`), "Your elected representative's office" (`.representative`), "A newsroom that takes tips" (`.tipline`); each help is `elsewhere.kind.<kind>_says`.
- C4. Each place: its name, what it does, how to reach it, labelled "phone", "web", "email", "address", "mail", "hours" (`elsewhere.reach.*`); hours as "{days}, {open} to {close}" (`elsewhere.hours.span`); "Languages: {list}" (`elsewhere.languages`); and "From {source}, read {date}" (`elsewhere.source`).
- C5. Link "Back to Home" (`elsewhere.back`).

**States**

| State | When | What shows (exact) |
|---|---|---|
| S1. The place lists places | the team's place has rules listing them | C1 to C5. |
| S2. The place lists none | the place's rules list nothing | C1, C2; section "Nothing listed yet" (`elsewhere.none.head`) with `elsewhere.none.says` (names the place; administrators can ask in Settings › Places and offices); note "If you are in danger now, call your local emergency number." (`elsewhere.danger`); C5. |
| S3. No place chosen | the team follows no place's rules | C1, C2; "Your team follows no place's rules, so Civicsmith has no list to show. An administrator can choose a place in Settings › Places and offices." (`elsewhere.none.noplace`); `elsewhere.danger`; C5. |
| S4. Assistant unreachable | no AI account | Unchanged. |

**Actions**

| Control | When | Leads to |
|---|---|---|
| A1. A place's web address | listed | opens outside, in a new window |
| A2. Link "Back to Home" | always | `home` |

---

## queue: "Your queue"

**Address.** `/app/queue`. **Frame.** Working; rail place Queue.
**Who can see it.** Every signed-in member; each sees only their own queue.
**Purpose.** Your queue: everything waiting on you, in one list. To do needs your act, Noticed is something new nobody has judged, and Status tells you where something stands (`screen.queue.purpose`).
**Entry points.** Rail "Queue"; a strip chip; `home` rows.

**Content (S1, in use)**
- C1. Heading "Your queue" (`screen.queue.name`); beneath: "{n} items" (`screen.queue.count.many`; "1 item", `.count.one`) · "grouped by case" (`screen.queue.grouped`) · link "sort by time due" (`screen.queue.sort.bydue`). Sorting: "Sort by" (`screen.queue.sort`) "time added", "time due", "case", "kind" (`.sort.*`); "Sorted by {sort}" (`screen.queue.sorted`).
- C2. After an act: "Done: {what}. It has left your queue." (`queue.done`).
- C3. Row "Choose several items to answer at once, or look back at what you answered." (`queue.multi.entry`) with links "Choose several items" (`queue.multi.choose`) and "What you answered" (`queue.answered.title`).
- C4. Note "Three kinds: To do needs your act; Noticed is something the record found that nobody has judged; Status tells you where something stands." (`screen.queue.note`) "(Shown once.)" (`screen.queue.note.once`).
- C5. One section per case, headed by the case's name; items in no case under "Not in a case" (`screen.queue.nocase`). Each item carries its kind (To do, Noticed, Status) and, when due, "Due today" (`screen.queue.due.today`) or "Due {date}" (`screen.queue.due.on`). An item needing a reason carries "Needs a reason from you" (`screen.queue.item.weight`).
- C6. Item kinds drawn (each with its act, A-table): a newer version of a cited document; "Your team's declared way of reading evidence (its lens) changed after {work} was made" (`screen.queue.your_teams_lens_changed_after`); "Who issued a document your team captured is not known yet." (`screen.queue.routed.auth.item`); "{who} is proposed as an owner of {project}." (`screen.queue.routed.owner.item`); a vouch; "Our own date passed {date}" (`due.ours.passed`) with `due.ours.passed_says`; two documents in tension; a reply due; "You left a request unsent: {what}" (`queue.request-unsent.summary`); a letter to approve; a check asked of you; a hint ("A council member disclosed income from a firm whose contract they voted on", `screen.queue.hint.disclosed`, machine work); "Your standing question found {count} new documents: {what}" (`screen.queue.standing.found`).
- C7. A hint's fold "How was this found?" (`screen.queue.hint.how`): "What was matched" (`.hint.matched`), "How it was found" (`.hint.method`), "How far to trust it" (`.hint.trust`) with `screen.queue.hint.rate` (or `.hint.rate.none`) and "It is shown only because that rate is under {threshold}%." (`.hint.shown`); "What it is not" (`.hint.not`): "A lead, never a finding. Nothing here is evidence until a member opens a question and cites the documents themselves." (`.hint.not.text`).
- C8. Section "Your team's Civicsmith" (`queue.update.section`), help `queue.update.section_says`: "An update is ready: release {version}, {date}" (`queue.update.ready`), with link "See what changes" and button "Not now".
- C9. Sections for the members' to-dos (endorse an administrator, confirm expertise) and for the assistant's accounts (a limit reached, "told once to the project's owners" `screen.queue.ai.toldowners`, "nobody is named" `screen.queue.ai.nobodynamed`).
- C10. Section "Muted" (`queue.muted.title`), help `queue.muted.help`: "{kind}, in {project}" (`queue.muted.kind`) or "This item only: {item}" (`queue.muted.item`), "muted by you, {date}" (`queue.muted.by`; undated: `queue.muted.by.undated`), button "Turn back on" (`queue.muted.unmute`).
- C11. A long queue: "{n} more items are not shown here; act on these first." (`screen.queue.more`; "One more item…", `.more.one`). Captures waiting: "Captures waiting for a vouch: {n}. They are not counted in your queue." (`screen.queue.vouchband.apart`).

**States**

| State | When | What shows (exact) |
|---|---|---|
| S1. In use | items wait | C1 to C11. |
| S2. Nothing waiting | the queue is empty | Heading "Your queue", beneath "Nothing is waiting on you." (`screen.queue.empty`); three rows "To do: none here." (`queue.none.todo`) "Nothing asks for your act." (`queue.none.todo2`); "Noticed: none here." (`queue.none.noticed`) "The record found nothing new that you follow." (`queue.none.noticed2`); "Status: none here." (`queue.none.status`) "Nothing you follow has changed." (`queue.none.status2`); then `screen.queue.uptodate` ("You are up to date. …"); link "Go to Home" (`screen.queue.gohome`); link "What you answered". |
| S3. An invitation to a project, waiting | a request to join, an invitation, a new signing key | "1 item · grouped by case"; the request row with `queue.project-request.detail` and buttons "Grant", "Decline"; the invitation row with `queue.project-invitation.detail` and button "Join"; section "Your team" with the signing-key row (`queue.signer-self-registered.detail`) and button "I know about this key" (`queue.signer-self-registered.known`). |
| S4. Choosing several items | after "Choose several items" | Heading "Your queue"; beneath "Choose several items, then act on all of them at once." (`queue.multi.head`) "Each item says what happened to it." (`queue.multi.head2`); a checkbox on each item; a bar "{n} items chosen" (`queue.multi.chosen`; `.chosen.one`) with buttons "Mark them done" (`queue.multi.done`), "Forward them to a member" (`queue.multi.forward`), "Snooze them to a date" (`queue.multi.snooze`), "Dismiss them with a reason" (`queue.multi.dismiss`). |
| S5. What happened to the chosen items | after acting in S4 | Heading "Your queue"; "You acted on {n} items. Done and out of your queue: {done}. Not handled, still here: {kept}." (`queue.multi.result`; `.result.one`); each item "Done" with "It has left your queue." or "Not handled, stays here" (`queue.multi.refused`) with its reason ("Approving a letter needs you to read it first." `queue.multi.why.letter`; "A check needs your answer on the check itself." `queue.multi.why.check`) and its own button; links "Back to your queue" (`queue.multi.back`), "What you answered". |
| S6. What you answered and set aside | after "What you answered" | Heading "What you answered" (`queue.answered.title`), beneath `queue.answered.head`; section "Snoozed" (`screen.queue.snoozed.head`), help `screen.queue.snoozed.holds`, rows "comes back {date}" (`screen.queue.snoozed.until`) with button "Bring back" (`screen.queue.bringback`); section "Answered" (`queue.answered.heading`), help `queue.answered.help`, rows such as "Forwarded {item} to {member}" (`queue.answered.forwarded`), "Snoozed {item} until {date}" (`queue.answered.snoozed`), "Marked done: {item}" (`queue.answered.done`), each with "Answered by you, {when}" (`queue.answered.byyou`) or "Answered by {member}, {when}"; section "Set aside" (`held.setaside.head`), help `queue.aside.help` and `queue.aside.help2`, rows "Dismissed by you, {date}" (`queue.aside.dismissed`) or "Deferred by you until {date}" (`queue.aside.deferred`), "judged against the progression as it stood in version {n}" (`queue.aside.v2`), deferred rows with buttons "Bring back" and "Dismiss with a reason"; link "Back to your queue". |
| S7. An all-clear that cannot be given | a feed did not answer and nothing else waits | Heading "Your queue", beneath "Not everything answered, so this cannot say nothing is waiting on you." (`queue.allclear.withheld`); row "Notices about the documents your team watches did not answer." (`queue.allclear.failed`) "What did answer shows nothing waiting; what did not may hold something." (`queue.allclear.failed2`), or "“{feed}” did not answer." (`queue.allclear.failed.feed`); link "Try again" (`queue.tryagain`). Never "Nothing is waiting on you." |
| S8. Assistant unreachable | no AI account | As S1. A standing question's row reads its count of new matches with no "Read by the assistant" (`screen.queue.standing.read`) mark. Items from the assistant (hints, "Explore today") appear only if made before; none arrive. |

**Actions**

| Control | When | Leads to |
|---|---|---|
| A1. "Adopt the newer version", "Keep the version you cited" | newer version | reason "Why adopt the newer version" (`screen.queue.why`); the item leaves |
| A2. Link "Settle it" (no word row for this link; `act.biasdebtresolve.label.bias` reads "Settle it, with your reason") | lens changed | `bias` |
| A3. Button "Vouch for them" (`release`, "Vouch for a capture") | a vouch | vouched; the item leaves |
| A4. Link "Open both" (no word row) | two documents in tension | `contradiction` |
| A5. Button "Remind me again on…" (`reminderanswer`) | a reply due | field "Remind me again on (optional)" (`screen.queue.reminder.on`); the item returns that day |
| A6. Link "Pick up where you left off" (`screen.queue.unsent.pickup`); button "Keep it for later" (`screen.queue.unsent.keep`); button "Drop the request, with a reason" (`screen.queue.unsent.drop`, `actionmove`) | an unsent request | `request` at the step left; or snoozed; or dropped with the reason (help `act.actionmove.here.queue`) |
| A7. Button "Read and approve it" (`filingapprove`, "Approve a letter") | a letter | its approval dialog |
| A8. Button "Open the check" (`taskresolve`), help `queue.act.dothis.help`; button "Pass it to another member" (`taskforward`) | a check | the screen it concerns; or field "Forward to (the member's handle)" (`screen.queue.forward.to`) |
| A9. Hint buttons "Open a question from this" (`screen.queue.hint.promote`, `promote`), "Defer" (`screen.queue.defer`), "Dismiss with a reason" (`proposedispose`), "Stop this kind of hint for the project" (`screen.queue.hint.stop`, `queuemute`) | a hint | a new question with field "The question, in your words" (`screen.queue.question`); or set aside (S6); or muted (C10) |
| A10. Buttons "Snooze to a date" (`queuesnooze`), "Mute this kind" (`screen.queue.mute.kind`, `queuemute`) | a status item | field "Until which day" (`screen.queue.snooze.until`), help `screen.queue.snooze.pick`; the item and its case's others hide until that day; or muted |
| A11. Link "See what changes"; button "Not now" (`act.owed_updatelater.label.queue`) | administrator, update | `updates`; or the item returns later |
| A12. Button "Say who issued it" (`screen.queue.routed.auth.open`) | issuer unknown | `not built` (`taskdecide`): a form "Who issued this document?" (`screen.queue.routed.auth.question`) with "I know who issued it" (`.auth.know`) or "I could not tell" (`.auth.cannot`), fields "The issuing party" (`.auth.issuer.label`), "How do you know?" (`.auth.how.label`), "What you tried" (`.auth.tried.label`), note "Not knowing is a fine answer." (`.auth.fine1`) and `.auth.fine2`, button "Record my answer" (`.auth.record`) |
| A13. Buttons "Grant", "Decline" (`projectrequestanswer`); "Join" (`projectjoin`) | S3 | the item leaves; the asker is told |
| A14. Button "I know about this key" (`signerknown`) | S3 | the item leaves |
| A15. Buttons "Endorse an administrator", "Add an owner", "Confirm expertise", "Agree to remove an owner" (`act.projectownerremove.label.queue`) | routed to-dos | the item leaves when answered |
| A16. Button "Add an API key for the project" (`screen.queue.ai.addkey`, `projectkeyset`); "Explore today" (`screen.queue.explore.today`, `exploreapprove`) | items about the assistant's accounts | `AI`: field "The project's Anthropic API key" (`screen.queue.projectkey`); exploring that day |
| A17. Button "Turn back on" | C10 | the kind or item reaches the queue again |
| A18. Links "Choose several items", "What you answered", "Back to your queue" | S1, S4 to S6 | S4; S6; S1 |
| A19. Buttons "Mark them done" (help `queue.multi.done.help`, `.done.help2`), "Forward them to a member", "Snooze them to a date" (help `queue.multi.snooze.help`), "Dismiss them with a reason" | S4 | S5 |
| A20. Link "Try again" | S7 | the queue reads again |
| A21. Link "Go to Home" | S2 | `home` |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. Any required field | empty | "Fill this in first." (`screen.queue.fieldfirst`) |
| V2. Issuer form | no basis | "You gave no answer to “How do you know?” or “What you tried.” Write it, then record your answer again." (`screen.queue.routed.auth.refused.basis`) |
| V3. Issuer form | "I know" with no name | "You said you know who issued it but named no one." "Name the issuing party, or choose “I could not tell.”" (`.auth.refused.issuer1`, `.issuer2`) |
| V4. Issuer form | item moved to another member | "This item now belongs to someone else." "Ask them, or ask an administrator." (`.auth.refused.yours1`, `.yours2`) |
| V5. Issuer form | already answered | "Someone already answered this. It has left your queue." (`.auth.refused.done`) |

---

## finder: "Find"

**Address.** `/app/finder`. **Frame.** Working; rail place Find.
**Who can see it.** Every signed-in member; results hold only what the member may read.
**Purpose.** Search what the team holds, or browse it by kind and state with no words; hold a set together; see where nobody looked (registry; `screen.finder.purpose`).
**Entry points.** Rail "Find"; `find-in` "See all {count} in Find"; `capture` after a search.

**Content (S1, the search in use)**
- C1. Heading "Find" (`screen.finder.name`); beneath: "Search everything your team holds, then hold a set together to act on it." (`screen.finder.sub`).
- C2. Search field ("Your words", `screen.finder.words`; placeholder "Words to find", `find.query.placeholder`) and button "Search" (`act.search.label.finder`).
- C3. Results, each with a checkbox ("Pick {title}", `screen.finder.pick`), its kind, grade, who captured it and when; a passage shows the words around the match; a person or office shows "named in {n} documents, among them {document}" (`screen.finder.named`). Count "{n} results" (`screen.finder.total.many`; "1 result", `.total.one`); "Showing {shown} of {total} matching documents." (`screen.finder.shown`) and button "Show more results" (`screen.finder.showmore`).
- C4. "Nobody looked in {place} for this yet." (`screen.finder.nobody.in`) with buttons "See where nobody looked" (`act.frontier.label.finder`) and "Count" (`act.calculationcreate.label.finder`).
- C5. Where documents are unread: "{n} documents in what you searched are not read yet or can be searched only in part, so they may hold more than is found here." (`screen.finder.unread`; `.unread.one`).
- C6. A bar "{n} documents held together" (`screen.finder.held.many`; `.held.one`) "until {time}" (`screen.finder.until`) with buttons "Hold these together" (`act.select.label.finder`), "Find in these" (`act.findin.label.finder`), "Cite these together" (`act.cite.label.finder`; help `screen.finder.a17.cites_every_document_you_hold_together_i` and `…you_choose_the_question_and_how_they_bea`), "Let the set go" (`act.selectionrelease.label.finder`).

**States**

| State | When | What shows (exact) |
|---|---|---|
| S1. Search in use | words searched, matches found | C1 to C6. |
| S2. No results | nothing matches | C1, C2; "Nothing your team holds matches “{q}”." (`screen.finder.noresult`) with "Search finds only what has been captured. Try fewer or other words, or capture the record from where it is published." (`screen.finder.covers`); link "Capture it" (`screen.finder.captureit`). Fold "When some documents hold only some of the words" (`screen.finder.partial.head`): "No document holds all of the words “{q}” together." (`.noresult.partial`) "Documents holding at least one of the words: {n}." (`.widen`); "Passages holding at least one of the words: {n}." (`.widen.passages`). |
| S3. Browsing, no words | search empty | C1, C2 with "Leave it empty to browse everything." (`find.query.help`); choices "Show" (`find.kind.label`; "Everything", `find.kind.all`, and the kinds), "Only" (`find.state.label`): "Anything", "New since you last looked", "Flagged for a second look", "Watched by you" (`find.state.*`); "Show as" (`screen.finder.showas`): "A list", "One table"; "Theme" (`theme.filter`): "Any theme" (`theme.filter.any`) and each theme. "With no words, Find lists everything your team holds, newest first. …" (`find.browse.says`); "Updated just now. This list checks for changes by itself while it is on your screen." (`list.fresh`); rows with checkboxes, a watched row with "Take off my watch list" (`act.watchitem.off.label.finder`), a flagged row with "Clear" (`act.secondlookclear.label.finder`); "Your team holds more than is shown here." (`find.browse.more`) with "Show more" (`find.browse.showmore`); fold "Before your first visit to Home" (`find.browse.nosince.summary`); a bar "{n} item picked" with "Hold these together", "Watch" (`act.owed_watchitem.label.finder`), "Flag for a second look…" (`act.owed_secondlook.label.finder`), whose fold holds field "Why look again" (`find.secondlook.note`) and button "Flag for a second look". |
| S4. Citing the whole set | after "Cite these together" | Heading "Cite these together"; beneath "Cite every document you hold together in one question, in one step." (`screen.finder.a17.cite_every_document_you_hold_together_in`); the held documents; choice "Cite in which question" (`screen.document.cite.question`); radio "How they bear on the question" (`screen.finder.cite.legend`): "Support it", "Cut against it" (`.cite.support`, `.cite.against`); note from the three `screen.finder.a17.*` sentences (each cited whole; one already cited left as it was; a changed set is shown); button "Cite these together"; link "Back to Find" (`screen.finder.cite.back`). After citing, section "What you did": "Cited" (`screen.finder.cite.cited`) "newly cited, supporting the question" (`.a17.newly_cited_supporting_the_question`) or "newly cited, cutting against the question" (`.cite.newly_against`); "Left as it was" (`.a17.left_as_it_was`) "the question already cited it" (`.a17.the_question_already_cited_it`); a changed set: "The set changed after you held it, so these are the documents held now." (`.cite.set_changed`), "added to the set after you held it", "no longer in the set, so not cited" (`.cite.added_since`, `.cite.gone_since`). |
| S5. The whole record as one table | "Show as" "One table" | C1; "Show as" with help `screen.finder.table.view.help`; "The whole record, one row for each item. Choose a column heading to sort by it." (`screen.finder.table.intro`); "{n} items · {m} awaiting review" (`screen.finder.table.count.other`); `list.fresh`; a table Item, Kind, State, Updated, each state a chip; note "Sorting changes only your view of the table, never the record." (`screen.finder.table.sorting`). |
| S6. A search answered by three routes | a search, with its coverage | C1, C2; choice "Look in" (`screen.find-in.lookin`): "Everything your team holds" (`screen.finder.scope.everything`), "Cases" (`screen.finder.scope.cases`) and the other parts, help `screen.finder.scope.help`; sections "In titles, notes and details" (`screen.finder.route.fields`) with `.route.fields.holds.other`; "In what the documents say" (`.route.passages`) with `.route.passages.holds.other`; "Subjects named" (`screen.finder.subjects.heading`) with `.route.subjects.holds.other`; "These three are counted apart and never added: a document, a passage and a subject are different things." (`.route.apart`); fold "When a search crosses routes" (`.route.cross.heading`) with `.route.cross`; section "What this search covered" (`.covered.heading`) with `.covered.levels` and rows "Findings and connections" (`.covered.rests`), "Passages read from the documents" (`.covered.read`) with `.covered.read.says.other`, "Documents searched" (`.covered.docs`) with `.covered.docs.says.other`, "Where nobody has looked yet" (`.covered.looked`); button "See where nobody looked". |
| S7. Assistant unreachable | no AI account | As S1 to S6; Find offers no assistant act. |

**Actions**

| Control | When | Leads to |
|---|---|---|
| A1. Button "Search" | always | S1, S2 or S6 |
| A2. A result's title | always | `document`, `person`, `question` or the item's screen |
| A3. "Hold these together" (`select`) | items picked | the bar of C6 |
| A4. "Find in these" (`findin`) | a set held | `find-in`, scope "The documents you are holding together" |
| A5. "Cite these together" (`cite`) | a set held | S4 |
| A6. "Let the set go" (`selectionrelease`) | a set held | the bar goes |
| A7. "See where nobody looked" (`frontier`) | always | the places nobody looked are listed: "Nobody has looked yet at {n} places your team holds." (`screen.finder.nobody`; `.nobody.one`; `.nobody.none`) |
| A8. "Count" (`calculationcreate`) | results | fields "What you are counting", "From (a day)", "To (a day)" (`screen.finder.count.*`); "Counted: {result}. …" (`screen.finder.counted`) |
| A9. "Watch", "Take off my watch list" (`watchitem`) | S3 | the item shows or leaves "Watched by you" |
| A10. "Flag for a second look" (`secondlook`); "Clear" (`secondlookclear`) | S3 | the item shows or leaves "Flagged for a second look" |
| A11. Choice "Theme" (`themeread`, "Filter by theme") | S3 | what was placed in the theme, then its hunches apart |
| A12. Link "Capture it" | S2 | `capture` |
| A13. Link "Back to Find" (help `screen.finder.cite.back.help`) | S4 | S1, the set still held |
| A14. "Explore connections" (`explore`) | a result | `explore` |
| A15. "Follow this item into another dimension"; "Search the registers" | — | `not built` |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. Search (an act needing words) | empty | "Write what to search for first." (`screen.finder.wordsfirst`) |
| V2. Hold | nothing picked | "Pick at least one result first." (`screen.finder.pickfirst`) |
| V3. Find in these, Cite these together | no set held | "Hold a set together first." (`screen.finder.holdfirst`) |
| V4. "Why look again" | empty | the shell's refusal for a missing field; nothing is flagged |

---

## capture: "Add to the record"

**Address.** `/app/capture`. **Frame.** Working; rail place Add.
**Who can see it.** Every signed-in member who may add work.
**Purpose.** Add something to the record: a document from its address, a file, or what you saw yourself, in your own words (`screen.capture.purpose`).
**Entry points.** Rail "Add"; `finder` "Capture it"; a project or question's "Add"; a wizard step (the tab its act belongs to opens).

**Content (all tabs)**
- C1. Heading "Add to the record" (`screen.capture.title`); beneath: "A document from an address or a file, a photo, or what you saw yourself." (`screen.capture.sub`).
- C2. Opened from a question: "What you add here is filed under {project}, for the question {question}" (`screen.capture.forq`).
- C3. Note "A document added here can be filed into a project later." (`screen.capture.filing-later.a`) "Add opened from a project files it there directly." (`.filing-later.b`).
- C4. Tabs "What you are adding" (`screen.capture.tabs`): "From an address" (`.tab.address`), "A file or photo" (`.tab.file`), "What I saw or heard" (`.tab.saw`).

**Content, tab "From an address" (S1)**
- C5. Field "Address" (`screen.capture.address.label`), help `.address.help`; choice "For which question" (`capture.forquestion`), help `capture.forquestion.help`; fold "A question that isn't the project's" (`capture.forquestion.refused.summary`).
- C6. Radio: "The page as the site sent it" (`.render.keep.site`, chosen), "The page as a visitor saw it" (`.render.keep.visitor`); explanation `.render.keep.explain1`, `.explain2` (a rendered capture takes longer and uses a daily allowance). Fold "If the page can't be kept as a visitor saw it" (`.render.refused.summary`) listing the render refusals (V-table).
- C7. Fold "Keeping a copy from a public web archive" (`.archive.summary`): `.archive.explain1`, `.archive.explain2`.
- C8. Buttons "Capture" (no word row for this label; act `acquire`, "Capture from an address") and "Ask for this later" (`.address.later`).
- C9. Row "Public registers your team brings in and watches." (`screen.registers.way.add`) with link "See public registers" (`screen.registers.way.link`); row "Every address your team watches, and when it will next be checked." (`.watching.line`) with link "See watched addresses" (no word row).
- C10. Fold "Once it is captured: where it is filed, and watching the address" (`.address.watchhead`): "Captured: {title}" (`capture.captured`); "Filed under {project}, for the question “{question}”" (`capture.filed.question`) with link "Cite a passage" (`capture.cite`, help `capture.cite.tip`); choice "How often to look" (`capture.watch.freq`), help `capture.watch.freq_says`: "Every hour", "Every day", "Every week", "Every month", "Before each meeting" (`.address.freq.*`); buttons "Watch this address for changes" (`.address.watchbutton`), "Check it now" (`act.monitor.label.capture`). Fold "What checking it now tells you" (`.address.checked.summary`): `.address.checked.modified` (with button "Capture the new copy"), `.checked.removed`, `.checked.unchanged`, `.checked.unknown`.
- C11. An unfinished capture: "Unfinished: your capture of "{title}" waits for {n} of its attachments · started {ago}" (`capture.unfinished`), button "Finish it" (`capture.finish`), help `capture.finish.help`.
- C12. Fold "If the address is already held, or the page reads differently now" (`.a64.if_the_address_is_already_held_or_the_si`): "Already in the record as" {title}, "captured by {name}, {date}", "the site still gives the same document", "nothing was added" (`.a64.*`), link "Open it" (`.openit`); "The page reads differently now" (`.a64.the_site_has_changed_since`) with `.a64.your_team_holds_a_capture_from_14_septem`, `.a64.capturing_it_again_keeps_the_new_copy_be`, `.a64.whoever_cited_the_old_one_stays_on_it_un`; button "Capture the new copy" (`.a64.capture_the_new_copy`); link "Leave it" (`.leaveit`), help `.leaveit.help`.
- C13. Note `.address.note` (Civicsmith fetches it itself and keeps what the site sent; a public archive learns the address; a malware site is captured as high risk).
- C14. Fold "While it is being fetched" (`.address.working.head`): `.address.working` (up to 25 seconds; keep the page open).
- C15. Fold "If it can't be captured, you see one of these, beside the address" (`capture.ifnot`): the fetch refusals (V-table).
- C16. Section "Your requests for later" (`.later.head`): `.later.about`; each address with "Waiting to be fetched" (`.later.waiting`), "Captured" (`.later.captured`) or "Turned away" (`.later.turned`) and its tries; none: "You have not asked for any address to be captured later." (`.later.none`); button "Show my requests for later" (`act.capturerequests.label.capture`).
- C17. Section "Logins for sites" (`.logins.head`): `.logins.about1` to `.about3`; button "Show the stored logins"; each login "{kind} · {scope} · given by {member}, {date}" (`.logins.row`) with button "Withdraw this login"; fold "When none is stored" (`.logins.none.head`) with `.logins.none`; fold "Give a login for a site" (`.logins.give`): field "The site" (`.logins.site`, help `.logins.site.help`); choice "What the site asks for" (`.logins.kind`): "A username and password", "A browser name the site requires", "Something else"; choice "Who may use it" (`.logins.scope`, help `.logins.scope.help`): "Only me", "This project", "The whole team"; fields "Username for this site" (`.logins.name`), "Password or secret for this site" (`.logins.secret`, help `.cred.sealed1` `.cred.sealed2`); button "Store this login" (`.logins.store`).
- C18. Section "A source that asked for a login" (`.cred.head`): "Turned away: {source} asked for a login" (`.cred.turned`), "Asked for by {name}, {date} · Tries: {count}" (`.cred.askedby`); `.cred.why1`, `.cred.why2`; fields "Username for this source" (`.cred.user`), "Password or secret for this source" (`.cred.secret`); buttons "Give a login for this source and try again", "Try the request again" (`.cred.retry`); `.cred.only1`, `.cred.only2`; "A login is stored for {source}" (`.cred.stored`) "The secret is not shown." (`.cred.notshown`); button "Show the logins your team has stored" (`.cred.list`).

**Content, tab "A file or photo" (S2)**
- C19. Drop area "Take a photo, or choose a file" (`.file.choose`) · "on a phone, the camera opens" (`.file.choosehelp`); the chosen file with "taken {date}, {time}, by the phone that took it" (`.file.taken`) and "location in the photo: {place}" (`.file.location`).
- C20. Radio "How you got it" (`.file.how`): "I made it myself: a photo, a recording, my notes", "I was handed it: a printed agenda, a letter", "Someone sent it to me", "I downloaded it from a website" (`.file.how.*`); `.file.downloaded` with link "Capture it from its address" (`.file.toaddress`).
- C21. Field "Where and when" (`.file.where`), help `.file.wherehelp`; field "What it shows, in your own words" (`.file.what`); choice "For which project" (no word row on this screen).
- C22. Button "Capture this file" (no word row; act `captureupload`, "Capture a file or photo"); note `.file.note` and `.file.zip`.

**Content, tab "What I saw or heard" (S3)**
- C23. Note "Only what you saw or heard yourself. What someone told you belongs in a note or a hunch, not here." (`.saw.note`); row "Something you were only told, and want to look into?" (`.lead.line`) with link "Write down a lead" (`.lead.link`).
- C24. Field "In your own words" (`.saw.words`); fields "Where" (`.saw.where`), "When" (`.saw.when`, help `.saw.whenhelp`); drop area "Add a photo or recording you made then" (`.saw.photo`) · "optional; it is kept beside your account" (`.saw.photo.optional`).
- C25. Button "Record what you saw" (`.saw.record`); note `.saw.after` (testimony, always grade D, never discounted).

**States**

| State | When | What shows (exact) |
|---|---|---|
| S1. From an address | default; or a step whose act is `acquire`, `capturerequest` or `monitor` | C1 to C18. |
| S2. A file or photo | the tab; or a step whose act is `captureupload` | C1 to C4, C19 to C22. |
| S3. What I saw or heard | the tab; or a step whose act is `testify` | C1 to C4, C23 to C25. |
| S4. Opened for a question | from a question | C2 shows; "For which question" is set to it. |
| S5. Captured | after "Capture" | "Captured: {title}. It waits in Held captures until a member vouches for it." (`.address.done`); an archive: `.address.archive`, `.address.notpromoted`; a large file: `.fetch.pending`, `.fetch.why`, later `.fetch.done`; reading: `.reading.pending`; supporting files: `.supporting.kept` and its parts; `.attest.pending`. |
| S6. Already held | the address gives what is held | "Already in the record as {title}: your team holds exactly this document. Nothing new was saved." (`.address.existed`) with link "Open it" (`.address.existed.open`). |
| S7. Asked for later | after "Ask for this later" | "Asked for later: {address}. The request waits until it can be fetched." (`.address.requested`), or `.address.requested.waits` where unattended capture is not set up. |
| S8. Watching | after "Watch this address for changes" | "Watching {title} for changes, {frequency}. Each new version is kept beside the old." (`.address.watching`). |
| S9. File captured | after "Capture this file" | "Captured: {name}. It waits in Held captures until you or another member vouches for it." (`.file.done`); already held: `.file.existed`. |
| S10. Testimony recorded | after "Record what you saw" | "Recorded as your testimony: {id}. It waits in Held captures like any capture." (`.saw.done`). |
| S11. Assistant unreachable | no AI account | S3 shows no "Help me write this" button and no draft mark. Everything else as S1 to S10. |
| S12. Assistant reachable | an AI account (`AI`) | S3: button "Help me write this" (`act.writinghelp.label.capture`); its draft fills the field marked "Draft · the assistant's, asked by {handle}" (`.saw.draft`); `.help.only`. |

**Actions**

| Control | When | Leads to |
|---|---|---|
| A1. Tabs | always | S1, S2, S3 |
| A2. Button "Capture" (`acquire`) | S1 | S5, S6 or a refusal beside the address |
| A3. Button "Ask for this later" (`capturerequest`) | S1 | S7 |
| A4. Button "Watch this address for changes" (`monitorset`) | once captured | S8 |
| A5. Button "Check it now" (`monitor`) | once captured | one of the four lines of C10 |
| A6. Button "Capture the new copy" | the page reads differently | a new copy beside the old |
| A7. Link "Leave it" | C12 | nothing changes |
| A8. Links "Open it" | C12, C16, S6 | `document` |
| A9. Link "Cite a passage" | C10 | `find-in` over the document, the question chosen |
| A10. Button "Finish it" | C11 | the missing attachments are fetched |
| A11. Links "See public registers", "See watched addresses" | S1 | `registers` (`not built`), `watching` |
| A12. Button "Show my requests for later" (`capturerequests`) | S1 | C16 lists them |
| A13. Buttons "Store this login", "Give a login for this source and try again" (`capturecredentialsupply`); "Show the stored logins" (`capturecredentiallist`); "Withdraw this login" (`capturecredentialwithdraw`) | S1 | the login is stored, listed or withdrawn; the secret is never shown |
| A14. Button "Try the request again" (`capturerequestretry`) | a request its source turned away | it goes back in the queue to be tried |
| A15. Link "Capture it from its address" | S2 | S1 |
| A16. Button "Capture this file" (`captureupload`) | S2 | S9 |
| A17. Link "Write down a lead" | S3 | `leads` |
| A18. Button "Record what you saw" (`testify`) | S3 | S10 |
| A19. Button "Help me write this" (`writinghelp`) | S12 only | `AI`: the draft fills the field |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. "Address" | empty | "This can be captured only once “{field}” is filled in." (`capture.fieldneeded`) |
| V2. "Address" | not a fetchable address | "That isn't an address Civicsmith can fetch. Check it starts with https:// and has no spaces." (`refusal.BAD_LOCATOR`) |
| V3. "Address" | the site refused | `refusal.SOURCE_REFUSED` ("The site refused to give the page to your team's Civicsmith. …") |
| V4. "Address" | no answer in time | "The page couldn't be fetched: the site didn't answer in time. Nothing was kept; try again." (`refusal.FETCH_FAILED`) |
| V5. "Address" | over 25 seconds | `refusal.ACQUIRE_TIMED_OUT` |
| V6. "Address" | empty page | "The address answered with nothing to keep: an empty page." (`refusal.EMPTY`) |
| V7. "Address" | too large | `refusal.TOO_LARGE` |
| V8. "For which question" | not the project's | "Say which question this capture is for: choose one of the project's questions. Nothing was captured." (`refusal.BAD_FOR`) |
| V9. "The page as a visitor saw it" | no renderer; allowance used; at capacity; host resting; not a page; render failed | `refusal.RENDER_NO_RENDERER`; `refusal.RENDER_DEFERRED`; `refusal.RENDER_AT_CAPACITY`; `refusal.RENDER_HOST_COOLING_OFF`; `refusal.RENDER_NOT_A_PAGE`; `refusal.RENDER_FAILED`, each beside the address, each saying nothing was fetched or filed |
| V10. Watch | captured from a file | "This document has no address to watch: it came from a file, not from a page." (`refusal.NO_LOCATOR`) |
| V11. Watch before capture | not captured | "Watching asks for an address already captured: capture it first, then watch it." (`.address.watchafter`) |
| V12. File | none chosen | "Choose a file or take a photo first." (`.file.nofile`) |
| V13. File statement | fields missing | "Before it is sent, say: {fields}." (`.file.missing`); too long: `.file.toolong`; refused: `.refusal.UPLOAD_NO_STATEMENT` |
| V14. File | empty; too large; not signed in on own account | `.refusal.upload.EMPTY`; `.refusal.upload.TOO_LARGE`; `.refusal.MEMBER_SESSION_REQUIRED` |
| V15. Testimony | fields missing | "Before it is recorded, say: {fields}." (`.saw.missing`) |
| V16. "When" | later than now or unreadable | "Give the day and time you saw or heard it, no later than now." (`.saw.badwhen`) |
| V17. Help me write this (S12) | field empty | "Write something first: the assistant helps word only what you told it." (`.help.empty`) |
| V18. A login | given by the assistant; for the team's own Civicsmith; request not turned away | `.cred.ref.machine1` `.cred.ref.machine2`; `.cred.ref.own1` `.cred.ref.own2`; `.cred.ref.notretry` |

---

## held: "Held captures"

**Address.** `/app/held`. **Frame.** Working; rail place Add; breadcrumb "Add › Held captures".
**Who can see it.** Every signed-in member who may add work. A capture for a question the member may not see is shown withheld.
**Purpose.** Captures waiting for a member to vouch for them before they enter the record. Release them, or set them aside with a reason (`screen.held.purpose`).
**Entry points.** `home` row "Waiting for a member to look: … in Held captures"; the strip; a capture's confirmation ("It waits in Held captures").

**Content (S1)**
- C1. Heading "Held captures" (`screen.held.name`); beneath: "Captured but not yet vouched for. Nothing here is sent to you; it waits." (`screen.held.sub`).
- C2. Choice "Whose captures" (`screen.held.who`): "Mine", "Everyone's" (`.who.mine`, `.who.all`).
- C3. Rows, each with a checkbox: a photo's thumbnail (help `screen.held.tip.photo`; "Open the file", `.thumb`); its title or "Untitled capture" (`.untitled`); grade; age "{days} days old" / "1 day old" / "Captured today" (`.age*`); "Project: {project}" or "No project yet" (`.project`, `.noproject`); "From {address}" (`.from`); "For {asker}'s question: “{title}”" (`.for`).
- C4. A row for a question the member may not see: "Captured for a question you may not see." (`screen.held.withheld`).
- C5. An archive: "An archive: {parts}" (`.archive`) with "{count} files held beside it" and "{count} not filed" (`.archive.filed`, `.archive.notfiled`); link "Open its files" (`.archivefiles`).
- C6. A row not eligible for a batch: checkbox disabled; "Not included when you vouch for several at once: {reason}" (`.ineligible`) with "it is crucial to a finding." (`.ineligible.crucial`) or "a contradiction touching it is still open." (`.ineligible.contested`), then `.ineligible.alone`; link "Open it". Undetermined: `.eligibility.undetermined`.
- C7. Paging: "{count} shown here. More are on the next page." (`.more`); buttons "Next page" (`.next`), "Previous page" (`.back`).
- C8. When setting aside a capture a question waits for: "{asker}'s question is waiting for {capture}. Your reason is kept on the record and shown to {asker} on the question." (`.waiting`); field "Why set it aside?" (`.setaside.why`).
- C9. Section "Set aside" (`.setaside`), help `held.setaside.says`: rows "Set aside by {author}: “{reason}”" (`.asideby`), button "Restore, with a reason" (`held.restore`), help `held.restore_does`. None: "Nothing is set aside." (`.asideempty`).
- C10. A bar of what is picked, with buttons "Set aside with a reason" (`act.heldsetaside.label.held`), "Restore" (`act.heldrestore.label.held`), "Vouch for them" (`act.release.label.held`); the vouch asks "What you vouch for" (`.ack`, help `.ackhelp`) and "What you did to check" (`.mitigation`, help `.mitigationhelp`).

**States**

| State | When | What shows (exact) |
|---|---|---|
| S1. Held captures | some are held | C1 to C10. |
| S2. Nothing of yours | "Mine", none held | "Nothing of yours is held. Choose Everyone's to see the captures other members are holding." (`screen.held.empty.mine`). |
| S3. Nothing held | "Everyone's", none held | "Nothing is held: every capture here has been vouched for or set aside." (`screen.held.empty`). |
| S4. After vouching | "Vouch for them" | "Vouched for: {count}. They are in the record now." (`.released`). |
| S5. After setting aside | "Set aside with a reason" | "Set aside: {count}. They are listed under Set aside, where they can be restored, with a reason." (`.setasidecount`). |
| S6. After restoring | "Restore" | "Restored: {count}. They wait in Held captures again." (`.restored`). |
| S7. Assistant unreachable | no AI account | Unchanged; no assistant act. |

**Actions**

| Control | When | Leads to |
|---|---|---|
| A1. Choice "Whose captures" (`heldcaptures`) | always | the list for that choice |
| A2. A photo's thumbnail | a photo | `open-file` (the safe view until checked) |
| A3. Link "Open its files" | an archive | `archive` |
| A4. Link "Open it" | ineligible row | `document`, held |
| A5. "Vouch for them" (`release`) | captures picked | S4 |
| A6. "Set aside with a reason" (`heldsetaside`) | picked | asks the reason; S5 |
| A7. "Restore" / "Restore, with a reason" (`heldrestore`) | set-aside picked | S6 |
| A8. "Next page", "Previous page" | more than shown | the next or previous page |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. Any act | nothing picked | "Pick the captures first." (`screen.held.none`) |
| V2. Vouch fields | missing | "Before vouching, say: {fields}." (`.vouchmissing`) |
| V3. Vouch fields | over 500, quotes or line breaks | "{field} must be at most 500 characters, with no quotation marks, backslashes or line breaks." (`.vouchbad`) |
| V4. Vouch | partial copy | `screen.held.vouch.partsonly` (only parts were kept; capture it again whole) |
| V5. Vouch | could not gather | "The picked captures could not be gathered to vouch for them together. Nothing was vouched for; try again." (`.selectfailed`) |

---

## archive: the archive's title

**Address.** `/app/archive/<archive>`. **Frame.** Working; rail place Add; breadcrumb "Add › Held captures › Archive".
**Who can see it.** Members who may see the archive; a file in a place the member may not see shows "Filed, in a place you may not see" (`screen.archive.filedunseen`).
**Purpose.** One captured archive and every file in it: filed and held for review beside it, already held, or not filed with its reason (`screen.archive.purpose`).
**Entry points.** `held` link "Open its files".

**Content**
- C1. Heading: the archive's title; beneath: "Captured by {name} from {source}, {date}" (`screen.archive.capturedby`) and its project. Title card `screen.archive.tip.title`, `.tip.title_holds`.
- C2. Grade, button "Why {letter}?" (`screen.document.gradenote.head`; act "Read the grade note"), "fingerprint {short}" (`.facts`), "{entries} entries" (`.facts.entries`). No note: "No grade note is held for this archive." (`.nonote`).
- C3. Summary: "Opened when it was captured: {filed} files filed and held for review beside it, {held} already held, {notfiled} not filed, {folders} folders." (`.summary`); `.gradeabout` and "Anyone can cut the same file out with ordinary tools and get the same fingerprint." (`.samefingerprint`).
- C4. Section "Files in it" (`.files`), column "File" (`.col`): each file with a checkbox and its state: "Filed · held for review beside the archive" (`.filed`); "Already held · the same file {name} captured on {date}; this copy is kept as a second sighting of it" (`.alreadyheld`); "A folder · its {count} files are listed and filed below it" (`.folder`); "A link to {target}: listed, never followed" (`.link`); "{count} entries share this name; each is filed by its number" (`.samename.each`); "Not filed: the archive locks this file with a password. It is listed, never opened." (`.notfiled.password`); "Not filed: {size}, over the {limit} limit for one file. Capture the {kind} from its own address." (`.notfiled.size`); "Waiting to be filed" (`.waiting`). Note `.names`.
- C5. Section "A higher grade for one file" (`.higher.heading`): `.higher.how`; link "Capture a file on its own" (`.higher.capture`).
- C6. A bar of the files picked with buttons "Show only those not filed" (`.onlynotfiledact`), "Set aside with a reason" (`act.heldsetaside.label.archive`), "Vouch for them" (`act.release.label.archive`).

**States**

| State | When | What shows (exact) |
|---|---|---|
| S1. An archive that opened | opened on capture | C1 to C6. |
| S2. An archive that could not be opened | refused whole | C1, C2; "Could not open this archive, because {reason}." (`.refused.head`); `.refused.none` (nothing filed; the archive stays captured as it arrived); note `.refused.note`; button "See what it lists" (`.see`). |
| S3. Not opened yet | files wait | "Held, but not opened yet: {waiting} files wait to be filed." (`.notopened`). |
| S4. No files | the archive lists none | "This archive lists no files." (`.empty`). |
| S5. Only those not filed | after A1 | "Showing only the files not filed." (`.onlynotfiled`). |
| S6. Assistant unreachable | no AI account | Unchanged. |

**Actions**

| Control | When | Leads to |
|---|---|---|
| A1. "Show only those not filed" / "See what it lists" (`archivelist`) | S1 / S2 | S5 / the list "What it lists" (`.lists`) |
| A2. "Why {letter}?" (`gradenote`) | always | the grade note opens in place |
| A3. "Vouch for them" (`release`) | files picked | vouched; they leave Held captures |
| A4. "Set aside with a reason" (`heldsetaside`) | files picked | "Set aside: {count}. They are listed under Set aside in Held captures." (`.setaside`) |
| A5. Link "Capture a file on its own" | C5 | `capture` |
| A6. More files than shown | — | "More files than are shown: {count} shown." (`.more`) |

---

## open-file: the file's title

**Address.** `/app/open-file/<file>`. **Frame.** Working; rail place Projects; breadcrumb "Projects › {project} › Opening a file".
**Who can see it.** Members who may see the file.
**Purpose.** Before a file opens: whether it is low or high risk and why, its safe view, the checks it has had, and how a held file is released (`screen.open-file.purpose`).
**Entry points.** `document` link "Open the original file"; `held` thumbnail.

**Content (all states)**
- C1. Heading: the file's title; beneath, how it came (for example "Handed in at the doorbell, {date}", `screen.open-file.handedin`; "Added by you, {date} · {project}", `.byyou`).
- C2. A risk chip with its card: "Low risk" (`.risk.low`, `.risk.low.means`), "High risk" (`.risk.high`, `.risk.high.means`) or "Held" (`.risk.held`, `.risk.held.means`), and a line: "Fetched by your team's Civicsmith; nothing in it acts on its own." (`.risk.low.short`) or "Handed in, not fetched by your team's Civicsmith; {why}." (`.risk.high.short`).
- C3. The safe view card "The safe view" (`.safe`): `.safe.about`, mark "Derived · a safe copy of the original" (`.safe.origin`), `.safe.cite`; once open: "The safe view is open below: each page as a picture, so nothing in it can run." (`.safe.ready`), "{pages} pages, each a picture." (`.safe.pages`), `.safe.truncated`; a sheet: "Sheet: {name}", "Cell", "Value".
- C4. Section "Checks" (`.checks`): each check "{tool}: {result}" (`.note.line`), "Built-in scanner" (`.tool.clamav`), results "Not scanned yet", "Clean: nothing found", "Something was found", "Could not be scanned just now" (`.result.*`); none: "No check has been noted on this file yet." (`.checks.none`); "Deeper check: {state}" (`.deeper.state`) with "not asked for yet", "asked for, waiting its turn", "running now", "done" (`.deeper.*`).
- C5. Where a check cannot look inside: `.check.inside`; an unread image kind: `.image.unread`.

**States**

| State | When | What shows (exact) |
|---|---|---|
| S1. Low risk | fetched by Civicsmith, nothing active | C1, C2 "Low risk", button "Open the original" (`act.openoriginal.label.open-file`), C4, note "Checked again every week, and before it is first opened if the last check is older than that." (`.weekly`). |
| S2. High risk | handed in or holding active content | C1, C2 "High risk"; buttons "Show the safe view on this page" (`act.safeview.label.open-file`), "Ask for a deeper check" (`.deeper`); C3; section "Ask for a deeper check" with `.deeper.about` and C4; section "Or open it now, without a deeper check" (`.warn`): dialog "Open the original on your own device" (`.warn.title`) with `.warn.why` and `.warn.ends`; checkboxes under "Before you open it" (`.warn.confirm`): "I will open it on my own device, not a shared one" (`.warn.device`), "I will not enable macros or editing" (`.warn.macros`); button "Open the original, accepting this" (`.warn.accept`); link "Cancel" (`shell.cancel`); `.warn.notoffered`. |
| S3. Held after a finding | a scanner found something | C1, C2 "Held"; "The built-in scanner found {finding} on {date}, and so did {tool} in the deeper check." (`.found.by`), the finding's card `.tip.threat`; "What was found: {names}" (`.findings`); `.found.resembles`; a Noticed row "A scan found something in {document}" (`queue.scan-found.summary`) "sent once to the members who can see it" (`.found.sent`); the safe view and deeper-check buttons; section on releasing: `.held.about` or `.held.about.outside`; "The file read whole" (`.whole`) "Flagged: {what}" (`.flagged`); field for the reason (no word row for "Why release it?"); button "Release, with a reason" (`act.releasescanhold.label.open-file`); "{name} gave a reason on {date}; a second member's releases it. The assistant never can." (`.release.waiting`). No open-with-warning. |
| S4. A file you added yourself | your own upload | C1 "Added by you, {date} · {project}"; C2 "High risk" with "Added by you, not fetched by your team's Civicsmith: every such file is high risk, yours included." (`.high.yours`); "What to do next" (`.next.head`) "Read it in the safe view below. To open the original itself, ask for a deeper check first." (`.next.yours`); the safe view and deeper-check buttons; C3; a plain-text file: `.safetext`, `.safetext.cut`; section "Checks": "Not checked yet: its first check is waiting. The original never opens before a check." (`.check.notyet`). |
| S5. Opened | after opening the original | "The original was handed to your browser as a file." (`.opened`); "Checked as it was handed to your browser: it matched the fingerprint it was captured under, so it is the file your team holds." (`.digest.checked`). |
| S6. Assistant unreachable | no AI account | Unchanged; no assistant act. |

**Actions**

| Control | When | Leads to |
|---|---|---|
| A1. "Open the original" (`openoriginal`) | S1 | S5 |
| A2. "Show the safe view on this page" (`safeview`) | S2 to S4 | C3 opens on this page |
| A3. "Ask for a deeper check" (`deepercheck`) | S2 to S4 | "Deeper check: asked for, waiting its turn" |
| A4. "Open the original, accepting this" (`openwithwarning`) | S2, both boxes ticked | S5 |
| A5. Link "Cancel" | S2 dialog | the dialog closes; nothing opens |
| A6. "Release, with a reason" (`releasescanhold`) | S3 | first reason: "Your reason is recorded. A second member's reason releases it; the machine never can." (`.release.pending`); second: "Released: the original can be opened again." (`.release.done`) |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. The two boxes | not both ticked | "Tick both before it opens." (`.warn.both`) |
| V2. Opening | not allowed now | "The original can't be opened now: {why}" (`.closed`) |
| V3. Release reason | empty | the shell asks for the reason before the act |

---

## find-in: "Find in this"

**Address.** `/app/find-in/<subject>` (a document, the held set, or a project). **Frame.** Working; rail place Projects; breadcrumb "Projects › {project} › Find in this".
**Who can see it.** Members who may read the subject.
**Purpose.** Look through a document, the documents you are holding together, or a project for people, money, dates, requirements or a word; each result shows its passage and becomes a fact only by a member's act (`screen.find-in.purpose`).
**Entry points.** `document` button "Find in this"; `finder` "Find in these"; `capture` "Cite a passage"; a project's "Find in this".

**Content**
- C1. Heading "Find in this" (`screen.find-in.name`); beneath: "Pick what to look for. Every result shows where it was found. Nothing is recorded until you record it." (`screen.find-in.sub`).
- C2. Choice "Look in" (`.lookin`), help `.lookin.help`: "This document: {document}" (`.scope.this`), "The documents you are holding together" (`.scope.held`), "Everything in {project} ({count} documents)" (`.scope.project`).
- C3. Checkboxes "What to find" (`.what`): "People and offices your team follows", "Money figures", "Dates and deadlines", "Requirements: what someone shall or must do", "Events in minutes and agendas" (`.kind.*`).
- C4. Field "The name or term" (`.term`), help `.term.help`; choice "For which question" (`capture.forquestion`), help `.question.help`, or "None yet" (`.question.none`).
- C5. Buttons "Find" (no word row for this label; act `findin`, "Find in this") and "Keep finding this as documents arrive" (`act.standingquestionset.label.find-in`).
- C6. Results in sections "{kind} · {n}" (`.section`) or "“{term}” · {n}" (`.termsection`); each result marked "Found by search", quoted "“{words}”" (`.quote`), with where: "passage {n}" (`.passage`), "{office}, held today by {name}" (`.office.heldby`), "a period, counted from each {item}" (`.date.period`), "the document's own date" (`.date.own`), "a table: its dates are counted through a calculation, never read in one by one" (`.date.table`), "named in {count} of the {total} documents" (`.person.named`), "first in {document}" (`.person.first`); a held standard: "Held as a standard by {name} on {date}" (`.standard.held`). Empty section: "Nothing here." (`.nothing`) with "This document has no money figures." (`.money.none.one`) or "Neither document has money figures." (`.money.none.all`).
- C7. A match in a sheet: section "A match in a sheet" (`.sheet`) with button "Declare the table".
- C8. Unsearched documents: `.notread` or `.notread.one`; "Not searched: {documents}" (`.notread.which`).
- C9. Note `.note` (search finds words as written, figures, dates and names the team follows; a name it doesn't follow is found only as a word).
- C10. Fold "Add a fact from this passage": "What kind of fact" (`.field.kind`), "The fact, as you read it" (`.field.value`), note `.fact.office`; "When it is true" (`.valid`), help `.valid.help`; "True from", "True until" (`.valid.from`, `.valid.to`); "How exact the dates are" (`.valid.precision`); "Counted in your team's time zone: {zone}." (`.valid.zone`); fold "When the bounds can't be read" (`.bounds.summary`).
- C11. Fold "Read into a money fact": "What kind of figure" (`screen.money.f.kind`), "Its stage: proposed, adopted, amended or actual" (`.field.phase`), "The amount, in figures" (`.field.amount`), "Currency" (`.field.currency`); "Who paid whom" (`money.flow.step`) with `.flow.help`; fold "A required field left empty" (`.empty.summary`).
- C12. Cite in the question: radio "How it bears on the question" ("Supports", "Cuts against", `screen.findin.cite.supports`, `.cite.against`), none chosen; button "Cite in the question" (`act.cite.label.find-in`).

**States**

| State | When | What shows (exact) |
|---|---|---|
| S1. A document | opened from a document | C1 to C12, scope "This document: {document}". |
| S2. The held set | opened from Find's held set | As S1, scope "The documents you are holding together"; sheet matches (C7). |
| S3. A project | opened from a project | As S1, scope "Everything in {project} ({count} documents)"; long sections end with button "See all {count} in Find" (`.seeall`); after recording: "Recorded: …" with "{kind} for {name}: {value}" (`.recorded.fact`) and "Recorded by {who}" (`.recorded`). |
| S4. No subject | opened with none | "Open Find in this from a document, from the documents you are holding together, or from a project." (`.scope.none`). |
| S5. Kept finding | after "Keep finding this as documents arrive" | "Kept: new matches will arrive in your queue as a list." (`.keeping`). |
| S6. Assistant unreachable | no AI account | As S1 to S3. No section "Proposed by the assistant". |
| S7. Assistant reachable | an AI account (`AI`) | Section "Proposed by the assistant" (`.proposed.head`) with "Not in the first release." (`.proposed.notyet`), `.proposed.later`, `.proposed.labeled`: drawn as later, no act. `not built`. |

**Actions**

| Control | When | Leads to |
|---|---|---|
| A1. "Find" (`findin`) | always | results (C6) on this screen |
| A2. "Keep finding this as documents arrive" (`standingquestionset`) | a question chosen | S5 |
| A3. "Add a fact from this passage" (`recordpersonfact`) | a person or office | the fact is recorded; S3's line; it stands on `person` |
| A4. "Record a dated fact" (`recorddatedfact`) | a date | the fact is recorded |
| A5. "Hold this as a standard" (`standarddeclare`) | a requirement or period | fields "How the requirement is cited", "Who set it", "Why your team holds them to it", "What kind of standard" (`.field.cite`, `.field.issuer`, `.field.reason`, `.field.standardkind`); then "Held as a standard by {name} on {date}" |
| A6. "Read into a money fact" (`recordfact`) | a money figure | the money fact is recorded |
| A7. "Declare the table" (`tabledeclare`) | a sheet match | field "The table's columns, in order, separated by commas" (`.field.header`) |
| A8. "Cite in the question" (`cite`) | a passage, a role chosen | cited; the passage's row shows it |
| A9. "See all {count} in Find" (`search`) | S3 | `finder` with that search |
| A10. A person's or document's name | always | `person`, `document` |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. "What to find" | none ticked | "Tick at least one thing to find." (`.kindsfirst`) |
| V2. "The name or term" | the term kind chosen, empty | "Write the name or term to find." (`.termfirst`) |
| V3. Cite | no question | "Choose the question to cite this in first." (`.questionfirst`) |
| V4. Cite | no role chosen | "Choose first whether this passage supports the question or cuts against it. Nothing was cited." (`screen.findin.cite.norole`) |
| V5. "True from", "True until" | not a date | `refusal.BAD_VALIDITY` ("Those dates can't be recorded: a bound is a date, or left empty when the passage does not state it. Nothing was recorded.") |
| V6. Money fact | a required field empty | names the field, e.g. "who received it" (`.field.payee.short`); nothing recorded |

---

## Differences seen in the code

The design above is the authority; these are where the built code was seen to differ (read, not run).

- `home` S2, S3: the "Welcome, {name}" section and "Continue the guided welcome" are not drawn by Home; the wizard guide draws "Continue: {name}" (`screen.guide.welcome.continue`) instead (bio-plane/src/screens-wizards/guide.mjs:483; no `home.welcome` in bio-plane/src/screens-daily/home.mjs).
- `home` A17 and `queue` A12: `taskdecide` is registered only once its owners declare the op; it is not declared, so neither screen draws it (bio-plane/src/screens-daily/home.mjs:21-22, :438).
- `finder` A15: "Follow this item into another dimension" and "Search the registers" appear only in the key list, in no screen (bio-plane/src/screens-settings/keys.mjs; not in bio-plane/src/screens-daily/finder.mjs).
- `find-in` S7: the section "Proposed by the assistant" (`screen.find-in.proposed.*`) is not drawn by the code (no reference in bio-plane/src/screens-daily/find-in.mjs).
- `capture` V1: the code refuses an empty address with `capture.fieldneeded`; the word row `screen.capture.address.empty` ("Write the address first: an https address on a public site.") is not drawn (bio-plane/src/screens-intake/capture.mjs:655).
- `capture` V2 to V7: the word table holds two English versions of each fetch refusal, `refusal.<CODE>` and `screen.capture.refusal.<CODE>`, which differ; the design's drawing uses `refusal.<CODE>`. Which one a refused fetch shows was not settled from the code.

## Changes

- 22 Nov 2026: written.
