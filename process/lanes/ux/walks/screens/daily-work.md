Length: 581 lines. Last section: "Changes".

# Screens: Daily work

Page `daily-work` of the Screens document (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

The group "daily work" has fifteen screens. Thirteen are here. `document` and `contradiction` are on the page `reading-a-document`, because all fifteen would pass the page limit.

What every screen shares (frame, rail, strip, dock, refusals, the shell's refusal for an empty required field or reason) is on `every-screen`. All screens here use the working frame: signed out, a visitor sees `front`; a subject the member may not see, or none, shows `unavailable`.

The walk has no AI account: each screen says what shows with the assistant unreachable (absent, not greyed).

Words: exact words in quotes, keyed to `words.json`. A dot key is under `screen.<id>.` (on `queue`, `.empty` is `screen.queue.empty`), or else shares the stem of the key before it in the same brackets. Square brackets summarise a longer text. `{n}` comes from the record. Controls' words are in the Actions tables; Content cites them by number.

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

- **Address** `/app`; `/` when signed in. **Frame** working; rail Home. **Who** every signed-in member.
- **Purpose** The team's nerve center, where each day starts (`.purpose`).
- **Entry points** rail "Home"; signing in; `elsewhere` A2; `queue` A17.

**Content (S1)**
- C1. Heading: the team's name ("Your team", `shell.group.unnamed`, while unnamed); beneath, its description.
- C2. The strip (`every-screen`), e.g. "1 of our own dates passed" (`home.strip.ours_passed.one`).
- C3. Section "Needs you" (`.needsyou`), help `.needsyou.holds`. Rows `.todo.vouch` (also `.todo.vouch.one`, `.todo.vouch.noplace`) ["Vouch for the {count} copies you captured at {place}"], `.todo.newer`, `.todo.approve`, `.todo.check`, a request to join, an invitation, and to administrators `home.update.ready` ["An update to your team's Civicsmith is ready: …"].
- C4. Section "Needs the team" (`.needsgroup`), help `.needsgroup.holds`. Rows "Waiting for a member to look: {held} in Held captures, {inbox} in Inbox." (`.waiting.counts`), `.group.noreply`, `.group.tension` with "nobody has judged it" (`.group.unjudged`), `.group.requestdue`; whose move `.move.member`, `.move.admin`, `.move.anyone`.
- C5. Section "Each area at a glance" (`.areas`), help `.areas.holds` [no reading at zero]. Blocks A10, each "{n} to do" (`.area.need.many`; `.area.need.one`) or "nothing needs you here" (`.area.nothing`); readings `.rd.*`; lines `.area.meetbar`, `.area.edition.*`, `.area.camein`, `.area.ourmove`, `.area.theirmove`, `.area.expertise`, `.area.invitation`; to administrators `.line.places`, `.line.languages`, `.line.ailimit` or `.line.aiused`.
- C6. Section "Projects" (`.projects`): table Project, Stage, Members, Activity, 8 weeks, Last change; "Forming", "Investigating", "Matured", "Closed" (`.stage.*`); `.owner`; `.lastchange` or "No change in the last eight weeks" (`.lastchange.none`); `.truncated` [more projects than shown].
- C7. Section "Since you last looked" (`.since`), help `.since.holds`; rows `.since.captured`, `.since.events`, `.since.trail`.
- C8. Heading "What happened?" (`door.front.head`) over the doors A12 and A13.
- C9. Button A14.

**States**

| State | When | What shows |
|---|---|---|
| S1. Busy team | may start projects | C1 to C9. |
| S2. First visit, may start | first visit after joining | C1, C2; section "Welcome, {name}" (`home.welcome.title`), `.welcome.what` [guided start], A15, link "Not now" (no word row on Home); C4 to C6, C8, C9. No C3, C7. |
| S3. First visit, may not start | lacks the right | C1; S2's welcome; section "Getting into a project" (`.join.heading`): `.join.lead` [not in a project yet]; rows with A7, A8; note `.join.nocreate` ["… Administrators: {admins}. …"]; A13 alone. No C8, C9. |
| S4. May not start, nothing open | nothing to join | C1; "Getting into a project" with `.join.none` ["No project is open to you yet. …"]; A13. |
| S5. Founder, new team | no members, no projects | C1; section "Your team's Civicsmith is ready" (`home.ready.title`), `.nothingyet`; numbered A18, A19 with `.first.invite` [Civicsmith sends no email], A20 with `.first.identity`, "Open your first project: choose below what happened." (`.first.project`); C8, C9. Nothing else. |
| S6. A read failed | one block fails | that block drawn failed, never empty. |
| S7. Assistant unreachable | no AI | as S1; no assistant act. |

**Actions**

| Control | When | Leads to |
|---|---|---|
| A1. a strip chip | items due | `queue` at the item, or its `action` or `request` |
| A2. button "Vouch for them" (`screen.queue.vouch.them`; `release`) | own captures held | row leaves |
| A3. buttons "Adopt the newer version", "Keep the version you cited" (`act.adoptversion.label.home`, `act.keepversion.label.home`) | newer version | reason "Why adopt the newer version" (`.why`); row leaves |
| A4. button "Read and approve it" (`.todo.approve.button`; `filingapprove`) | letter | its approval dialog |
| A5. button "Open the check" (`screen.queue.check.open`) | a check | the screen it concerns |
| A6. buttons "Grant", "Decline" (`.request.grant`, `.request.decline`) | request to join | row leaves |
| A7. button "Join" (`act.projectjoin.label.home`) | invitation | row leaves; you are a member |
| A8. buttons "Ask to join", "Withdraw your request" (`act.projectrequest.label.home`, `act.projectrequestwithdraw.label.home`) | S3, findable | "You asked to join on {date}. Its owners decide." (`projects.request.asked`); withdrawn, back to "Ask to join" |
| A9. link "See what changes" (`queue.update.see`) | update ready | `updates` |
| A10. area names "Investigation", "Action", "Members", "Administration" (`.area.investigation`, `.action`, `.members`, `.administration`) | always | `dash-project`, `dash-action`, `members`, `settings` |
| A11. a project's name | always | `project` |
| A12. door buttons "A problem I live with", "A person", "A payment or contract", "Something I read", "A tip or documents" (`door.front.<door>.name`, `door.front.<door>.hint`; `startfrom`) | S1, S2, S5 | its offer opens in place: suggested wizards, `door.front.matching`, `door.front.blank` ["None of these: start a project from a blank page."] |
| A13. door "Help for my own situation" (`door.front.elsewhere.name`), hint `door.front.elsewhere.hint` | always | `elsewhere` |
| A14. button "Start a project" (`act.promote.label.home`), help `act.promote.here.home` | may start | field "The project's title" (`.title`); then `project` |
| A15. button "Continue the guided welcome" (`.welcome.continue`) | S2, S3 | the wizard "Welcome a new member" |
| A16. "Pass it to another member", "Endorse an administrator", "Add an owner", "Confirm expertise" (`act.<op>.label.home`) | routed to-do | row leaves |
| A17. "Say who issued it, or that you could not tell" (`act.owed_taskdecide.label.home`) | issuer unknown | `not built`; as `queue` A12 |
| A18. button "Name your team" (`home.first.name`) | S5 | `group` |
| A19. button "Invite your first members" (`.invite`) | S5 | `members` |
| A20. button "Say who your team is" (`.saywho`) | S5 | `group-identity` |

**Form messages.** V1 "The project's title" empty: "Give the project a title first." (`.title.needed`). V2 "What happened, in your own words" (`.words`) empty: "Write what happened first." (`.wordsfirst`). V3 any required field: "Fill this in first." (`.fieldfirst`).

---

## projects: "Projects"

- **Address** `/app/projects`. **Frame** working; rail Projects. **Who** every signed-in member, seeing what they may.
- **Purpose** Every project you can see, with its stage and activity (`.purpose`).
- **Entry points** rail "Projects"; `theme` breadcrumb.

**Content (S1)**
- C1. Heading "Projects" (`.name`); beneath `.sub` ["Each project is one problem …"].
- C2. Field "Search projects by name" (`.search.label`); choice "Show only": "All you can see", "Ones you are in", "Ones you own" (`.filter.label`, `.filter.all`, `.in`, `.own`); A1.
- C3. The table as `home` C6; "Questions: not shown to you" (`.questions.unknown`).
- C4. Section "Invited" (`projects.invited.head`): rows "hidden: only the members invited know it exists" (`.invited.hidden`) with A3.
- C5. Section "Findable" (`projects.findable.head`): rows "Findable: only its name shows until its owners let you in." (`projects.findable.meta`) with A4.
- C6. Note `.columns.note` [what the columns mean].
- C7. Section "Themes" (`theme.section`), help `theme.across`; theme names and A5.
- C8. Fold "Start a project": field "What it is about" (`project.start.title`); radio "Who can find it" (`project.visibility.title`): "Hidden: only the members you invite know it exists", "Findable: every member of the team sees it in Projects and can ask to join" (`project.visibility.start.hidden`, `.start.discoverable`), none chosen (`project.visibility.start.later`); A6.
- C9. A7.

**States.** S1 in use: C1 to C9. S2 no projects: heading "Projects", `projects.empty.sub` ["No projects yet. …"], `projects.empty.note`, C8; no table. S3 may not start projects: C1 to C7, C9, note `.nocreate` ["Starting a project is for members your team's administrators allow. Administrators: {admins}. …"]; no C8. S4 assistant unreachable: as S1.

**Actions**

| Control | When | Leads to |
|---|---|---|
| A1. button "Search projects" (`.search.go`) | always | the table narrows |
| A2. a project's name | always | `project` |
| A3. button "Join" | invited | it joins the table |
| A4. button "Ask to join"; then "Withdraw your request" | findable | "You asked to join on {date}. Its owners decide." (`projects.request.asked`) |
| A5. a theme's name; link "Every theme" (`theme.every`) | always | `theme` |
| A6. button "Start the project" (`project.start.go`; `promote`) | may start | the new `project` |
| A7. link "Imported cases" (`screen.imported.list`) | always | `imported` |

**Form messages.** V1 "What it is about" empty: "Give the project a title first." (`.title.needed`). V2 "Who can find it" unchosen: the shell's refusal.

---

## theme: "Themes"

- **Address** `/app/theme`; one theme `/app/theme/<theme>`. **Frame** working; rail Projects; breadcrumb "Projects › Themes". **Who** every signed-in member; only documents they may open are listed.
- **Purpose** The team's themes, never evidence (`.purpose`).
- **Entry points** `projects` A5; `document` theme names; `finder` "Theme".

**Content**
- C1 (S1). Heading "Themes" (`.name`); beneath `theme.never.evidence` ["A theme gathers documents and passages … It is never evidence …"].
- C2 (S1). Section "Every theme, newest first" (`theme.list.heading`): field "Words in a theme's name or test" (`theme.q.label`); each theme's name, "Belongs when: {test}", counts, "declared by {who}, {date}" (`.declaredby`).
- C3 (S1). Fold "Declare a theme" (`theme.declare`): fields "Its name" (`theme.name.label`), "Belongs when" (`theme.test.label`); A3.
- C4 (S2). Heading the theme's name; "Belongs when: {test}"; note `theme.never.evidence`.
- C5 (S2). Section "Placed in it" (`theme.placed`), help `.tip.placed`: each document, who placed it, when, the note; a confirmed hunch reads `.placed.confirmed` ["Placed by {who}, {date}; confirmed a hunch the assistant proposed: …"]; A5.
- C6 (S2). Section "Hunches: not yet placed" (`theme.hunches`): "A hunch is not membership. It counts for nothing until a member places it." (`theme.hunch.note`); A4, A5.
- C7 (S2). Section "Taken out" (`theme.out`), help `.tip.removed`: who, when, why.

**States.** S1 every theme: C1 to C3. S2 one theme: C4 to C7. S3 assistant unreachable: as S1 or S2; earlier hunches stay, no new ones.

**Actions**

| Control | When | Leads to |
|---|---|---|
| A1. field "Words in a theme's name or test" (`themeread`) | S1 | the list narrows |
| A2. a theme's name | S1 | S2 |
| A3. button "Declare the theme" (`theme.declare.go`) | S1 | it heads the list |
| A4. button "It belongs" (`theme.confirm`; `themeplace`) | a hunch | it moves to "Placed in it" |
| A5. buttons "Take it out…" (`theme.takeout`), "Reject…" (`theme.reject`) (`themewithdraw`) | S2 | a reason is asked; it moves to "Taken out" |
| A6. a document's name | S2 | `document` |

**Form messages.** V1 "Its name" or "Belongs when" empty: the shell's refusal.

---

## dash-action: "Action"

- **Address** `/app/dash-action`. **Frame** working; rail Queue. **Who** every signed-in member.
- **Purpose** The Action area as a dashboard (`.purpose`).
- **Entry points** `home` area "Action".

**Content**
- C1. The strip; heading "Action" (no word row on this screen); beneath `.sub` ["Every clock that is running, …"].
- C2. Tiles "Clocks running", "Our move", "Their move", "Replies to read" (`.tile.clocks`, `.ours`, `.theirs`, `.replies`), with `.tile.dueweek`, `.tile.dueday`, `.tile.noreply`, `.tile.came`.
- C3. Section "Needs you" (`home.needsyou.title`), help `.tip.yours`; rows with A1, A2.
- C4. Section "Every action" (`.every.heading`), help `.tip.every` [the clock as a sentence]; columns "Action", "To", "Whose move", "The clock", "Next" (`.col.*`); clocks `.clock.due`, `.clock.sent`, `.clock.approve`; next `.next.record`, `.next.escalate`, `.nextready`.
- C5. A4.

**States.** One: what the team has; a tile or section with nothing is left out. Assistant unreachable: unchanged.

**Actions.** A1 button "Read and approve it": its approval dialog. A2 button "Remind me again on…" (`screen.queue.remind.button`): field "Remind me again on (optional)" (`screen.queue.reminder.on`). A3 an action's name: `action`. A4 button "Start an action" (`act.actioncreate.label.dash-action`): `actionnew`.

---

## dash-project: the project's title

- **Address** `/app/dash-project/<project>`. **Frame** working; rail Projects. **Who** the project's members; others `unavailable`.
- **Purpose** One project as a dashboard (`.purpose`).
- **Entry points** `home` area "Investigation".

**Content**
- C1. The strip; heading the project's title; its subject, owner, stage.
- C2. Section "Next for you here" (`.next.heading`), help `.tip.next`: steps "Vouch for the {count} copies you captured at {place}" (`.next.vouch`; also `.next.vouch.one`, `.next.vouch.noplace`, `.next.vouch.noplace.one`) with A1; "Decide on the newer version of {document}" (`.next.newer`) with A2; "Then Edition {edition} can be prepared: the {count} findings meet the bar" (`.next.prepare`) with A3.
- C3. Section "This project at a glance" (`.glance.heading`): tiles "Documents", "Questions", "Events", "Members" (`.tile.*`); "{n} undetermined in order" (`.tile.events.undetermined`).
- C4. Section "The story so far" (`.story.heading`), help `.tip.story`: a short timeline; `.story.undetermined` ["Undetermined order: {events}, each dated only {precision}."]; A4.
- C5. Section "Activity" (`.activity.heading`): members, eight weeks of bars, `.activity.events`.

**States.** One; an empty step or tile is left out. Assistant unreachable: unchanged.

**Actions.** A1 button "Vouch for them": the step leaves. A2 buttons "Adopt it" (no word row), "Keep the version you cited" (`act.keepversion.label.dash-project`): a reason; the step leaves. A3 link "Prepare Edition {n}" (`.next.prepare.label`): `ceremony`. A4 link "Open the timeline" (no word row): `timeline`.

---

## elsewhere: "Where else to go"

- **Address** `/app/elsewhere`. **Frame** working; rail Home. **Who** every signed-in member.
- **Purpose** Where to go for what is not Civicsmith's work (`.purpose`).
- **Entry points** `home` A13; a door-offered wizard's guide; `places` "See the list".

**Content**
- C1. Heading "Where else to go" (`elsewhere.title`); beneath `elsewhere.says` [legal information, never legal advice].
- C2. "Opening this page records nothing, and nobody in your team is told." (`elsewhere.records_nothing`).
- C3. A section per kind listed, each with help `elsewhere.kind.<kind>_says`: "Legal help you can afford", "The courts' own self-help", "The city's service line", "A state agency for your kind of problem", "Your elected representative's office", "A newsroom that takes tips" (`elsewhere.kind.legalaid`, `.selfhelp`, `.service`, `.agency`, `.representative`, `.tipline`).
- C4. Each place: name, what it does, "phone", "web", "email", "address", "mail", "hours" (`elsewhere.reach.*`), "From {source}, read {date}" (`elsewhere.source`).
- C5. A2.

**States.** S1 places listed: C1 to C5. S2 none listed: C1, C2, section "Nothing listed yet" (`elsewhere.none.head`) with `elsewhere.none.says`, "If you are in danger now, call your local emergency number." (`elsewhere.danger`), C5. S3 no place chosen: C1, C2, `elsewhere.none.noplace` ["Your team follows no place's rules, …"], `elsewhere.danger`, C5. S4 assistant unreachable: unchanged.

**Actions.** A1 a place's web address: opens outside in a new window. A2 link "Back to Home" (`elsewhere.back`): `home`.

---

## queue: "Your queue"

- **Address** `/app/queue`. **Frame** working; rail Queue. **Who** every signed-in member; their own queue.
- **Purpose** Everything waiting on you, in one list (`.purpose`).
- **Entry points** rail "Queue"; strip chips; `home` rows.

**Content (S1)**
- C1. Heading "Your queue" (`.name`); beneath "{n} items" (`.count.many`; "1 item" `.count.one`) · "grouped by case" (`.grouped`) · A17's "sort by time due"; "Sort by" (`.sort`): "time added", "time due", "case", "kind" (`.sort.*`).
- C2. After an act: "Done: {what}. It has left your queue." (`queue.done`).
- C3. "Choose several items to answer at once, or look back at what you answered." (`queue.multi.entry`) with A17's links.
- C4. Note `.note` [the three kinds] "(Shown once.)" (`.note.once`).
- C5. A section per case; no case: "Not in a case" (`.nocase`). Each item shows its kind; "Due today" or "Due {date}" (`.due.today`, `.due.on`); "Needs a reason from you" (`.item.weight`).
- C6. Item texts include `.your_teams_lens_changed_after`, `.routed.auth.item`, `.routed.owner.item`, "Our own date passed {date}" (`due.ours.passed`), `queue.request-unsent.summary`, a hint (`.hint.disclosed`, machine work), `.standing.found`.
- C7. A hint's fold "How was this found?" (`.hint.how`): "What was matched", "How it was found", "How far to trust it", "What it is not" (`.hint.matched`, `.method`, `.trust`, `.not`) with `.hint.rate`, `.hint.shown`, `.hint.not.text` [a lead, never a finding].
- C8. To administrators, section "Your team's Civicsmith" (`queue.update.section`): "An update is ready: release {version}, {date}" (`queue.update.ready`), A11.
- C9. Members' to-dos (A14); the assistant's accounts ("told once to the project's owners" `.ai.toldowners`, "nobody is named" `.ai.nobodynamed`; A15).
- C10. Section "Muted" (`queue.muted.title`), help `queue.muted.help`: "{kind}, in {project}" (`queue.muted.kind`) or "This item only: {item}" (`queue.muted.item`), "muted by you, {date}" (`queue.muted.by`), A16.
- C11. `.more` ["{n} more items are not shown here; act on these first."]; `.vouchband.apart` ["Captures waiting for a vouch: {n}. …"].

**States**

| State | When | What shows |
|---|---|---|
| S1. In use | items wait | C1 to C11. |
| S2. Nothing waiting | empty | "Nothing is waiting on you." (`.empty`); rows "To do: none here.", "Noticed: none here.", "Status: none here." (`queue.none.todo`, `.noticed`, `.status`), each with its second sentence (`queue.none.todo2`, `queue.none.noticed2`, `queue.none.status2`); `.uptodate` ["You are up to date. …"]; A17's "Go to Home", "What you answered". |
| S3. A project invitation waiting | request, invitation, signing key | "1 item · grouped by case"; rows `queue.project-request.detail`, `queue.project-invitation.detail`; section "Your team" with `queue.signer-self-registered.detail`; A13. |
| S4. Choosing several | A17 "Choose several items" | "Choose several items, then act on all of them at once." "Each item says what happened to it." (`queue.multi.head`, `.head2`); a checkbox per item; bar "{n} items chosen" (`queue.multi.chosen`); A18. |
| S5. What happened to them | after A18 | `queue.multi.result` ["You acted on {n} items. Done and out of your queue: {done}. Not handled, still here: {kept}."]; per item "Done" or "Not handled, stays here" (`queue.multi.refused`) with its reason (`queue.multi.why.letter`, `.check`); A17's links. |
| S6. What you answered | A17 "What you answered" | heading "What you answered" (`queue.answered.title`), `queue.answered.head`; section "Snoozed" (`.snoozed.head`): "comes back {date}" (`.snoozed.until`), button "Bring back" (`.bringback`); section "Answered" (`queue.answered.heading`): rows `queue.answered.*` with `queue.answered.byyou`; section "Set aside" (`held.setaside.head`): `queue.aside.dismissed`, `.deferred`, `.v2`, buttons "Bring back", "Dismiss with a reason". |
| S7. All-clear not given | a feed did not answer | "Your queue"; "Not everything answered, so this cannot say nothing is waiting on you." (`queue.allclear.withheld`); `queue.allclear.failed`, `.failed2` or `queue.allclear.failed.feed`; link "Try again" (`queue.tryagain`). Never "Nothing is waiting on you." |
| S8. Assistant unreachable | no AI | as S1; a standing question's row has no "Read by the assistant" (`.standing.read`) mark; no new hint or exploring item arrives. |

**Actions**

| Control | When | Leads to |
|---|---|---|
| A1. "Adopt the newer version", "Keep the version you cited" | newer version | reason "Why adopt the newer version" (`.why`); item leaves |
| A2. link "Settle it" (no word row) | lens changed | `bias` |
| A3. "Vouch for them" (`release`) | a vouch | item leaves |
| A4. link "Open both" (no word row) | tension | `contradiction` |
| A5. "Remind me again on…" (`.remind.button`) | reply due | field "Remind me again on (optional)" (`.reminder.on`) |
| A6. link "Pick up where you left off" (`.unsent.pickup`); "Keep it for later" (`.unsent.keep`); "Drop the request, with a reason" (`.unsent.drop`) | unsent request | `request`; snoozed; dropped |
| A7. "Read and approve it" | letter | its approval dialog |
| A8. "Open the check" (`.check.open`); "Pass it to another member" (`act.taskforward.label.queue`) | a check | its screen; field "Forward to (the member's handle)" (`.forward.to`) |
| A9. "Open a question from this" (`.hint.promote`), "Defer" (`.defer`), "Dismiss with a reason" (`act.proposedispose.label.queue`), "Stop this kind of hint for the project" (`.hint.stop`) | hint | new question, field "The question, in your words" (`.question`); S6; C10 |
| A10. "Snooze to a date" (`act.queuesnooze.label.queue`); "Mute this kind" (`.mute.kind`) | status item | field "Until which day" (`.snooze.until`); C10 |
| A11. link "See what changes" (`queue.update.see`); "Not now" (`act.owed_updatelater.label.queue`) | administrator | `updates`; returns later |
| A12. "Say who issued it" (`.routed.auth.open`) | issuer unknown | `not built`: form "Who issued this document?" with "I know who issued it" / "I could not tell", fields "The issuing party", "How do you know?", "What you tried", button "Record my answer" (`.routed.auth.question`, `.know`, `.cannot`, `.issuer.label`, `.how.label`, `.tried.label`, `.record`) |
| A13. "Grant", "Decline", "Join", "I know about this key" (`queue.signer-self-registered.known`) | S3 | item leaves |
| A14. "Endorse an administrator", "Add an owner", "Confirm expertise", "Agree to remove an owner" (`act.<op>.label.queue`) | routed | item leaves |
| A15. "Add an API key for the project" (`.ai.addkey`); "Explore today" (`.explore.today`) | assistant's accounts | `AI`: field "The project's Anthropic API key" (`.projectkey`); exploring |
| A16. "Turn back on" (`queue.muted.unmute`) | C10 | items reach the queue again |
| A17. links "sort by time due" (`.sort.bydue`), "Choose several items" (`queue.multi.choose`), "What you answered", "Back to your queue" (`queue.multi.back`), "Go to Home" (`.gohome`) | S1 to S6 | sorted; S4; S6; S1; `home` |
| A18. "Mark them done", "Forward them to a member", "Snooze them to a date", "Dismiss them with a reason" (`queue.multi.done`, `.forward`, `.snooze`, `.dismiss`) | S4 | S5 |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. any required | empty | "Fill this in first." (`.fieldfirst`) |
| V2. issuer form | no basis | `.routed.auth.refused.basis` ["You gave no answer to “How do you know?” or “What you tried.” …"] |
| V3. issuer form | "I know", no name | "You said you know who issued it but named no one." (`.routed.auth.refused.issuer1`) `.issuer2` |
| V4. issuer form | moved | "This item now belongs to someone else." (`.routed.auth.refused.yours1`) `.yours2` |
| V5. issuer form | answered | "Someone already answered this. It has left your queue." (`.routed.auth.refused.done`) |

---

## finder: "Find"

- **Address** `/app/finder`. **Frame** working; rail Find. **Who** every signed-in member; results hold what they may read.
- **Purpose** Search or browse what the team holds; hold a set together (`.purpose`).
- **Entry points** rail "Find"; `find-in` A9.

**Content (S1)**
- C1. Heading "Find" (`.name`); beneath `.sub` ["Search everything your team holds, …"].
- C2. Search field "Your words" (`.words`), placeholder "Words to find" (`find.query.placeholder`); A1.
- C3. Results with checkboxes: kind, grade, who captured it, when; passages with the words around the match; subjects with `.named`; "{n} results" (`.total.many`); `.shown` with button "Show more results" (`.showmore`).
- C4. "Nobody looked in {place} for this yet." (`.nobody.in`); A7, A8.
- C5. `.unread` [some documents not read yet].
- C6. Bar "{n} documents held together" (`.held.many`) "until {time}" (`.until`); A3 to A6.

**States**

| State | When | What shows |
|---|---|---|
| S1. Search in use | matches | C1 to C6. |
| S2. No results | none | C1, C2; "Nothing your team holds matches “{q}”." (`.noresult`), `.covers`; A11 "Capture it"; fold "When some documents hold only some of the words" (`.partial.head`): "No document holds all of the words “{q}” together." (`.noresult.partial`), "Documents holding at least one of the words: {n}." (`.widen`). |
| S3. Browsing | no words | C1, C2, "Leave it empty to browse everything." (`find.query.help`); choices "Show" (`find.kind.label`: "Everything", the kinds), "Only" (`find.state.label`: "Anything", "New since you last looked", "Flagged for a second look", "Watched by you"), "Show as" (`.showas`: "A list", "One table"), "Theme" (`theme.filter`: "Any theme", each theme); `find.browse.says`; `list.fresh`; rows with checkboxes and A9's marks; `find.browse.more` with button "Show more" (`find.browse.showmore`); fold "Before your first visit to Home" (`find.browse.nosince.summary`); bar with A3, A9; field "Why look again" (`find.secondlook.note`). |
| S4. Citing the set | A5 | heading "Cite these together"; the held documents; choice "Cite in which question" (`screen.document.cite.question`); radio "How they bear on the question": "Support it", "Cut against it" (`.cite.legend`, `.support`, `.against`); note [`.a17.*`]; button "Cite these together"; A11. After: "Cited" (`.cite.cited`) or "Left as it was" (`.a17.left_as_it_was`) per document; `.cite.set_changed`. |
| S5. One table | "Show as" "One table" | C1; `.table.intro`; "{n} items · {m} awaiting review" (`.table.count.other`); `list.fresh`; table Item, Kind, State, Updated; "Sorting changes only your view of the table, never the record." (`.table.sorting`). |
| S6. Three routes | a search with coverage | C1, C2; choice "Look in" (`screen.find-in.lookin`): "Everything your team holds" (`.scope.everything`), "Cases" (`.scope.cases`), the other parts; sections "In titles, notes and details", "In what the documents say", "Subjects named" (`.route.fields`, `.route.passages`, `.subjects.heading`) with counts; `.route.apart` [counted apart, never added]; fold "When a search crosses routes" (`.route.cross.heading`); section "What this search covered" (`.covered.heading`): "Findings and connections", "Passages read from the documents", "Documents searched", "Where nobody has looked yet" (`.covered.rests`, `.read`, `.docs`, `.looked`); A7. |
| S7. Assistant unreachable | no AI | as S1 to S6. |

**Actions**

| Control | When | Leads to |
|---|---|---|
| A1. button "Search" (`act.search.label.finder`) | always | S1, S2 or S6 |
| A2. a result's title | always | `document`, `person`, `question` or the item's screen |
| A3. "Hold these together" (`act.select.label.finder`) | picked | C6 |
| A4. "Find in these" (`act.findin.label.finder`) | held | `find-in` |
| A5. "Cite these together" (`act.cite.label.finder`) | held | S4 |
| A6. "Let the set go" (`act.selectionrelease.label.finder`) | held | the bar goes |
| A7. "See where nobody looked" (`act.frontier.label.finder`) | always | `.nobody` ["Nobody has looked yet at {n} places your team holds."] |
| A8. "Count" (`act.calculationcreate.label.finder`) | results | fields "What you are counting", "From (a day)", "To (a day)" (`.count.question`, `.count.from`, `.count.to`); `.counted` |
| A9. "Watch" (`act.owed_watchitem.label.finder`), "Take off my watch list" (`act.watchitem.off.label.finder`), "Flag for a second look…" (`act.owed_secondlook.label.finder`), "Clear" (`act.secondlookclear.label.finder`) | S3 | the row's mark appears or goes |
| A10. choice "Theme" (`themeread`) | S3 | placed items, then hunches apart |
| A11. links "Capture it" (`.captureit`), "Back to Find" (`.cite.back`) | S2; S4 | `capture`; S1, set kept |
| A12. "Explore connections" (`act.explore.label.finder`) | a result | `explore` |
| A13. "Follow this item into another dimension", "Search the registers" | — | `not built` |

**Form messages.** V1 no words where needed: "Write what to search for first." (`.wordsfirst`). V2 nothing picked: "Pick at least one result first." (`.pickfirst`). V3 no set: "Hold a set together first." (`.holdfirst`). V4 "Why look again" empty: the shell's refusal.

---

## capture: "Add to the record"

- **Address** `/app/capture`. **Frame** working; rail Add. **Who** members who may add work.
- **Purpose** Add a document, a file, or what you saw (`.purpose`).
- **Entry points** rail "Add"; `finder` A11; a project or question; a wizard step (its act's tab opens).

**Content, every tab**
- C1. Heading "Add to the record" (`.title`); beneath "A document from an address or a file, a photo, or what you saw yourself." (`.sub`).
- C2. From a question: "What you add here is filed under {project}, for the question {question}" (`.forq`).
- C3. Note `.filing-later.a`, `.filing-later.b` [filed into a project later].
- C4. Tabs A1.

**Content, "From an address" (S1)**
- C5. Field "Address" (`.address.label`), help `.address.help`; choice "For which question" (`capture.forquestion`); fold "A question that isn't the project's" (`capture.forquestion.refused.summary`).
- C6. Radio "The page as the site sent it" (chosen), "The page as a visitor saw it" (`.render.keep.site`, `.render.keep.visitor`), `.render.keep.explain1`, `.explain2`; fold "If the page can't be kept as a visitor saw it" (`.render.refused.summary`) [V5].
- C7. Fold "Keeping a copy from a public web archive" (`.archive.summary`).
- C8. A2, A3; lines `screen.registers.way.add` and `.watching.line` with A9.
- C9. Fold "Once it is captured: where it is filed, and watching the address" (`.address.watchhead`): `capture.captured`, `capture.filed.question` with A7; choice "How often to look" (`capture.watch.freq`): "Every hour", "Every day", "Every week", "Every month", "Before each meeting" (`.address.freq.*`); A4; fold "What checking it now tells you" (`.address.checked.summary`) [`.address.checked.*`].
- C10. `capture.unfinished` ["Unfinished: …"]; A8.
- C11. Fold "If the address is already held, or the page reads differently now" (`.a64.if_the_address_is_already_held_or_the_si`): `.a64.already_in_the_record_as` with A6; "The page reads differently now" (`.a64.the_site_has_changed_since`) with A5.
- C12. Note `.address.note`; folds "While it is being fetched" (`.address.working.head`) and "If it can't be captured, you see one of these, beside the address" (`capture.ifnot`).
- C13. Section "Your requests for later" (`.later.head`): "Waiting to be fetched", "Captured", "Turned away" (`.later.waiting`, `.later.captured`, `.later.turned`); none: "You have not asked for any address to be captured later." (`.later.none`); A10.
- C14. Section "Logins for sites" (`.logins.head`): rows `.logins.row`; fold "Give a login for a site" (`.logins.give`): field "The site"; choices "What the site asks for" ("A username and password", "A browser name the site requires", "Something else") and "Who may use it" ("Only me", "This project", "The whole team"); fields "Username for this site", "Password or secret for this site" (all `.logins.*`); A11.
- C15. Section "A source that asked for a login" (`.cred.head`): `.cred.turned`; fields "Username for this source", "Password or secret for this source" (`.cred.user`, `.cred.secret`); `.cred.stored`; A11, A12.

**Content, "A file or photo" (S2)**
- C16. Drop area "Take a photo, or choose a file" (`.file.choose`); the chosen file with `.file.taken`, `.file.location`.
- C17. Radio "How you got it" (`.file.how`), four options `.file.how.made`, `.handed`, `.sent`, `.downloaded` ["I made it myself: …", "I was handed it: …", "Someone sent it to me", "I downloaded it from a website"]; `.file.downloaded` with A13.
- C18. Fields "Where and when" (`.file.where`), "What it shows, in your own words" (`.file.what`); choice "For which project" (no word row here); A14; note `.file.note`.

**Content, "What I saw or heard" (S3)**
- C19. Note `.saw.note` [only what you saw or heard]; `.lead.line` with A15.
- C20. Fields "In your own words" (`.saw.words`), "Where" (`.saw.where`), "When" (`.saw.when`); drop area "Add a photo or recording you made then" (`.saw.photo`); A16; note `.saw.after` [testimony, grade D].

**States**

| State | When | What shows |
|---|---|---|
| S1. From an address | default; act `acquire`, `capturerequest`, `monitor` | C1 to C15. |
| S2. A file or photo | tab; act `captureupload` | C1 to C4, C16 to C18. |
| S3. What I saw | tab; act `testify` | C1 to C4, C19, C20. |
| S4. For a question | opened from one | C2; the question chosen. |
| S5. Captured | after A2 | `.address.done` ["Captured: {title}. It waits in Held captures …"]; archive `.address.archive`; large file `.fetch.pending`, `.fetch.done`. |
| S6. Already held | same document | `.address.existed` ["Already in the record as {title}: … Nothing new was saved."] with A6. |
| S7. Asked for later | after A3 | `.address.requested` ["Asked for later: {address}. …"] or `.address.requested.waits`. |
| S8. Watching | after A4 | `.address.watching` ["Watching {title} for changes, {frequency}. …"] |
| S9. File captured | after A14 | `.file.done` ["Captured: {name}. It waits in Held captures …"]; `.file.existed`. |
| S10. Testimony | after A16 | `.saw.done` ["Recorded as your testimony: {id}. …"] |
| S11. Assistant unreachable | no AI | S3 has no A17 and no draft mark; else as S1 to S10. |
| S12. Assistant reachable (`AI`) | an AI account | S3 adds A17; the draft is marked "Draft · the assistant's, asked by {handle}" (`.saw.draft`). |

**Actions**

| Control | When | Leads to |
|---|---|---|
| A1. tabs "From an address", "A file or photo", "What I saw or heard" (`.tab.address`, `.tab.file`, `.tab.saw`) | always | S1, S2, S3 |
| A2. button "Capture" (no word row; `acquire`) | S1 | S5, S6, or a refusal beside the address |
| A3. button "Ask for this later" (`.address.later`) | S1 | S7 |
| A4. buttons "Watch this address for changes" (`.address.watchbutton`), "Check it now" (`act.monitor.label.capture`) | captured | S8; a C9 result |
| A5. button "Capture the new copy" (`.a64.capture_the_new_copy`); link "Leave it" (`.leaveit`) | C9, C11 | new copy beside the old; nothing changes |
| A6. link "Open it" (`.openit`) | C11, C13, S6 | `document` |
| A7. link "Cite a passage" (`capture.cite`) | C9 | `find-in` |
| A8. button "Finish it" (`capture.finish`) | C10 | attachments fetched |
| A9. links "See public registers" (`screen.registers.way.link`), "See watched addresses" (no word row) | S1 | `registers` (`not built`); `watching` |
| A10. button "Show my requests for later" (`act.capturerequests.label.capture`) | S1 | C13 listed |
| A11. buttons "Store this login" (`.logins.store`), "Give a login for this source and try again", "Show the stored logins", "Withdraw this login" (`act.owed_capturecredential<supply/list/withdraw>.label.capture`), "Show the logins your team has stored" (`.cred.list`) | S1 | stored, listed, withdrawn; no secret shown |
| A12. button "Try the request again" (`.cred.retry`) | turned away by its source | back in the queue |
| A13. link "Capture it from its address" (`.file.toaddress`) | S2 | S1 |
| A14. button "Capture this file" (no word row; `captureupload`) | S2 | S9 |
| A15. link "Write down a lead" (`.lead.link`) | S3 | `leads` |
| A16. button "Record what you saw" (`.saw.record`) | S3 | S10 |
| A17. button "Help me write this" (`act.writinghelp.label.capture`) | S12 only | `AI`: the draft fills the field |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. "Address" | empty | "This can be captured only once “{field}” is filled in." (`capture.fieldneeded`) |
| V2. "Address" | not fetchable | "That isn't an address Civicsmith can fetch. Check it starts with https:// and has no spaces." (`refusal.BAD_LOCATOR`) |
| V3. "Address" | refused; no answer; over 25 seconds; empty; too large | `refusal.SOURCE_REFUSED`; `refusal.FETCH_FAILED`; `refusal.ACQUIRE_TIMED_OUT`; "The address answered with nothing to keep: an empty page." (`refusal.EMPTY`); `refusal.TOO_LARGE` |
| V4. "For which question" | not the project's | `refusal.BAD_FOR` ["Say which question this capture is for: …"] |
| V5. "The page as a visitor saw it" | cannot render | `refusal.RENDER_NO_RENDERER`, `RENDER_DEFERRED`, `RENDER_AT_CAPACITY`, `RENDER_HOST_COOLING_OFF`, `RENDER_NOT_A_PAGE`, `RENDER_FAILED` [nothing fetched or filed] |
| V6. A4 | from a file; not captured | "This document has no address to watch: it came from a file, not from a page." (`refusal.NO_LOCATOR`); `.address.watchafter` |
| V7. file | none; statement missing; too long | "Choose a file or take a photo first." (`.file.nofile`); "Before it is sent, say: {fields}." (`.file.missing`); `.file.toolong` |
| V8. file | empty; too large; not own session | `.refusal.upload.EMPTY`; `.refusal.upload.TOO_LARGE`; `.refusal.MEMBER_SESSION_REQUIRED` |
| V9. testimony | missing; "When" after now | "Before it is recorded, say: {fields}." (`.saw.missing`); "Give the day and time you saw or heard it, no later than now." (`.saw.badwhen`) |
| V10. A17 | field empty | `.help.empty` ["Write something first: …"] |
| V11. a login | from the assistant; own copy; not turned away | `.cred.ref.machine1`; `.cred.ref.own1`; `.cred.ref.notretry` |

---

## held: "Held captures"

- **Address** `/app/held`. **Frame** working; rail Add. **Who** members who may add work.
- **Purpose** Captures waiting for a vouch (`.purpose`).
- **Entry points** `home` "… in Held captures"; a capture's confirmation.

**Content (S1)**
- C1. Heading "Held captures" (`.name`); beneath `.sub` ["Captured but not yet vouched for. …"].
- C2. Choice "Whose captures" (`.who`): "Mine", "Everyone's" (`.who.mine`, `.who.all`).
- C3. Rows with checkboxes: thumbnail (A2); title or "Untitled capture" (`.untitled`); grade; age (`.age*`); `.project` or "No project yet" (`.noproject`); `.for` ["For {asker}'s question: …"].
- C4. "Captured for a question you may not see." (`.withheld`).
- C5. An archive: `.archive`, `.archive.filed`, `.archive.notfiled`; A3.
- C6. Not eligible: checkbox disabled; "Not included when you vouch for several at once: {reason}" (`.ineligible`) with "it is crucial to a finding." or "a contradiction touching it is still open." (`.ineligible.crucial`, `.contested`); `.ineligible.alone`; A4.
- C7. "{count} shown here. More are on the next page." (`.more`); A8.
- C8. Setting aside: `.waiting` [whose question waits]; field "Why set it aside?" (`.setaside.why`).
- C9. Section "Set aside" (`.setaside`): "Set aside by {author}: “{reason}”" (`.asideby`); button "Restore, with a reason" (`held.restore`); none: "Nothing is set aside." (`.asideempty`).
- C10. Bar: A5 to A7; vouch fields "What you vouch for" (`.ack`), "What you did to check" (`.mitigation`).

**States.** S1 held: C1 to C10. S2 "Mine", none: `.empty.mine` ["Nothing of yours is held. …"]. S3 "Everyone's", none: `.empty` ["Nothing is held: …"]. S4 after A5: "Vouched for: {count}. They are in the record now." (`.released`). S5 after A6: `.setasidecount` ["Set aside: {count}. …"]. S6 after A7: "Restored: {count}. They wait in Held captures again." (`.restored`). S7 assistant unreachable: unchanged.

**Actions.** A1 the choice "Whose captures" (`heldcaptures`): its list. A2 thumbnail, "Open the file" (`.thumb`): `open-file`. A3 link "Open its files" (`.archivefiles`): `archive`. A4 link "Open it": `document`, held. A5 button "Vouch for them" (`act.release.label.held`): S4. A6 button "Set aside with a reason" (`act.heldsetaside.label.held`): a reason; S5. A7 button "Restore" (`act.heldrestore.label.held`): S6. A8 buttons "Next page", "Previous page" (`.next`, `.back`).

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. any act | nothing picked | "Pick the captures first." (`.none`) |
| V2. vouch fields | missing | "Before vouching, say: {fields}." (`.vouchmissing`) |
| V3. vouch fields | too long, quotes, line breaks | `.vouchbad` ["{field} must be at most 500 characters, …"] |
| V4. vouch | only parts kept | `.vouch.partsonly` |
| V5. vouch | not gathered | `.selectfailed` ["… Nothing was vouched for; try again."] |

---

## archive: the archive's title

- **Address** `/app/archive/<archive>`. **Frame** working; rail Add. **Who** members who may see it; a file filed out of sight shows "Filed, in a place you may not see" (`.filedunseen`).
- **Purpose** One captured archive and each file's fate (`.purpose`).
- **Entry points** `held` A3.

**Content**
- C1. Heading the archive's title; "Captured by {name} from {source}, {date}" (`.capturedby`).
- C2. Grade with A2; "fingerprint {short}" (`.facts`); "{entries} entries" (`.facts.entries`); "No grade note is held for this archive." (`.nonote`).
- C3. `.summary` ["Opened when it was captured: {filed} files filed …, {notfiled} not filed, …"]; `.gradeabout`; `.samefingerprint`.
- C4. Section "Files in it" (`.files`), column "File" (`.col`); each file one of: "Filed · held for review beside the archive" (`.filed`), `.alreadyheld`, `.folder`, `.link`, `.samename.each`, `.notfiled.password` [locked: listed, never opened], `.notfiled.size` [over the limit for one file], "Waiting to be filed" (`.waiting`). Note `.names`.
- C5. Section "A higher grade for one file" (`.higher.heading`), `.higher.how`; A5.
- C6. Bar: A1, A3, A4.

**States.** S1 opened: C1 to C6. S2 refused: C1, C2, "Could not open this archive, because {reason}." (`.refused.head`), `.refused.none`, `.refused.note`, A1's "See what it lists" (`.see`). S3 waiting: `.notopened`. S4 no files: "This archive lists no files." (`.empty`). S5 after A1: "Showing only the files not filed." (`.onlynotfiled`). S6 assistant unreachable: unchanged.

**Actions.** A1 button "Show only those not filed" (`.onlynotfiledact`; `archivelist`): S5. A2 button "Why {letter}?" (`screen.document.gradenote.head`; `gradenote`): the note opens in place. A3 button "Set aside with a reason" (`act.heldsetaside.label.archive`): "Set aside: {count}. They are listed under Set aside in Held captures." (`.setaside`). A4 button "Vouch for them" (`act.release.label.archive`): they leave Held captures. A5 link "Capture a file on its own" (`.higher.capture`): `capture`.

---

## open-file: the file's title

- **Address** `/app/open-file/<file>`. **Frame** working; rail Projects. **Who** members who may see the file.
- **Purpose** Before a file opens: its risk, safe view, checks and release (`.purpose`).
- **Entry points** `document` "Open the original file"; `held` A2.

**Content**
- C1. Heading the file's title; how it came, e.g. "Handed in at the doorbell, {date}" (`.handedin`), "Added by you, {date} · {project}" (`.byyou`).
- C2. Risk chip "Low risk", "High risk" or "Held" (`.risk.low`, `.high`, `.held`), card `.risk.<level>.means`; line `.risk.low.short` or `.risk.high.short`.
- C3. Card "The safe view" (`.safe`): `.safe.about`; mark "Derived · a safe copy of the original" (`.safe.origin`); `.safe.cite` [cite the original]; open: `.safe.ready`, `.safe.pages`.
- C4. Section "Checks" (`.checks`): `.note.line`, "Built-in scanner" (`.tool.clamav`), `.result.*`, `.checks.none`; "Deeper check: {state}" (`.deeper.state`) with "not asked for yet", "asked for, waiting its turn", "running now", "done" (`.deeper.notasked`, `.queued`, `.running`, `.done`).

**States**

| State | When | What shows |
|---|---|---|
| S1. Low risk | fetched, nothing active | C1, C2, A1, C4; `.weekly` ["Checked again every week, …"]. |
| S2. High risk | handed in, or active content | C1, C2, A2, A3, C3; section "Ask for a deeper check" (`.deeper`) with `.deeper.about` and C4; section "Or open it now, without a deeper check" (`.warn`): dialog "Open the original on your own device" (`.warn.title`), `.warn.why`, `.warn.ends`; "Before you open it" (`.warn.confirm`) with checkboxes "I will open it on my own device, not a shared one", "I will not enable macros or editing" (`.warn.device`, `.macros`); A4, A5. |
| S3. Held | a scanner found something | C1, C2 "Held"; `.found.by`, `.findings`, `.found.resembles`; row `queue.scan-found.summary` with `.found.sent`; A2, A3; `.held.about` or `.held.about.outside` [two members' reasons release it]; "The file read whole" (`.whole`), `.flagged`; a reason field (no word row); A6; `.release.waiting`. No A4. |
| S4. Added by you | your own upload | C1; "High risk" with `.high.yours`; "What to do next" (`.next.head`) with `.next.yours` [read the safe view; a deeper check first]; A2, A3, C3; `.safetext`; "Checks" with `.check.notyet` ["Not checked yet: …"]. |
| S5. Opened | after A1 or A4 | "The original was handed to your browser as a file." (`.opened`); `.digest.checked`. |
| S6. Assistant unreachable | no AI | unchanged. |

**Actions.** A1 button "Open the original" (`act.openoriginal.label.open-file`): S5. A2 button "Show the safe view on this page" (`act.safeview.label.open-file`): C3 opens here. A3 button "Ask for a deeper check" (`.deeper`): "Deeper check: asked for, waiting its turn". A4 button "Open the original, accepting this" (`.warn.accept`), both boxes ticked: S5. A5 link "Cancel" (`shell.cancel`): the dialog closes. A6 button "Release, with a reason" (`act.releasescanhold.label.open-file`): first `.release.pending` [a second member's reason releases it]; second "Released: the original can be opened again." (`.release.done`).

**Form messages.** V1 boxes not both ticked: "Tick both before it opens." (`.warn.both`). V2 not openable: "The original can't be opened now: {why}" (`.closed`). V3 empty release reason: the shell asks for it.

---

## find-in: "Find in this"

- **Address** `/app/find-in/<subject>`. **Frame** working; rail Projects. **Who** members who may read the subject.
- **Purpose** Look through a document, a held set or a project; each result shows its passage (`.purpose`).
- **Entry points** `document` "Find in this"; `finder` A4; `capture` A7.

**Content**
- C1. Heading "Find in this" (`.name`); beneath `.sub` ["Pick what to look for. …"].
- C2. Choice "Look in" (`.lookin`), help `.lookin.help`: "This document: {document}", "The documents you are holding together", "Everything in {project} ({count} documents)" (`.scope.this`, `.scope.held`, `.scope.project`).
- C3. Checkboxes "What to find" (`.what`): "People and offices your team follows", "Money figures", "Dates and deadlines", "Requirements: what someone shall or must do", "Events in minutes and agendas" (`.kind.*`).
- C4. Field "The name or term" (`.term`); choice "For which question" (`capture.forquestion`), or "None yet" (`.question.none`); A1, A2.
- C5. Results in sections `.section` or `.termsection` ["{kind} · {n}"]; each `.quote` with "passage {n}" (`.passage`) and a place line (`.office.heldby`, `.date.period`, `.date.own`, `.date.table`, `.person.named`, `.person.first`); `.standard.held`. Empty: "Nothing here." (`.nothing`) with `.money.none.one` or `.money.none.all`.
- C6. "A match in a sheet" (`.sheet`) with A7.
- C7. `.notread` [documents not searched]; "Not searched: {documents}" (`.notread.which`). Note `.note`.
- C8. Fold for A3: fields "What kind of fact", "The fact, as you read it" (`.field.kind`, `.value`); "When it is true" (`.valid`): "True from", "True until", "How exact the dates are" (`.valid.from`, `.to`, `.precision`); `.valid.zone`.
- C9. Fold for A6: fields "What kind of figure" (`screen.money.f.kind`), "Its stage: proposed, adopted, amended or actual", "The amount, in figures", "Currency" (`.field.phase`, `.amount`, `.currency`); "Who paid whom" (`money.flow.step`).
- C10. Radio "How it bears on the question": "Supports", "Cuts against" (`screen.findin.cite.supports`, `.cite.against`), none chosen; A8.

**States**

| State | When | What shows |
|---|---|---|
| S1. A document | from a document | C1 to C10; "This document: {document}". |
| S2. The held set | from `finder` | as S1; "The documents you are holding together"; sheet matches. |
| S3. A project | from a project | as S1; "Everything in {project} ({count} documents)"; A9; after recording "{kind} for {name}: {value}" (`.recorded.fact`). |
| S4. No subject | opened bare | `.scope.none` ["Open Find in this from a document, …"] |
| S5. Kept finding | after A2 | "Kept: new matches will arrive in your queue as a list." (`.keeping`) |
| S6. Assistant unreachable | no AI | as S1 to S3; no "Proposed by the assistant". |
| S7. Assistant reachable (`AI`) | an AI account | section "Proposed by the assistant" (`.proposed.head`), "Not in the first release." (`.proposed.notyet`); no act. `not built`. |

**Actions**

| Control | When | Leads to |
|---|---|---|
| A1. button "Find" (no word row; `findin`) | always | results here |
| A2. button "Keep finding this as documents arrive" (`act.standingquestionset.label.find-in`) | question chosen | S5 |
| A3. "Add a fact from this passage" (`act.recordpersonfact.label.find-in`) | person or office | recorded on `person` |
| A4. "Record a dated fact" (`act.recorddatedfact.label.find-in`) | a date | recorded |
| A5. "Hold this as a standard" (`act.standarddeclare.label.find-in`) | requirement or period | fields "How the requirement is cited", "Who set it", "Why your team holds them to it" (`.field.cite`, `.issuer`, `.reason`); `.standard.held` |
| A6. "Read into a money fact" (`act.recordfact.label.find-in`) | money figure | recorded |
| A7. "Declare the table" (`act.tabledeclare.label.find-in`) | sheet match | field "The table's columns, in order, separated by commas" (`.field.header`) |
| A8. "Cite in the question" (`act.cite.label.find-in`) | role chosen | cited |
| A9. "See all {count} in Find" (`.seeall`) | S3 | `finder` |
| A10. a name | always | `person`, `document` |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. "What to find" | none ticked | "Tick at least one thing to find." (`.kindsfirst`) |
| V2. "The name or term" | needed, empty | "Write the name or term to find." (`.termfirst`) |
| V3. A8 | no question | "Choose the question to cite this in first." (`.questionfirst`) |
| V4. A8 | no role | `screen.findin.cite.norole` ["Choose first whether this passage supports the question or cuts against it. Nothing was cited."] |
| V5. "True from", "True until" | not a date | `refusal.BAD_VALIDITY` ["Those dates can't be recorded: …"] |
| V6. A6 | field empty | names it, e.g. "who received it" (`.field.payee.short`) |

---

## Differences seen in the code

Read, not run. The design is the authority.

- `home` S2, S3: Home draws no "Welcome, {name}"; the wizard guide draws "Continue: {name}" (`screen.guide.welcome.continue`) (bio-plane/src/screens-wizards/guide.mjs:483).
- `home` A17, `queue` A12: `taskdecide` is drawn only once its op is declared, and it is not (bio-plane/src/screens-daily/home.mjs:21-22, :438).
- `dash-action` C1: heading "The Action dashboard" (`screen.dash-action.name`), not "Action" (bio-plane/src/screens-action/dash-action.mjs:53; bio-plane/src/interface-shell/browser.mjs:758-761).
- `capture` C1: heading "Add" (`screen.capture.name`), not "Add to the record" (bio-plane/src/screens-intake/capture.mjs:627).
- `archive` C1, `open-file` C1: headings "Archive", "Opening a file", not the archive's or file's title (bio-plane/src/screens-intake/archive.mjs:22; bio-plane/src/screens-intake/open-file.mjs:26).
- `theme` C4: one heading, "Themes", in both states (bio-plane/src/screens-investigate/theme.mjs:21).
- `finder` A13: the two acts are in the key list only (bio-plane/src/screens-settings/keys.mjs).
- `find-in` S7: "Proposed by the assistant" is not drawn (no `screen.find-in.proposed.*` in bio-plane/src/screens-daily/find-in.mjs).
- `capture` V1: `screen.capture.address.empty` is not drawn; the code refuses with `capture.fieldneeded` (bio-plane/src/screens-intake/capture.mjs:655).
- `capture` V2, V3: each fetch refusal has two rows, `refusal.<CODE>` and `screen.capture.refusal.<CODE>`, worded differently; the design draws the first; which the code draws was not settled.

## Changes

- 22 Nov 2026: written.
