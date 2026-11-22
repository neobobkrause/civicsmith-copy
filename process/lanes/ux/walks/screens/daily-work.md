Length: N lines. Last section: "Changes".

# Screens: Daily work

Page `daily-work` of the Screens document (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

The group "daily work" has fifteen screens. Thirteen are here. `document` and `contradiction` are on the page `reading-a-document`, because together the fifteen would pass the page limit.

What every screen shares is on the page `every-screen` and is not repeated: the working frame, the rail, the strip, the assistant dock, how a refusal is shown, the shell's own refusal for an empty required field or reason. Every screen here is in the working frame. A visitor not signed in is shown `front`, and the address is kept for after sign-in. An address naming a subject the member may not see, or none, shows `unavailable`.

The walk has no AI account, so the assistant is unreachable. Each screen says what shows then. The assistant is absent, not greyed: no control for it is drawn.

How to read the words. Exact words are in quotes, each with its key in `words.json`. In each screen's section, a key that starts with a dot is under `screen.<id>.` (for example `.empty` on `queue` is `screen.queue.empty`). A dot key that follows another key in the same brackets and is not under `screen.<id>.` shares that key's stem: (`queue.none.todo`, `.todo2`) is `queue.none.todo2`. A key followed by words in square brackets is a longer explanation, summarised. Values in braces, such as `{n}`, come from the team's record. The test team is Lakeshore Tenants (index, section 5).

## The screens on this page

| id | heading | address | built? |
|---|---|---|---|
| `home` | the team's name, "Lakeshore Tenants" | `/app` | built |
| `projects` | "Projects" | `/app/projects` | built |
| `theme` | "Themes", or one theme's name | `/app/theme[/<theme>]` | built |
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

---

## home: "Lakeshore Tenants"

- **Address** `/app`, and `/` when signed in. **Frame** working; rail place Home.
- **Who can see it** every signed-in member.
- **Purpose** The team's nerve center: what needs you, what needs the team, every area at a glance, the projects and what changed since you last looked (`.purpose`).
- **Entry points** rail "Home"; signing in; `elsewhere` "Back to Home"; `queue` "Go to Home".

**Content (S1)**
- C1. Heading: the team's name. Unnamed: "Your team" (`shell.group.unnamed`). Beneath: the team's description.
- C2. The strip (`every-screen`). Example chip "1 of our own dates passed" (`home.strip.ours_passed.one`); its card ends "Opens your queue at this item." (`home.strip.ours_passed.opens`).
- C3. Section "Needs you" (`.needsyou`), help `.needsyou.holds` [yours to do, soonest first; not shown when empty]. Rows, each with its act: "Vouch for the {count} copies you captured at {place}" (`.todo.vouch`; also `.todo.vouch.one`, `.todo.vouch.noplace`, `.todo.vouch.noplace.one`); "Decide on a newer version of {document} you cited" (`.todo.newer`); "Approve the {kind} to {office}, drafted by {name}" (`.todo.approve`); "{name} asked you to check a calculation: {calculation}" (`.todo.check`); a request to join; an invitation; to an administrator, "An update to your team's Civicsmith is ready: release {version}{security}" (`home.update.ready`; `{security}` is ", with a security fix", `home.update.security`).
- C4. Section "Needs the team" (`.needsgroup`), help `.needsgroup.holds`. Rows: "Waiting for a member to look: {held} in Held captures, {inbox} in Inbox." (`.waiting.counts`); "{office}'s reply to “{action}” was due {date}; no reply recorded" (`.group.noreply`); "Two documents give different dates for {what}" (`.group.tension`) · "nobody has judged it" (`.group.unjudged`); "{office}'s reply to your records request is due {date}" (`.group.requestdue`). Whose move: "{who}'s move" (`.move.member`), "an administrator's move" (`.move.admin`), "any member can take the next step" (`.move.anyone`).
- C5. Section "Each area at a glance" (`.areas`), help `.areas.holds` [a reading at zero is never shown; an empty area is left out]. Blocks, each name a link: "Investigation", "Action", "Members", "Administration" (`.area.investigation`, `.area.action`, `.area.members`, `.area.administration`). Each says "{n} to do" (`.area.need.many`), "1 to do" (`.area.need.one`) or "nothing needs you here" (`.area.nothing`). Readings `.rd.*` (documents, questions, people followed, cases, clocks running, members, administrators, invited, this release, security level). Lines: "{count} questions meet the bar" (`.area.meetbar`); edition lines `.area.edition.*`; "{count} things came in since you last looked: {latest}" (`.area.camein`); "Our move: {n}, the earliest due {date}" (`.area.ourmove`); "Their move: {n}, the earliest due {date}" (`.area.theirmove`); "Expertise on hand: {people}" (`.area.expertise`); "{name}'s invitation link is out, unused" (`.area.invitation`); to an administrator "Places: {places}" (`.line.places`), "languages: {languages}" (`.line.languages`), "This month on the team's key: {used} of the {limit} limit" (`.line.ailimit`) or "This month on the team's key: {used}, estimated" (`.line.aiused`).
- C6. Section "Projects" (`.projects`): table Project, Stage, Members, Activity, 8 weeks, Last change. Stages "Forming", "Investigating", "Matured", "Closed" (`.stage.*`). "Owner: {handle}" (`.owner`); "Last change {date}" (`.lastchange`) or "No change in the last eight weeks" (`.lastchange.none`). Too many: "Your team has more projects than are shown here." (`.truncated`).
- C7. Section "Since you last looked" (`.since`), help `.since.holds`: "{name} captured {document}" (`.since.captured`), "{name} added {count} events to {timeline}" (`.since.events`), "{name} started the money trail “{trail}”" (`.since.trail`).
- C8. Heading "What happened?" (`door.front.head`). Six door buttons, name and hint: "A problem I live with" / "Potholes, dumping, a bill, a service"; "A person" / "An official, a name in the news"; "A payment or contract" / "A budget line, a lease, a change order"; "Something I read" / "A code, a court case, a story, minutes"; "A tip or documents" / "Something someone handed you" (`door.front.<door>.name`, `door.front.<door>.hint`); "Help for my own situation" (`door.front.elsewhere.name`) / `door.front.elsewhere.hint` [a matter yours alone; Civicsmith knows where to send you].
- C9. Button "Start a project" (`act.promote.label.home`), help `act.promote.here.home`.

**States**

| State | When | What shows |
|---|---|---|
| S1. Busy team | member who may start projects | C1 to C9. |
| S2. First visit, may start projects | first visit after joining | C1, C2; section "Welcome, {name}" (`home.welcome.title`) with `.welcome.what` [the guided start, ten more minutes]; button "Continue the guided welcome" (`.welcome.continue`); link "Not now" (no word row on Home); then C4, C5, C6, C8, C9. No C3, no C7. |
| S3. First visit, may not start projects | member without that right | C1; the welcome of S2; section "Getting into a project" (`.join.heading`), help `.join.says`; "Your team's work happens in projects, and you're not in one yet. Join one you were invited to, or ask to join one the team can find." (`.join.lead`); invited rows with button "Join", findable rows with button "Ask to join" or "Withdraw your request"; note "Starting a project of your own is for members your team's administrators allow. Administrators: {admins}. Ask if you have a problem to bring." (`.join.nocreate`); the door "Help for my own situation" alone. No "What happened?", no "Start a project". |
| S4. May not start projects, nothing open | nothing to join | C1; section "Getting into a project" with "No project is open to you yet. A project's owners can invite you, and your team's administrators can let you start your own. Administrators: {admins}." (`.join.none`); the door "Help for my own situation". |
| S5. Founder of a new team | no members or projects yet | C1 ("Your team" while unnamed); section "Your team's Civicsmith is ready" (`home.ready.title`) with `.nothingyet` [start by inviting members and opening one project]; numbered: button "Name your team" (`home.first.name`); button "Invite your first members" (`.invite`) "Make an invitation link for each person and send it yourself: Civicsmith sends no email." (`.first.invite`); button "Say who your team is" (`.saywho`) `.first.identity`; "Open your first project: choose below what happened." (`.first.project`); then C8, C9. Nothing else. |
| S6. A read failed | a block's read fails | that block drawn as failed, never as empty (`every-screen`). |
| S7. Assistant unreachable | no AI account | as S1; Home has no assistant act. |

**Actions**

| Control | When | Leads to |
|---|---|---|
| A1. A strip chip | items due | `queue` at the item, or the `action` or `request` it names |
| A2. button "Vouch for them" (`screen.queue.vouch.them`; act `release`) | own captures held | vouched; row leaves |
| A3. buttons "Adopt the newer version", "Keep the version you cited" (`act.adoptversion.label.home`, `act.keepversion.label.home`) | newer version | reason "Why adopt the newer version" (`.why`); row leaves |
| A4. button "Read and approve it" (`.todo.approve.button`; `filingapprove`) | letter to approve | its full approval dialog |
| A5. button "Open the check" (`screen.queue.check.open`; `taskresolve`) | a check | the screen it concerns |
| A6. buttons "Grant", "Decline" (`.request.grant`, `.request.decline`) | request to join your project | row leaves |
| A7. button "Join" (`act.projectjoin.label.home`) | invitation | joined; row leaves |
| A8. button "Ask to join" / "Withdraw your request" (`act.projectrequest.label.home`, `act.projectrequestwithdraw.label.home`) | S3, findable | row reads "You asked to join on {date}. Its owners decide." (`projects.request.asked`) / back to "Ask to join" |
| A9. link "See what changes" (`queue.update.see`) | update ready | `updates` |
| A10. area names | always | Investigation `dash-project`; Action `dash-action`; Members `members`; Administration `settings` |
| A11. a project's name | always | `project` |
| A12. a door button (`startfrom`, "Start from…") | S1, S2, S5 | its offer opens in place: the wizards suggested, "Already in your team: {items}" (`door.front.matching`), "None of these: start a project from a blank page." (`door.front.blank`) |
| A13. door "Help for my own situation" | always | `elsewhere` |
| A14. button "Start a project" (`promote`) | may start projects | field "The project's title" (`.title`), help `.title.help`; then `project` |
| A15. "Continue the guided welcome" | S2, S3 | the wizard "Welcome a new member" at its next step |
| A16. buttons "Pass it to another member", "Endorse an administrator", "Add an owner", "Confirm expertise" (`act.<op>.label.home`) | routed to-do | row leaves once answered |
| A17. "Say who issued it, or that you could not tell" (`act.owed_taskdecide.label.home`) | issuer unknown | `not built`; as `queue` A12 |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. "The project's title" | empty | "Give the project a title first." (`.title.needed`) |
| V2. "What happened, in your own words" (`.words`) | empty | "Write what happened first." (`.wordsfirst`) |
| V3. any required field | empty | "Fill this in first." (`.fieldfirst`) |

---

## projects: "Projects"

- **Address** `/app/projects`. **Frame** working; rail Projects. **Who** every signed-in member; each sees the projects they may see.
- **Purpose** Every project you can see: its stage, who works on it, how busy it is, and when it last changed (`.purpose`).
- **Entry points** rail "Projects"; `theme` breadcrumb.

**Content (S1)**
- C1. Heading "Projects" (`.name`); beneath "Each project is one problem the team wants to get to the bottom of. These are the ones you can see." (`.sub`).
- C2. Field "Search projects by name" (`.search.label`), help `.search.help`; choice "Show only" (`.filter.label`): "All you can see", "Ones you are in", "Ones you own" (`.filter.all`, `.filter.in`, `.filter.own`), help `.filter.help`; button "Search projects" (`.search.go`).
- C3. The table as `home` C6; "Questions: not shown to you" (`.questions.unknown`) where hidden.
- C4. Section "Invited" (`projects.invited.head`), help `projects.invited.says`: each with "hidden: only the members invited know it exists" (`.invited.hidden`) and button "Join".
- C5. Section "Findable" (`projects.findable.head`), help `projects.findable.says`: each with "Findable: only its name shows until its owners let you in." (`projects.findable.meta`) and button "Ask to join"; once asked, "You asked to join on {date}. Its owners decide." (`projects.request.asked`) and button "Withdraw your request".
- C6. Note `.columns.note` [what Stage, Members and Activity mean].
- C7. Section "Themes" (`theme.section`), help `theme.across` and `theme.never.evidence`; each theme's name; link "Every theme" (`theme.every`).
- C8. Fold "Start a project": field "What it is about" (`project.start.title`), help `project.start.title.help`; radio "Who can find it" (`project.visibility.title`): "Hidden: only the members you invite know it exists", "Findable: every member of the team sees it in Projects and can ask to join" (`project.visibility.start.hidden`, `.start.discoverable`); "Choose one: neither is chosen for you. You can change it later, with a reason." (`project.visibility.start.later`); button "Start the project" (`project.start.go`).
- C9. Link "Imported cases" (`screen.imported.list`).

**States**

| State | When | What shows |
|---|---|---|
| S1. In use | projects exist | C1 to C9. |
| S2. New team, no projects | none | heading "Projects", `projects.empty.sub` ["No projects yet. A project is one problem…"], note `projects.empty.note`, C8. No table. |
| S3. May not start projects | lacks the right | C1 to C7, C9; note "Starting a project is for members your team's administrators allow. Administrators: {admins}. Ask if you have a problem to bring." (`.nocreate`). No C8. |
| S4. Assistant unreachable | no AI | as S1; no assistant act. |

**Actions**

| Control | When | Leads to |
|---|---|---|
| A1. button "Search projects" | always | the table narrows |
| A2. a project's name | always | `project` |
| A3. button "Join" | invited | joined; it moves into the table |
| A4. "Ask to join" / "Withdraw your request" | findable | the row changes as C5 |
| A5. a theme's name; link "Every theme" (`themeread`) | always | `theme` |
| A6. button "Start the project" (`promote`) | may start | the new `project`, you its owner |
| A7. link "Imported cases" | always | `imported` |

**Form messages.** V1. "What it is about" empty: "Give the project a title first." (`.title.needed`). V2. "Who can find it" unchosen: the shell's refusal for a missing field.

---

## theme: "Themes"

- **Address** `/app/theme` (every theme), `/app/theme/<theme>` (one). **Frame** working; rail Projects; breadcrumb "Projects › Themes". **Who** every signed-in member; a theme lists only documents the member may open.
- **Purpose** The team's themes: lenses that gather documents and passages, never evidence (`.purpose`).
- **Entry points** `projects` "Themes"; a theme's name on `document`; `finder` "Theme".

**Content**
- C1 (S1). Heading "Themes" (`.name`); beneath "A theme gathers documents and passages so members can see them together. It is never evidence: a finding cites the document or passage itself." (`theme.never.evidence`).
- C2 (S1). Section "Every theme, newest first" (`theme.list.heading`): field "Words in a theme's name or test" (`theme.q.label`); each theme: name (a link), "Belongs when: {test}", counts placed and hunches, "declared by {who}, {date}" (`.declaredby`).
- C3 (S1). Fold "Declare a theme" (`theme.declare`): fields "Its name" (`theme.name.label`), "Belongs when" (`theme.test.label`); button "Declare the theme" (`theme.declare.go`).
- C4 (S2). Heading: the theme's name; "Belongs when: {test}", who declared it and when; note `theme.never.evidence`.
- C5 (S2). Section "Placed in it" (`theme.placed`), help `.tip.placed`: each document (a link), who placed it, when, their note; a confirmed hunch reads "Placed by {who}, {date}; confirmed a hunch the assistant proposed: “{note}”" (`.placed.confirmed`); button "Take it out…" (`theme.takeout`).
- C6 (S2). Section "Hunches: not yet placed" (`theme.hunches`): "A hunch is not membership. It counts for nothing until a member places it." (`theme.hunch.note`); buttons "It belongs" (`theme.confirm`), "Reject…" (`theme.reject`).
- C7 (S2). Section "Taken out" (`theme.out`), help `.tip.removed`: who, when, why.

**States.** S1 every theme (C1 to C3). S2 one theme (C4 to C7). S3 assistant unreachable: as S1 or S2; hunches proposed before stay; none new arrive.

**Actions**

| Control | When | Leads to |
|---|---|---|
| A1. field "Words in a theme's name or test" (`themeread`) | S1 | the list narrows |
| A2. a theme's name | S1 | S2 |
| A3. button "Declare the theme" (`themedeclare`) | S1 | the theme heads the list |
| A4. button "It belongs" (`themeplace`) | S2 hunch | moves to "Placed in it" |
| A5. "Take it out…", "Reject…" (`themewithdraw`) | S2 | asks a reason; moves to "Taken out" with it |
| A6. a document's name | S2 | `document` |

**Form messages.** V1. "Its name" or "Belongs when" empty: the shell's refusal; nothing declared.

---

## dash-action: "Action"

- **Address** `/app/dash-action`. **Frame** working; rail Queue; breadcrumb "Action". **Who** every signed-in member.
- **Purpose** The Action area as a dashboard: clocks and whose move it is first, then what needs you, then every action (`.purpose`).
- **Entry points** `home` area "Action".

**Content**
- C1. The strip. Heading "Action" (no word row on this screen); beneath "Every clock that is running, whose move it is, replies that came in, and what waits for a second approval." (`.sub`).
- C2. Tiles "Clocks running" with "{n} due this week"; "Our move" with "due {day}"; "Their move" with "{n} with no reply recorded"; "Replies to read" with "came in {date}" (`.tile.clocks`, `.tile.dueweek`, `.tile.ours`, `.tile.dueday`, `.tile.theirs`, `.tile.noreply`, `.tile.replies`, `.tile.came`).
- C3. Section "Needs you" (`home.needsyou.title`), help "What is yours in Action: each item with whose move it is and its act." (`.tip.yours`).
- C4. Section "Every action" (`.every.heading`), help `.tip.every` [the clock as a sentence, never a countdown]. Columns "Action", "To", "Whose move", "The clock", "Next" (`.col.*`). Clocks: "The {office} must answer by {date}: {days} days under the {law}, rolled past a holiday." (`.clock.due`); "Sent {date}; the team gave until {due}." (`.clock.sent`); "Approve by {day}, the plan's checkpoint." (`.clock.approve`). Next: "Record what came back" (`.next.record`), "Escalate, as the plan sets" (`.next.escalate`), "the plan's next step is ready" (`.nextready`).
- C5. Button "Start an action" (`act.actioncreate.label.dash-action`).

**States.** One state: what the team has; a tile or section with nothing is left out. Assistant unreachable: unchanged.

**Actions.** A1 button "Read and approve it" (`filingapprove`): its approval dialog. A2 button "Remind me again on…" (`screen.queue.remind.button`; `reminderanswer`): field "Remind me again on (optional)" (`screen.queue.reminder.on`); the item returns that day. A3 an action's name: `action`. A4 button "Start an action" (`actioncreate`): `actionnew`.

---

## dash-project: the project's title

- **Address** `/app/dash-project/<project>`. **Frame** working; rail Projects; breadcrumb "Projects › {project}". **Who** the project's members; anyone else `unavailable`.
- **Purpose** One project as a dashboard: your next steps here, the project at a glance, its story so far, and its activity (`.purpose`).
- **Entry points** `home` area "Investigation".

**Content**
- C1. The strip; heading the project's title; beneath what it is about, its owner, its stage.
- C2. Section "Next for you here" (`.next.heading`), help `.tip.next` [in order; the first is the one to take now]. Steps: "Vouch for the {count} copies you captured at {place}" (`.next.vouch`; also `.next.vouch.one`, `.next.vouch.noplace`, `.next.vouch.noplace.one`); "Decide on the newer version of {document}" (`.next.newer`); "Then Edition {edition} can be prepared: the {count} findings meet the bar" (`.next.prepare`) with link "Prepare Edition {n}" (`.next.prepare.label`).
- C3. Section "This project at a glance" (`.glance.heading`): tiles "Documents", "Questions", "Events" ("{n} undetermined in order", `.tile.events.undetermined`), "Members" (`.tile.*`).
- C4. Section "The story so far" (`.story.heading`), help `.tip.story`: a short timeline, theirs above the line, ours below; "Undetermined order: {events}, each dated only {precision}." (`.story.undetermined`; `.precision.*`); link "Open the timeline" (no word row).
- C5. Section "Activity" (`.activity.heading`): who works on it, eight weeks of bars, "{name} added {count} events on {day}" (`.activity.events`).

**States.** One state; an empty step or tile is left out. Assistant unreachable: unchanged.

**Actions.** A1 button "Vouch for them" (`release`): vouched, step leaves. A2 buttons "Adopt it" (no word row), "Keep the version you cited" (`act.keepversion.label.dash-project`): asks a reason, step leaves. A3 link "Prepare Edition {n}": `ceremony`. A4 link "Open the timeline": `timeline`.

---

## elsewhere: "Where else to go"

- **Address** `/app/elsewhere`. **Frame** working; rail Home; breadcrumb "Home › Where else to go". **Who** every signed-in member.
- **Purpose** What you see when what you need is not Civicsmith's work: the places your team's place lists for it (`.purpose`).
- **Entry points** `home` door "Help for my own situation"; a door-offered wizard's guide; `places` "See the list".

**Content (S1)**
- C1. Heading "Where else to go" (`elsewhere.title`); beneath `elsewhere.says` [legal information, never legal advice; the places below can act].
- C2. Note "Opening this page records nothing, and nobody in your team is told." (`elsewhere.records_nothing`).
- C3. A section per kind listed, each with help `elsewhere.kind.<kind>_says`: "Legal help you can afford", "The courts' own self-help", "The city's service line", "A state agency for your kind of problem", "Your elected representative's office", "A newsroom that takes tips" (`elsewhere.kind.legalaid`, `.selfhelp`, `.service`, `.agency`, `.representative`, `.tipline`).
- C4. Each place: name; what it does; "phone", "web", "email", "address", "mail", "hours" (`elsewhere.reach.*`); "{days}, {open} to {close}" (`elsewhere.hours.span`); "Languages: {list}" (`elsewhere.languages`); "From {source}, read {date}" (`elsewhere.source`).
- C5. Link "Back to Home" (`elsewhere.back`).

**States**

| State | When | What shows |
|---|---|---|
| S1. Places listed | the place's rules list them | C1 to C5. |
| S2. None listed | the rules list nothing | C1, C2; section "Nothing listed yet" (`elsewhere.none.head`) with `elsewhere.none.says` [names the place; administrators can ask in Settings › Places and offices]; "If you are in danger now, call your local emergency number." (`elsewhere.danger`); C5. |
| S3. No place chosen | team follows no place | C1, C2; `elsewhere.none.noplace` ["Your team follows no place's rules, so Civicsmith has no list to show. …"]; `elsewhere.danger`; C5. |
| S4. Assistant unreachable | no AI | unchanged. |

**Actions.** A1 a place's web address: opens outside, in a new window. A2 link "Back to Home": `home`.

---

## queue: "Your queue"

- **Address** `/app/queue`. **Frame** working; rail Queue. **Who** every signed-in member; each sees their own.
- **Purpose** Your queue: everything waiting on you, in one list. To do needs your act, Noticed is something new nobody has judged, and Status tells you where something stands (`.purpose`).
- **Entry points** rail "Queue"; a strip chip; `home` rows.

**Content (S1)**
- C1. Heading "Your queue" (`.name`); beneath "{n} items" (`.count.many`; "1 item" `.count.one`) · "grouped by case" (`.grouped`) · link "sort by time due" (`.sort.bydue`). "Sort by" (`.sort`): "time added", "time due", "case", "kind" (`.sort.*`); "Sorted by {sort}" (`.sorted`).
- C2. After an act: "Done: {what}. It has left your queue." (`queue.done`).
- C3. Row "Choose several items to answer at once, or look back at what you answered." (`queue.multi.entry`), links "Choose several items" (`queue.multi.choose`), "What you answered" (`queue.answered.title`).
- C4. Note `.note` [the three kinds: To do, Noticed, Status] "(Shown once.)" (`.note.once`).
- C5. A section per case, items in no case under "Not in a case" (`.nocase`). Each item shows its kind; when due "Due today" (`.due.today`) or "Due {date}" (`.due.on`); one needing a reason "Needs a reason from you" (`.item.weight`).
- C6. Item kinds, each with its act: a newer version of a cited document; "Your team's declared way of reading evidence (its lens) changed after {work} was made" (`.your_teams_lens_changed_after`); "Who issued a document your team captured is not known yet." (`.routed.auth.item`); "{who} is proposed as an owner of {project}." (`.routed.owner.item`); a vouch; "Our own date passed {date}" (`due.ours.passed`) with `due.ours.passed_says`; two documents in tension; a reply due; "You left a request unsent: {what}" (`queue.request-unsent.summary`); a letter; a check; a hint, machine work, e.g. "A council member disclosed income from a firm whose contract they voted on" (`.hint.disclosed`); "Your standing question found {count} new documents: {what}" (`.standing.found`).
- C7. A hint's fold "How was this found?" (`.hint.how`): "What was matched" (`.hint.matched`); "How it was found" (`.hint.method`); "How far to trust it" (`.hint.trust`) with `.hint.rate` or `.hint.rate.none`, and "It is shown only because that rate is under {threshold}%." (`.hint.shown`); "What it is not" (`.hint.not`): "A lead, never a finding. Nothing here is evidence until a member opens a question and cites the documents themselves." (`.hint.not.text`).
- C8. To administrators, section "Your team's Civicsmith" (`queue.update.section`), help `queue.update.section_says`: "An update is ready: release {version}, {date}" (`queue.update.ready`), link "See what changes", button "Not now".
- C9. Members' to-dos (endorse, confirm expertise); the assistant's accounts (a limit reached: "told once to the project's owners" `.ai.toldowners`, "nobody is named" `.ai.nobodynamed`).
- C10. Section "Muted" (`queue.muted.title`), help `queue.muted.help`: "{kind}, in {project}" (`queue.muted.kind`) or "This item only: {item}" (`queue.muted.item`); "muted by you, {date}" (`queue.muted.by`; `queue.muted.by.undated`); button "Turn back on" (`queue.muted.unmute`).
- C11. Long: "{n} more items are not shown here; act on these first." (`.more`; `.more.one`). Captures: "Captures waiting for a vouch: {n}. They are not counted in your queue." (`.vouchband.apart`).

**States**

| State | When | What shows |
|---|---|---|
| S1. In use | items wait | C1 to C11. |
| S2. Nothing waiting | empty | heading "Your queue"; "Nothing is waiting on you." (`.empty`); rows "To do: none here." "Nothing asks for your act." (`queue.none.todo`, `.todo2`), "Noticed: none here." "The record found nothing new that you follow." (`queue.none.noticed`, `.noticed2`), "Status: none here." "Nothing you follow has changed." (`queue.none.status`, `.status2`); `.uptodate` ["You are up to date. …"]; links "Go to Home" (`.gohome`), "What you answered". |
| S3. A project invitation waiting | request, invitation, new signing key | "1 item · grouped by case"; request row `queue.project-request.detail` with "Grant", "Decline"; invitation row `queue.project-invitation.detail` with "Join"; section "Your team", signing-key row `queue.signer-self-registered.detail` with button "I know about this key" (`queue.signer-self-registered.known`). |
| S4. Choosing several | after "Choose several items" | heading "Your queue"; "Choose several items, then act on all of them at once." "Each item says what happened to it." (`queue.multi.head`, `.head2`); a checkbox per item; bar "{n} items chosen" (`queue.multi.chosen`; `.chosen.one`) with buttons "Mark them done", "Forward them to a member", "Snooze them to a date", "Dismiss them with a reason" (`queue.multi.done`, `.forward`, `.snooze`, `.dismiss`). |
| S5. What happened to them | after acting in S4 | "You acted on {n} items. Done and out of your queue: {done}. Not handled, still here: {kept}." (`queue.multi.result`; `.result.one`); each "Done" with "It has left your queue.", or "Not handled, stays here" (`queue.multi.refused`) with its reason, "Approving a letter needs you to read it first." (`queue.multi.why.letter`) or "A check needs your answer on the check itself." (`queue.multi.why.check`), and its own button; links "Back to your queue" (`queue.multi.back`), "What you answered". |
| S6. What you answered | after "What you answered" | heading "What you answered", beneath `queue.answered.head`; section "Snoozed" (`.snoozed.head`), help `.snoozed.holds`, rows "comes back {date}" (`.snoozed.until`) with button "Bring back" (`.bringback`); section "Answered" (`queue.answered.heading`), help `queue.answered.help`, rows `queue.answered.forwarded`, `.snoozed`, `.done`, `.dismissed`, `.muted`, each "Answered by you, {when}" (`queue.answered.byyou`) or "Answered by {member}, {when}"; section "Set aside" (`held.setaside.head`), help `queue.aside.help`, `.help2`, rows "Dismissed by you, {date}" or "Deferred by you until {date}" (`queue.aside.dismissed`, `.deferred`), "judged against the progression as it stood in version {n}" (`queue.aside.v2`), deferred rows with "Bring back", "Dismiss with a reason"; link "Back to your queue". |
| S7. All-clear not given | a feed did not answer | heading "Your queue"; "Not everything answered, so this cannot say nothing is waiting on you." (`queue.allclear.withheld`); "Notices about the documents your team watches did not answer." "What did answer shows nothing waiting; what did not may hold something." (`queue.allclear.failed`, `.failed2`) or "“{feed}” did not answer." (`queue.allclear.failed.feed`); link "Try again" (`queue.tryagain`). Never "Nothing is waiting on you." |
| S8. Assistant unreachable | no AI | as S1. A standing question's row shows its count with no "Read by the assistant" (`.standing.read`) mark. Assistant items (hints, exploring) show only if made before; none arrive. |

**Actions**

| Control | When | Leads to |
|---|---|---|
| A1. "Adopt the newer version", "Keep the version you cited" | newer version | reason "Why adopt the newer version" (`.why`); item leaves |
| A2. link "Settle it" (no word row) | lens changed | `bias` |
| A3. button "Vouch for them" (`release`) | a vouch | item leaves |
| A4. link "Open both" (no word row) | tension | `contradiction` |
| A5. "Remind me again on…" (`.remind.button`; `reminderanswer`) | reply due | field "Remind me again on (optional)" (`.reminder.on`) |
| A6. link "Pick up where you left off" (`.unsent.pickup`); buttons "Keep it for later" (`.unsent.keep`), "Drop the request, with a reason" (`.unsent.drop`; `actionmove`, help `act.actionmove.here.queue`) | unsent request | `request` at its step; snoozed; dropped |
| A7. "Read and approve it" (`filingapprove`) | letter | its approval dialog |
| A8. "Open the check" (`taskresolve`; help `queue.act.dothis.help`); "Pass it to another member" (`taskforward`) | a check | the screen it concerns; field "Forward to (the member's handle)" (`.forward.to`) |
| A9. hint buttons "Open a question from this" (`.hint.promote`), "Defer" (`.defer`), "Dismiss with a reason", "Stop this kind of hint for the project" (`.hint.stop`) | a hint | new question, field "The question, in your words" (`.question`); set aside (S6); muted (C10) |
| A10. "Snooze to a date" (`queuesnooze`); "Mute this kind" (`.mute.kind`) | status item | field "Until which day" (`.snooze.until`), help `.snooze.pick`; or muted |
| A11. link "See what changes"; button "Not now" (`act.owed_updatelater.label.queue`) | administrator | `updates`; item returns later |
| A12. button "Say who issued it" (`.routed.auth.open`) | issuer unknown | `not built`: form "Who issued this document?" (`.routed.auth.question`), choices "I know who issued it" / "I could not tell" (`.routed.auth.know`, `.auth.cannot`), fields "The issuing party", "How do you know?", "What you tried" (`.routed.auth.issuer.label`, `.how.label`, `.tried.label`), "Not knowing is a fine answer." (`.routed.auth.fine1`) `.fine2`, button "Record my answer" (`.routed.auth.record`) |
| A13. "Grant", "Decline", "Join", "I know about this key" | S3 | item leaves |
| A14. "Endorse an administrator", "Add an owner", "Confirm expertise", "Agree to remove an owner" (`act.<op>.label.queue`) | routed to-dos | item leaves once answered |
| A15. "Add an API key for the project" (`.ai.addkey`); "Explore today" (`.explore.today`) | assistant's accounts | `AI`: field "The project's Anthropic API key" (`.projectkey`); exploring today |
| A16. "Turn back on" | C10 | reaches the queue again |
| A17. links "Choose several items", "What you answered", "Back to your queue", "Go to Home", "Try again" | S1 to S7 | S4; S6; S1; `home`; the queue reads again |
| A18. S4's four buttons (helps `queue.multi.done.help`, `.done.help2`, `queue.multi.snooze.help`) | S4 | S5 |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. any required | empty | "Fill this in first." (`.fieldfirst`) |
| V2. issuer form | no basis | "You gave no answer to “How do you know?” or “What you tried.” Write it, then record your answer again." (`.routed.auth.refused.basis`) |
| V3. issuer form | "I know", no name | "You said you know who issued it but named no one." "Name the issuing party, or choose “I could not tell.”" (`.routed.auth.refused.issuer1`, `.issuer2`) |
| V4. issuer form | moved to another | "This item now belongs to someone else." "Ask them, or ask an administrator." (`.routed.auth.refused.yours1`, `.yours2`) |
| V5. issuer form | answered | "Someone already answered this. It has left your queue." (`.routed.auth.refused.done`) |

---

## finder: "Find"

- **Address** `/app/finder`. **Frame** working; rail Find. **Who** every signed-in member; results hold only what they may read.
- **Purpose** Search what the team holds, or browse it with no words; hold a set together; see where nobody looked (registry; `.purpose`).
- **Entry points** rail "Find"; `find-in` "See all {count} in Find".

**Content (S1)**
- C1. Heading "Find" (`.name`); beneath "Search everything your team holds, then hold a set together to act on it." (`.sub`).
- C2. Search field "Your words" (`.words`), placeholder "Words to find" (`find.query.placeholder`); button "Search" (`act.search.label.finder`).
- C3. Results with checkboxes ("Pick {title}", `.pick`): kind, grade, who captured it, when; a passage with the words around the match; a subject with "named in {n} documents, among them {document}" (`.named`). "{n} results" (`.total.many`; `.total.one`); "Showing {shown} of {total} matching documents." (`.shown`), button "Show more results" (`.showmore`).
- C4. "Nobody looked in {place} for this yet." (`.nobody.in`); buttons "See where nobody looked" (`act.frontier.label.finder`), "Count" (`act.calculationcreate.label.finder`).
- C5. Unread: `.unread` / `.unread.one` [some documents not read yet, may hold more].
- C6. Bar "{n} documents held together" (`.held.many`; `.held.one`) "until {time}" (`.until`); buttons "Hold these together", "Find in these", "Cite these together", "Let the set go" (`act.select.label.finder`, `act.findin.label.finder`, `act.cite.label.finder`, `act.selectionrelease.label.finder`).

**States**

| State | When | What shows |
|---|---|---|
| S1. Search in use | matches | C1 to C6. |
| S2. No results | none | C1, C2; "Nothing your team holds matches “{q}”." (`.noresult`) with `.covers` [search finds only what was captured]; link "Capture it" (`.captureit`); fold "When some documents hold only some of the words" (`.partial.head`): "No document holds all of the words “{q}” together." (`.noresult.partial`), "Documents holding at least one of the words: {n}." (`.widen`), "Passages holding at least one of the words: {n}." (`.widen.passages`). |
| S3. Browsing, no words | empty search | C1, C2, "Leave it empty to browse everything." (`find.query.help`); choices "Show" (`find.kind.label`: "Everything" and the kinds), "Only" (`find.state.label`: "Anything", "New since you last looked", "Flagged for a second look", "Watched by you"), "Show as" (`.showas`: "A list", "One table"), "Theme" (`theme.filter`: "Any theme" and each theme); `find.browse.says` [newest first; "new since" counts from your last Home visit]; "Updated just now. This list checks for changes by itself while it is on your screen." (`list.fresh`); rows with checkboxes; a watched row with "Take off my watch list" (`act.watchitem.off.label.finder`); a flagged row with "Clear"; "Your team holds more than is shown here." (`find.browse.more`) and "Show more" (`find.browse.showmore`); fold "Before your first visit to Home" (`find.browse.nosince.summary`); bar with "Hold these together", "Watch" (`act.owed_watchitem.label.finder`), "Flag for a second look…" (`act.owed_secondlook.label.finder`), whose fold holds field "Why look again" (`find.secondlook.note`) and its button. |
| S4. Citing the set | "Cite these together" | heading "Cite these together"; "Cite every document you hold together in one question, in one step." (`.a17.cite_every_document_you_hold_together_in`); the held documents; choice "Cite in which question" (`screen.document.cite.question`); radio "How they bear on the question" (`.cite.legend`): "Support it", "Cut against it"; note from three `.a17.*` sentences [each cited whole; one already cited left as it was; a changed set is shown]; button "Cite these together"; link "Back to Find" (`.cite.back`). After: section "What you did": "Cited" with "newly cited, supporting the question" or "newly cited, cutting against the question"; "Left as it was" with "the question already cited it"; a changed set: "The set changed after you held it, so these are the documents held now." (`.cite.set_changed`), `.cite.added_since`, `.cite.gone_since`. |
| S5. One table | "Show as" "One table" | C1; help `.table.view.help`; "The whole record, one row for each item. Choose a column heading to sort by it." (`.table.intro`); "{n} items · {m} awaiting review" (`.table.count.other`); `list.fresh`; table Item, Kind, State, Updated; "Sorting changes only your view of the table, never the record." (`.table.sorting`). |
| S6. Three routes | a search with its coverage | C1, C2; choice "Look in" ("Everything your team holds" `.scope.everything`, "Cases" `.scope.cases`, the other parts; help `.scope.help`); sections "In titles, notes and details" (`.route.fields`), "In what the documents say" (`.route.passages`), "Subjects named" (`.subjects.heading`), each with its `.holds` count line; "These three are counted apart and never added: a document, a passage and a subject are different things." (`.route.apart`); fold "When a search crosses routes" (`.route.cross.heading`) `.route.cross`; section "What this search covered" (`.covered.heading`) `.covered.levels`, rows "Findings and connections", "Passages read from the documents", "Documents searched", "Where nobody has looked yet" (`.covered.rests`, `.read`, `.docs`, `.looked`) with their counts; button "See where nobody looked". |
| S7. Assistant unreachable | no AI | as S1 to S6; no assistant act. |

**Actions**

| Control | When | Leads to |
|---|---|---|
| A1. "Search" | always | S1, S2 or S6 |
| A2. a result's title | always | `document`, `person`, `question` or the item's screen |
| A3. "Hold these together" (`select`) | picked | C6's bar |
| A4. "Find in these" (`findin`) | set held | `find-in`, the held set |
| A5. "Cite these together" (`cite`) | set held | S4 |
| A6. "Let the set go" (`selectionrelease`) | set held | the bar goes |
| A7. "See where nobody looked" (`frontier`) | always | "Nobody has looked yet at {n} places your team holds." (`.nobody`; `.nobody.one`; `.nobody.none`) |
| A8. "Count" (`calculationcreate`) | results | fields "What you are counting", "From (a day)", "To (a day)" (`.count.*`); `.counted` ["Counted: {result}. …"] |
| A9. "Watch" / "Take off my watch list" (`watchitem`); "Flag for a second look" (`secondlook`); "Clear" (`secondlookclear`) | S3 | the row's mark appears or goes |
| A10. choice "Theme" (`themeread`) | S3 | what was placed, then its hunches apart |
| A11. "Capture it"; "Back to Find" (help `.cite.back.help`) | S2; S4 | `capture`; S1, the set still held |
| A12. "Explore connections" (`explore`) | a result | `explore` |
| A13. "Follow this item into another dimension", "Search the registers" | — | `not built` |

**Form messages.** V1 search with no words where words are needed: "Write what to search for first." (`.wordsfirst`). V2 nothing picked: "Pick at least one result first." (`.pickfirst`). V3 no set held: "Hold a set together first." (`.holdfirst`). V4 "Why look again" empty: the shell's refusal.

---

## capture: "Add to the record"

- **Address** `/app/capture`. **Frame** working; rail Add. **Who** members who may add work.
- **Purpose** Add something to the record: a document from its address, a file, or what you saw yourself, in your own words (`.purpose`).
- **Entry points** rail "Add"; `finder` "Capture it"; a project or question; a wizard step (its act's tab opens).

**Content, every tab**
- C1. Heading "Add to the record" (`.title`); beneath "A document from an address or a file, a photo, or what you saw yourself." (`.sub`).
- C2. From a question: "What you add here is filed under {project}, for the question {question}" (`.forq`).
- C3. Note "A document added here can be filed into a project later." "Add opened from a project files it there directly." (`.filing-later.a`, `.b`).
- C4. Tabs (`.tabs`, "What you are adding"): "From an address", "A file or photo", "What I saw or heard" (`.tab.address`, `.tab.file`, `.tab.saw`).

**Content, "From an address" (S1)**
- C5. Field "Address" (`.address.label`), help `.address.help`; choice "For which question" (`capture.forquestion`), help `capture.forquestion.help`; fold "A question that isn't the project's" (`capture.forquestion.refused.summary`).
- C6. Radio "The page as the site sent it" (chosen), "The page as a visitor saw it" (`.render.keep.site`, `.visitor`); `.render.keep.explain1`, `.explain2` [rendering takes longer, uses a daily allowance]; fold "If the page can't be kept as a visitor saw it" (`.render.refused.summary`) [the render refusals, V9].
- C7. Fold "Keeping a copy from a public web archive" (`.archive.summary`): `.archive.explain1`, `.explain2`.
- C8. Buttons "Capture" (no word row; act `acquire`), "Ask for this later" (`.address.later`).
- C9. "Public registers your team brings in and watches." (`screen.registers.way.add`) link "See public registers" (`screen.registers.way.link`); "Every address your team watches, and when it will next be checked." (`.watching.line`) link "See watched addresses" (no word row).
- C10. Fold "Once it is captured: where it is filed, and watching the address" (`.address.watchhead`): "Captured: {title}" (`capture.captured`); "Filed under {project}, for the question “{question}”" (`capture.filed.question`) link "Cite a passage" (`capture.cite`); choice "How often to look" (`capture.watch.freq`), help `capture.watch.freq_says`: "Every hour", "Every day", "Every week", "Every month", "Before each meeting" (`.address.freq.*`); buttons "Watch this address for changes" (`.address.watchbutton`), "Check it now" (`act.monitor.label.capture`); fold "What checking it now tells you" (`.address.checked.summary`): `.address.checked.modified` (button "Capture the new copy"), `.checked.removed`, `.checked.unchanged`, `.checked.unknown`.
- C11. Unfinished: "Unfinished: your capture of "{title}" waits for {n} of its attachments · started {ago}" (`capture.unfinished`); button "Finish it" (`capture.finish`), help `capture.finish.help`.
- C12. Fold "If the address is already held, or the page reads differently now" (`.a64.if_the_address_is_already_held_or_the_si`): "Already in the record as" {title}, "captured by {name}, {date}", "the site still gives the same document", "nothing was added" (`.a64.*`), link "Open it" (`.openit`); "The page reads differently now" (`.a64.the_site_has_changed_since`) with three `.a64.*` sentences [a clock or feed may cause it; the new copy sits beside the old; citations stay]; button "Capture the new copy"; link "Leave it" (`.leaveit`), help `.leaveit.help`.
- C13. Note `.address.note` [Civicsmith fetches and keeps what the site sent; an archive learns the address; a malware site is kept as high risk].
- C14. Fold "While it is being fetched" (`.address.working.head`): `.address.working` [up to 25 seconds; keep the page open].
- C15. Fold "If it can't be captured, you see one of these, beside the address" (`capture.ifnot`) [the refusals V2 to V7].
- C16. Section "Your requests for later" (`.later.head`), `.later.about`: each address "Waiting to be fetched", "Captured" or "Turned away" (`.later.waiting`, `.later.captured`, `.later.turned`) with its tries; none: "You have not asked for any address to be captured later." (`.later.none`); button "Show my requests for later" (`act.capturerequests.label.capture`).
- C17. Section "Logins for sites" (`.logins.head`), `.logins.about1` to `.about3` [the secret is sealed, never shown]: button "Show the stored logins"; rows "{kind} · {scope} · given by {member}, {date}" (`.logins.row`) with button "Withdraw this login"; fold "When none is stored" (`.logins.none.head`) `.logins.none`; fold "Give a login for a site" (`.logins.give`): field "The site" (help `.logins.site.help`); choice "What the site asks for": "A username and password", "A browser name the site requires", "Something else"; choice "Who may use it" (help `.logins.scope.help`): "Only me", "This project", "The whole team"; fields "Username for this site", "Password or secret for this site" (help `.cred.sealed1`, `.sealed2`); button "Store this login" (`.logins.*`).
- C18. Section "A source that asked for a login" (`.cred.head`): "Turned away: {source} asked for a login" (`.cred.turned`), "Asked for by {name}, {date} · Tries: {count}" (`.cred.askedby`); `.cred.why1`, `.why2`; fields "Username for this source", "Password or secret for this source" (`.cred.user`, `.cred.secret`); buttons "Give a login for this source and try again" (`act.owed_capturecredentialsupply.label.capture`), "Try the request again" (`.cred.retry`); `.cred.only1`, `.only2`; "A login is stored for {source}" (`.cred.stored`) "The secret is not shown." (`.cred.notshown`); button "Show the logins your team has stored" (`.cred.list`).

**Content, "A file or photo" (S2)**
- C19. Drop area "Take a photo, or choose a file" · "on a phone, the camera opens" (`.file.choose`, `.file.choosehelp`); the chosen file with "taken {date}, {time}, by the phone that took it" (`.file.taken`), "location in the photo: {place}" (`.file.location`).
- C20. Radio "How you got it" (`.file.how`): "I made it myself: a photo, a recording, my notes", "I was handed it: a printed agenda, a letter", "Someone sent it to me", "I downloaded it from a website" (`.file.how.*`); `.file.downloaded` with link "Capture it from its address" (`.file.toaddress`).
- C21. Fields "Where and when" (`.file.where`, help `.file.wherehelp`), "What it shows, in your own words" (`.file.what`); choice "For which project" (no word row here).
- C22. Button "Capture this file" (no word row; act `captureupload`); note `.file.note`, `.file.zip`.

**Content, "What I saw or heard" (S3)**
- C23. "Only what you saw or heard yourself. What someone told you belongs in a note or a hunch, not here." (`.saw.note`); "Something you were only told, and want to look into?" (`.lead.line`) link "Write down a lead" (`.lead.link`).
- C24. Fields "In your own words" (`.saw.words`), "Where" (`.saw.where`), "When" (`.saw.when`, help `.saw.whenhelp`); drop area "Add a photo or recording you made then" · "optional; it is kept beside your account" (`.saw.photo`, `.saw.photo.optional`).
- C25. Button "Record what you saw" (`.saw.record`); note `.saw.after` [testimony, always grade D, never discounted].

**States**

| State | When | What shows |
|---|---|---|
| S1. From an address | default, or a step whose act is `acquire`, `capturerequest`, `monitor` | C1 to C18. |
| S2. A file or photo | the tab, or act `captureupload` | C1 to C4, C19 to C22. |
| S3. What I saw | the tab, or act `testify` | C1 to C4, C23 to C25. |
| S4. For a question | opened from a question | C2; "For which question" set to it. |
| S5. Captured | after "Capture" | "Captured: {title}. It waits in Held captures until a member vouches for it." (`.address.done`); an archive `.address.archive`, `.address.notpromoted`; large file `.fetch.pending`, `.fetch.why`, then `.fetch.done`; `.reading.pending`; `.supporting.*`; `.attest.pending`. |
| S6. Already held | same document | "Already in the record as {title}: your team holds exactly this document. Nothing new was saved." (`.address.existed`), link "Open it". |
| S7. Asked for later | "Ask for this later" | "Asked for later: {address}. The request waits until it can be fetched." (`.address.requested`) or `.address.requested.waits`. |
| S8. Watching | "Watch this address for changes" | "Watching {title} for changes, {frequency}. Each new version is kept beside the old." (`.address.watching`). |
| S9. File captured | "Capture this file" | "Captured: {name}. It waits in Held captures until you or another member vouches for it." (`.file.done`); held already: `.file.existed`. |
| S10. Testimony | "Record what you saw" | "Recorded as your testimony: {id}. It waits in Held captures like any capture." (`.saw.done`). |
| S11. Assistant unreachable | no AI | S3 has no "Help me write this" and no draft mark; the rest as S1 to S10. |
| S12. Assistant reachable (`AI`) | an AI account | S3 adds button "Help me write this" (`act.writinghelp.label.capture`); the draft fills the field marked "Draft · the assistant's, asked by {handle}" (`.saw.draft`); `.help.only`. |

**Actions**

| Control | When | Leads to |
|---|---|---|
| A1. the tabs | always | S1, S2, S3 |
| A2. "Capture" (`acquire`) | S1 | S5, S6, or a refusal beside the address |
| A3. "Ask for this later" (`capturerequest`) | S1 | S7 |
| A4. "Watch this address for changes" (`monitorset`); "Check it now" (`monitor`) | captured | S8; one of C10's four lines |
| A5. "Capture the new copy"; link "Leave it" | C10, C12 | a new copy beside the old; nothing changes |
| A6. links "Open it" | C12, C16, S6 | `document` |
| A7. link "Cite a passage" | C10 | `find-in`, the question chosen |
| A8. "Finish it" | C11 | missing attachments fetched |
| A9. links "See public registers", "See watched addresses" | S1 | `registers` (`not built`); `watching` |
| A10. "Show my requests for later" (`capturerequests`) | S1 | C16 listed |
| A11. "Store this login", "Give a login for this source and try again" (`capturecredentialsupply`); "Show the stored logins" (`capturecredentiallist`); "Withdraw this login" (`capturecredentialwithdraw`) | S1 | stored, listed, withdrawn; never the secret |
| A12. "Try the request again" (`capturerequestretry`) | a request its source turned away | back in the queue |
| A13. link "Capture it from its address" | S2 | S1 |
| A14. "Capture this file" (`captureupload`) | S2 | S9 |
| A15. link "Write down a lead" | S3 | `leads` |
| A16. "Record what you saw" (`testify`) | S3 | S10 |
| A17. "Help me write this" (`writinghelp`) | S12 only | `AI`: the draft fills the field |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. "Address" | empty | "This can be captured only once “{field}” is filled in." (`capture.fieldneeded`) |
| V2. "Address" | not fetchable | "That isn't an address Civicsmith can fetch. Check it starts with https:// and has no spaces." (`refusal.BAD_LOCATOR`) |
| V3. "Address" | site refused | `refusal.SOURCE_REFUSED` ["The site refused to give the page to your team's Civicsmith. …"] |
| V4. "Address" | no answer | "The page couldn't be fetched: the site didn't answer in time. Nothing was kept; try again." (`refusal.FETCH_FAILED`) |
| V5. "Address" | over 25 seconds | `refusal.ACQUIRE_TIMED_OUT` ["The site took longer than 25 seconds to answer, …"] |
| V6. "Address" | empty page | "The address answered with nothing to keep: an empty page." (`refusal.EMPTY`) |
| V7. "Address" | too large | `refusal.TOO_LARGE` ["The file at that address is larger than your team's Civicsmith keeps. …"] |
| V8. "For which question" | not the project's | "Say which question this capture is for: choose one of the project's questions. Nothing was captured." (`refusal.BAD_FOR`) |
| V9. "The page as a visitor saw it" | no renderer; allowance used; at capacity; site resting; not a page; render failed | `refusal.RENDER_NO_RENDERER`, `.RENDER_DEFERRED`, `.RENDER_AT_CAPACITY`, `.RENDER_HOST_COOLING_OFF`, `.RENDER_NOT_A_PAGE`, `.RENDER_FAILED`, each saying nothing was fetched or filed |
| V10. watch | from a file | "This document has no address to watch: it came from a file, not from a page." (`refusal.NO_LOCATOR`) |
| V11. watch | not captured yet | "Watching asks for an address already captured: capture it first, then watch it." (`.address.watchafter`) |
| V12. file | none chosen | "Choose a file or take a photo first." (`.file.nofile`) |
| V13. file statement | missing; too long; refused | "Before it is sent, say: {fields}." (`.file.missing`); `.file.toolong`; `.refusal.UPLOAD_NO_STATEMENT` |
| V14. file | empty; too large; not own session | `.refusal.upload.EMPTY`; `.refusal.upload.TOO_LARGE`; `.refusal.MEMBER_SESSION_REQUIRED` |
| V15. testimony | missing | "Before it is recorded, say: {fields}." (`.saw.missing`) |
| V16. "When" | later than now | "Give the day and time you saw or heard it, no later than now." (`.saw.badwhen`) |
| V17. help (S12) | field empty | "Write something first: the assistant helps word only what you told it." (`.help.empty`) |
| V18. a login | from the assistant; for the team's own copy; not turned away | `.cred.ref.machine1` `.machine2`; `.cred.ref.own1` `.own2`; `.cred.ref.notretry` |

---

## held: "Held captures"

- **Address** `/app/held`. **Frame** working; rail Add; breadcrumb "Add › Held captures". **Who** members who may add work.
- **Purpose** Captures waiting for a member to vouch for them before they enter the record (`.purpose`).
- **Entry points** `home` "… in Held captures"; a capture's confirmation.

**Content (S1)**
- C1. Heading "Held captures" (`.name`); beneath "Captured but not yet vouched for. Nothing here is sent to you; it waits." (`.sub`).
- C2. Choice "Whose captures" (`.who`): "Mine", "Everyone's" (`.who.mine`, `.who.all`).
- C3. Rows with checkboxes: a photo thumbnail (help `.tip.photo`); title or "Untitled capture" (`.untitled`); grade; "{days} days old", "1 day old", "Captured today" (`.age`, `.age.one`, `.age.today`); "Project: {project}" or "No project yet"; "From {address}"; "For {asker}'s question: “{title}”" (`.for`).
- C4. Withheld: "Captured for a question you may not see." (`.withheld`).
- C5. An archive: "An archive: {parts}" with "{count} files held beside it", "{count} not filed" (`.archive`, `.archive.filed`, `.archive.notfiled`); link "Open its files" (`.archivefiles`).
- C6. Not eligible for a batch: checkbox disabled; "Not included when you vouch for several at once: {reason}" (`.ineligible`), reason "it is crucial to a finding." or "a contradiction touching it is still open." (`.ineligible.crucial`, `.contested`); `.ineligible.alone` [open it to vouch alone]; link "Open it". Undetermined: `.eligibility.undetermined`.
- C7. "{count} shown here. More are on the next page." (`.more`); buttons "Next page", "Previous page" (`.next`, `.back`).
- C8. Setting aside one a question waits for: "{asker}'s question is waiting for {capture}. Your reason is kept on the record and shown to {asker} on the question." (`.waiting`); field "Why set it aside?" (`.setaside.why`).
- C9. Section "Set aside" (`.setaside`), help `held.setaside.says`: "Set aside by {author}: “{reason}”" (`.asideby`); button "Restore, with a reason" (`held.restore`), help `held.restore_does`; none: "Nothing is set aside." (`.asideempty`).
- C10. Bar of what is picked: buttons "Set aside with a reason", "Restore", "Vouch for them" (`act.heldsetaside.label.held`, `act.heldrestore.label.held`, `act.release.label.held`); the vouch asks "What you vouch for" (`.ack`, help `.ackhelp`) and "What you did to check" (`.mitigation`, help `.mitigationhelp`).

**States**

| State | When | What shows |
|---|---|---|
| S1. Held | some held | C1 to C10. |
| S2. Nothing of yours | "Mine", none | "Nothing of yours is held. Choose Everyone's to see the captures other members are holding." (`.empty.mine`) |
| S3. Nothing held | "Everyone's", none | "Nothing is held: every capture here has been vouched for or set aside." (`.empty`) |
| S4. Vouched | after vouching | "Vouched for: {count}. They are in the record now." (`.released`) |
| S5. Set aside | after setting aside | "Set aside: {count}. They are listed under Set aside, where they can be restored, with a reason." (`.setasidecount`) |
| S6. Restored | after restoring | "Restored: {count}. They wait in Held captures again." (`.restored`) |
| S7. Assistant unreachable | no AI | unchanged. |

**Actions.** A1 "Whose captures" (`heldcaptures`): the list for it. A2 a thumbnail: `open-file` (safe view until checked). A3 "Open its files": `archive`. A4 "Open it": `document`, held. A5 "Vouch for them" (`release`): S4. A6 "Set aside with a reason" (`heldsetaside`): asks the reason; S5. A7 "Restore" (`heldrestore`): S6. A8 "Next page", "Previous page": that page.

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. any act | nothing picked | "Pick the captures first." (`.none`) |
| V2. vouch fields | missing | "Before vouching, say: {fields}." (`.vouchmissing`) |
| V3. vouch fields | over 500 characters, quotes, line breaks | "{field} must be at most 500 characters, with no quotation marks, backslashes or line breaks." (`.vouchbad`) |
| V4. vouch | only parts kept | `.vouch.partsonly` [capture it again whole] |
| V5. vouch | not gathered | "The picked captures could not be gathered to vouch for them together. Nothing was vouched for; try again." (`.selectfailed`) |

---

## archive: the archive's title

- **Address** `/app/archive/<archive>`. **Frame** working; rail Add; breadcrumb "Add › Held captures › Archive". **Who** members who may see the archive; a file filed where the member may not see shows "Filed, in a place you may not see" (`.filedunseen`).
- **Purpose** One captured archive and every file in it, with what happened to each (`.purpose`).
- **Entry points** `held` "Open its files".

**Content**
- C1. Heading: the archive's title; beneath "Captured by {name} from {source}, {date}" (`.capturedby`) and its project.
- C2. Grade with button "Why {letter}?" (`screen.document.gradenote.head`; act "Read the grade note"); "fingerprint {short}" (`.facts`); "{entries} entries" (`.facts.entries`). No note: "No grade note is held for this archive." (`.nonote`).
- C3. "Opened when it was captured: {filed} files filed and held for review beside it, {held} already held, {notfiled} not filed, {folders} folders." (`.summary`); `.gradeabout` [each file carries the archive's grade]; "Anyone can cut the same file out with ordinary tools and get the same fingerprint." (`.samefingerprint`).
- C4. Section "Files in it" (`.files`), column "File" (`.col`); each file with a checkbox and one of: "Filed · held for review beside the archive" (`.filed`); "Already held · the same file {name} captured on {date}; this copy is kept as a second sighting of it" (`.alreadyheld`); "A folder · its {count} files are listed and filed below it" (`.folder`); "A link to {target}: listed, never followed" (`.link`); "{count} entries share this name; each is filed by its number" (`.samename.each`); "Not filed: the archive locks this file with a password. It is listed, never opened." (`.notfiled.password`); "Not filed: {size}, over the {limit} limit for one file. Capture the {kind} from its own address." (`.notfiled.size`); "Waiting to be filed" (`.waiting`). Note `.names` [names are kept exactly, never trusted as a place to write].
- C5. Section "A higher grade for one file" (`.higher.heading`): `.higher.how`; link "Capture a file on its own" (`.higher.capture`).
- C6. Bar: buttons "Show only those not filed" (`.onlynotfiledact`), "Set aside with a reason", "Vouch for them" (`act.heldsetaside.label.archive`, `act.release.label.archive`).

**States**

| State | When | What shows |
|---|---|---|
| S1. Opened | opened on capture | C1 to C6. |
| S2. Could not be opened | refused whole | C1, C2; "Could not open this archive, because {reason}." (`.refused.head`); `.refused.none` [nothing filed; kept as it arrived]; note `.refused.note`; button "See what it lists" (`.see`). |
| S3. Not opened yet | files wait | "Held, but not opened yet: {waiting} files wait to be filed." (`.notopened`) |
| S4. No files | lists none | "This archive lists no files." (`.empty`) |
| S5. Only not filed | after A1 | "Showing only the files not filed." (`.onlynotfiled`) |
| S6. Assistant unreachable | no AI | unchanged. |

**Actions.** A1 "Show only those not filed" / "See what it lists" (`archivelist`): S5 / the list "What it lists" (`.lists`). A2 "Why {letter}?" (`gradenote`): the note opens in place. A3 "Vouch for them" (`release`): vouched; they leave Held captures. A4 "Set aside with a reason" (`heldsetaside`): "Set aside: {count}. They are listed under Set aside in Held captures." (`.setaside`). A5 "Capture a file on its own": `capture`. More than shown: "More files than are shown: {count} shown." (`.more`).

---

## open-file: the file's title

- **Address** `/app/open-file/<file>`. **Frame** working; rail Projects; breadcrumb "Projects › {project} › Opening a file". **Who** members who may see the file.
- **Purpose** Before a file opens: whether it is low or high risk and why, its safe view, its checks, and how a held file is released (`.purpose`).
- **Entry points** `document` "Open the original file"; `held` thumbnail.

**Content**
- C1. Heading: the file's title; beneath how it came, e.g. "Handed in at the doorbell, {date}" (`.handedin`), "Added by you, {date} · {project}" (`.byyou`).
- C2. Risk chip with card: "Low risk" (`.risk.low`, `.risk.low.means`), "High risk" (`.risk.high`, `.risk.high.means`), "Held" (`.risk.held`, `.risk.held.means`); line "Fetched by your team's Civicsmith; nothing in it acts on its own." (`.risk.low.short`) or "Handed in, not fetched by your team's Civicsmith; {why}." (`.risk.high.short`).
- C3. Card "The safe view" (`.safe`): `.safe.about` [each page a picture; nothing can run]; mark "Derived · a safe copy of the original" (`.safe.origin`); "Cite the original, never the safe copy; a citation always points at the original." (`.safe.cite`). Open: "The safe view is open below: each page as a picture, so nothing in it can run." (`.safe.ready`); "{pages} pages, each a picture." (`.safe.pages`); `.safe.truncated`; a sheet "Sheet: {name}", "Cell", "Value".
- C4. Section "Checks" (`.checks`): "{tool}: {result}" (`.note.line`); "Built-in scanner" (`.tool.clamav`); "Not scanned yet", "Clean: nothing found", "Something was found", "Could not be scanned just now" (`.result.*`); none: "No check has been noted on this file yet." (`.checks.none`); "Deeper check: {state}" (`.deeper.state`): "not asked for yet", "asked for, waiting its turn", "running now", "done". `.check.inside`, `.image.unread` where a scan cannot look inside.

**States**

| State | When | What shows |
|---|---|---|
| S1. Low risk | fetched, nothing active | C1, C2; button "Open the original" (`act.openoriginal.label.open-file`); C4; "Checked again every week, and before it is first opened if the last check is older than that." (`.weekly`). |
| S2. High risk | handed in, or active content | C1, C2; buttons "Show the safe view on this page" (`act.safeview.label.open-file`), "Ask for a deeper check" (`.deeper`); C3; section "Ask for a deeper check" with `.deeper.about` and C4; section "Or open it now, without a deeper check" (`.warn`): dialog "Open the original on your own device" (`.warn.title`), `.warn.why`, `.warn.ends`; "Before you open it" (`.warn.confirm`) checkboxes "I will open it on my own device, not a shared one", "I will not enable macros or editing" (`.warn.device`, `.warn.macros`); button "Open the original, accepting this" (`.warn.accept`); link "Cancel" (`shell.cancel`); `.warn.notoffered`. |
| S3. Held after a finding | a scanner found something | C1, C2 "Held"; "The built-in scanner found {finding} on {date}, and so did {tool} in the deeper check." (`.found.by`), card `.tip.threat`; "What was found: {names}" (`.findings`); `.found.resembles`; row "A scan found something in {document}" (`queue.scan-found.summary`) "sent once to the members who can see it" (`.found.sent`); safe-view and deeper-check buttons; `.held.about` or `.held.about.outside` [released by two members' reasons, or a second engine]; "The file read whole" (`.whole`), "Flagged: {what}" (`.flagged`); a reason field (no word row for its label); button "Release, with a reason" (`act.releasescanhold.label.open-file`); "{name} gave a reason on {date}; a second member's releases it. The assistant never can." (`.release.waiting`). No open-with-warning. |
| S4. Added by you | your own upload | C1 "Added by you, {date} · {project}"; "High risk" with "Added by you, not fetched by your team's Civicsmith: every such file is high risk, yours included." (`.high.yours`); "What to do next" (`.next.head`) "Read it in the safe view below. To open the original itself, ask for a deeper check first." (`.next.yours`); safe-view and deeper-check buttons; C3; plain text `.safetext`, `.safetext.cut`; "Checks": "Not checked yet: its first check is waiting. The original never opens before a check." (`.check.notyet`). |
| S5. Opened | after opening | "The original was handed to your browser as a file." (`.opened`); `.digest.checked` [it matched its fingerprint]. |
| S6. Assistant unreachable | no AI | unchanged. |

**Actions.** A1 "Open the original" (`openoriginal`): S5. A2 "Show the safe view on this page" (`safeview`): C3 opens here. A3 "Ask for a deeper check" (`deepercheck`): "Deeper check: asked for, waiting its turn". A4 "Open the original, accepting this" (`openwithwarning`), both boxes ticked: S5. A5 "Cancel": the dialog closes. A6 "Release, with a reason" (`releasescanhold`): first "Your reason is recorded. A second member's reason releases it; the machine never can." (`.release.pending`); second "Released: the original can be opened again." (`.release.done`).

**Form messages.** V1 boxes not both ticked: "Tick both before it opens." (`.warn.both`). V2 not openable: "The original can't be opened now: {why}" (`.closed`). V3 release reason empty: the shell asks for it.

---

## find-in: "Find in this"

- **Address** `/app/find-in/<subject>` (a document, the held set, or a project). **Frame** working; rail Projects; breadcrumb "Projects › {project} › Find in this". **Who** members who may read the subject.
- **Purpose** Look through a document, a held set or a project for people, money, dates, requirements or a word; each result shows its passage (`.purpose`).
- **Entry points** `document` "Find in this"; `finder` "Find in these"; `capture` "Cite a passage".

**Content**
- C1. Heading "Find in this" (`.name`); beneath "Pick what to look for. Every result shows where it was found. Nothing is recorded until you record it." (`.sub`).
- C2. Choice "Look in" (`.lookin`), help `.lookin.help`: "This document: {document}", "The documents you are holding together", "Everything in {project} ({count} documents)" (`.scope.this`, `.scope.held`, `.scope.project`).
- C3. Checkboxes "What to find" (`.what`): "People and offices your team follows", "Money figures", "Dates and deadlines", "Requirements: what someone shall or must do", "Events in minutes and agendas" (`.kind.*`).
- C4. Field "The name or term" (`.term`), help `.term.help`; choice "For which question" (`capture.forquestion`), help `.question.help`, or "None yet" (`.question.none`).
- C5. Buttons "Find" (no word row; act `findin`), "Keep finding this as documents arrive" (`act.standingquestionset.label.find-in`).
- C6. Results in sections "{kind} · {n}" (`.section`) or "“{term}” · {n}" (`.termsection`); each "“{words}”" (`.quote`) with where: "passage {n}" (`.passage`), "{office}, held today by {name}" (`.office.heldby`), "a period, counted from each {item}" (`.date.period`), "the document's own date" (`.date.own`), "a table: its dates are counted through a calculation, never read in one by one" (`.date.table`), "named in {count} of the {total} documents" (`.person.named`), "first in {document}" (`.person.first`); "Held as a standard by {name} on {date}" (`.standard.held`). Empty: "Nothing here." (`.nothing`) with "This document has no money figures." or "Neither document has money figures." (`.money.none.one`, `.all`).
- C7. "A match in a sheet" (`.sheet`) with button "Declare the table".
- C8. Unsearched: `.notread` / `.notread.one` [not read yet or pictures of text]; "Not searched: {documents}" (`.notread.which`).
- C9. Note `.note` [search finds words, figures, dates and followed names; other names only as words].
- C10. Fold "Add a fact from this passage": "What kind of fact" (`.field.kind`), "The fact, as you read it" (`.field.value`), `.fact.office`; "When it is true" (`.valid`), help `.valid.help`; "True from", "True until" (`.valid.from`, `.valid.to`); "How exact the dates are" (`.valid.precision`); "Counted in your team's time zone: {zone}." (`.valid.zone`); fold "When the bounds can't be read" (`.bounds.summary`).
- C11. Fold "Read into a money fact": "What kind of figure" (`screen.money.f.kind`), "Its stage: proposed, adopted, amended or actual" (`.field.phase`), "The amount, in figures" (`.field.amount`), "Currency" (`.field.currency`); "Who paid whom" (`money.flow.step`) `.flow.help`; fold "A required field left empty" (`.empty.summary`).
- C12. Radio "How it bears on the question": "Supports", "Cuts against" (`screen.findin.cite.supports`, `.cite.against`), none chosen; button "Cite in the question" (`act.cite.label.find-in`).

**States**

| State | When | What shows |
|---|---|---|
| S1. A document | from a document | C1 to C12; scope "This document: {document}". |
| S2. The held set | from Find's set | as S1, scope "The documents you are holding together"; sheet matches (C7). |
| S3. A project | from a project | as S1, scope "Everything in {project} ({count} documents)"; long sections end with button "See all {count} in Find" (`.seeall`); after recording, "{kind} for {name}: {value}" (`.recorded.fact`), "Recorded by {who}" (`.recorded`). |
| S4. No subject | opened bare | "Open Find in this from a document, from the documents you are holding together, or from a project." (`.scope.none`) |
| S5. Kept finding | after "Keep finding…" | "Kept: new matches will arrive in your queue as a list." (`.keeping`) |
| S6. Assistant unreachable | no AI | as S1 to S3; no section "Proposed by the assistant". |
| S7. Assistant reachable (`AI`) | an AI account | section "Proposed by the assistant" (`.proposed.head`): "Not in the first release." (`.proposed.notyet`), `.proposed.later`, `.proposed.labeled`; drawn as later, no act. `not built`. |

**Actions**

| Control | When | Leads to |
|---|---|---|
| A1. "Find" (`findin`) | always | results here |
| A2. "Keep finding this as documents arrive" (`standingquestionset`) | a question chosen | S5 |
| A3. "Add a fact from this passage" (`recordpersonfact`) | person or office | recorded; stands on `person` |
| A4. "Record a dated fact" (`recorddatedfact`) | a date | recorded |
| A5. "Hold this as a standard" (`standarddeclare`) | requirement or period | fields "How the requirement is cited", "Who set it", "Why your team holds them to it", "What kind of standard" (`.field.cite`, `.issuer`, `.reason`, `.standardkind`); then `.standard.held` |
| A6. "Read into a money fact" (`recordfact`) | money figure | recorded |
| A7. "Declare the table" (`tabledeclare`) | sheet match | field "The table's columns, in order, separated by commas" (`.field.header`) |
| A8. "Cite in the question" (`cite`) | role chosen | cited |
| A9. "See all {count} in Find" (`search`) | S3 | `finder` |
| A10. a person's or document's name | always | `person`, `document` |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. "What to find" | none ticked | "Tick at least one thing to find." (`.kindsfirst`) |
| V2. "The name or term" | term chosen, empty | "Write the name or term to find." (`.termfirst`) |
| V3. cite | no question | "Choose the question to cite this in first." (`.questionfirst`) |
| V4. cite | no role | "Choose first whether this passage supports the question or cuts against it. Nothing was cited." (`screen.findin.cite.norole`) |
| V5. "True from", "True until" | not a date | `refusal.BAD_VALIDITY` ["Those dates can't be recorded: …"] |
| V6. money fact | required field empty | names the field, e.g. "who received it" (`.field.payee.short`); nothing recorded |

---

## Differences seen in the code

The design above is the authority. Read from the code, not run.

- `home` S2, S3: Home draws no "Welcome, {name}" section; the wizard guide draws "Continue: {name}" (`screen.guide.welcome.continue`) instead (bio-plane/src/screens-wizards/guide.mjs:483).
- `home` A17, `queue` A12: `taskdecide` is registered only once its op is declared, and it is not (bio-plane/src/screens-daily/home.mjs:21-22, :438).
- `dash-action` C1: the code's heading is "The Action dashboard" (`screen.dash-action.name`), not "Action" (bio-plane/src/screens-action/dash-action.mjs:53; the shell draws `screen.<id>.name` when given no label, bio-plane/src/interface-shell/browser.mjs:758-761).
- `capture` C1: the code's heading is "Add" (`screen.capture.name`), not "Add to the record" (bio-plane/src/screens-intake/capture.mjs:627).
- `archive` C1, `open-file` C1: the code's heading is "Archive" or "Opening a file", not the archive's or file's title (bio-plane/src/screens-intake/archive.mjs:22, bio-plane/src/screens-intake/open-file.mjs:26).
- `theme` C4: the code heads both states "Themes"; the design heads one theme with its name (bio-plane/src/screens-investigate/theme.mjs:21).
- `finder` A13: "Follow this item into another dimension" and "Search the registers" are in the key list only, in no screen (bio-plane/src/screens-settings/keys.mjs).
- `find-in` S7: "Proposed by the assistant" is not drawn (no `screen.find-in.proposed.*` in bio-plane/src/screens-daily/find-in.mjs).
- `capture` V1: the word row `screen.capture.address.empty` ("Write the address first: an https address on a public site.") is not drawn; the code uses `capture.fieldneeded` (bio-plane/src/screens-intake/capture.mjs:655).
- `capture` V2 to V7: the table holds two English versions of each fetch refusal, `refusal.<CODE>` and `screen.capture.refusal.<CODE>`; the design draws `refusal.<CODE>`. Which one the code shows was not settled.

## Changes

- 22 Nov 2026: written.
