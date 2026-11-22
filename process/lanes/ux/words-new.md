Length: 105 lines. Last section: "Marks settled by a row the table already holds".

# New words the lane decided

These rows are design (rank 5 on `process/ranking.md`), decided by the UX lane on 22 Nov 2026 for the places the screen pages marked "(no word row)": words a screen draws, or must draw, that the interface word table (`words.json`, built into the product's `setup-words`) does not hold. They are for the module that owns the word table to add; each key is proposed in the table's scheme (`screen.<id>.<part>`, `shell.*` for the frame, `signing.*` beside its neighbour), and that module may place a key otherwise as long as the English stays as written here. The ground says where the words came from: "mockup" (the words `docs/development/ux-substrate/screens/mock-screens.js` or `mock-journeys.js` draws, kept because they keep the voice rules), "code" (the words the built code draws) or "lane" (written by the lane in the voice rules, matching the neighbouring rows; "U3", "U5", "U7", "U9" name the decision on `decisions.md` whose words they take). A `{name}` is filled in by the screen. Every key below was checked absent from `words.json` and from `bio-plane/src/setup-words/rows.mjs` on 22 Nov 2026. Each screen page names the key where the words are shown.

| key | English | screen page and part | ground |
|---|---|---|---|
| `shell.pubfoot.line` | {short name} · signed by an owner of the project · {fingerprint} | every-screen, section 2, the published frame's foot | mockup |
| `shell.pubfoot.credit` | Made with Civicsmith | every-screen, section 2, the published frame's foot | mockup |
| `screen.aiconnect.s4.accepted` | Accepted by {handle} on {date}. | ai / aiconnect C9 | lane |
| `screen.aimine.own.plan` | Which plan | ai / aimine C8 | lane |
| `screen.aimine.now.none` | No AI serves your work yet. Your team's administrators decide which accounts are on; where the team allows it, you can add one of your own. | ai / aimine S3 (C2 empty) | lane |
| `screen.aimine.own.notallowed` | Your team does not let members add their own accounts. Its administrators decide this on the AI providers page. | ai / aimine S4 | lane |
| `screen.aiproject.use.none` | Your team allows no AI yet, so this project has none to choose from. An administrator can connect one on AI providers. | ai / aiproject S3 (C2 empty) | lane |
| `screen.aiproject.order.none` | No AI is in this project's order yet: it lists the AIs this project uses, once there are any. | ai / aiproject S3 (C4 empty) | lane |
| `screen.airesults.none` | No other team has sent results yet. A team's results appear here once it tests an AI and chooses to send them. | ai / airesults, its one state (C3 empty) | lane |
| `screen.home.join.why` | Why you'd like to join (optional) | daily-work / home C10 | lane |
| `screen.home.join.declined` | Its owners declined your request on {date}. | daily-work / home C10 | lane |
| `screen.home.join.declined.word` | Its owners declined your request on {date}: “{word}” | daily-work / home C10 | lane |
| `screen.home.welcome.notnow` | Not now | daily-work / home S2 | mockup |
| `screen.dash-action.title` | Action | daily-work / dash-action C1 | mockup |
| `screen.dash-project.story.timeline` | Open the timeline | daily-work / dash-project A4 | mockup |
| `screen.queue.lens.settle` | Settle it | daily-work / queue A2 | mockup |
| `screen.queue.tension.open` | Open both | daily-work / queue A4 | mockup |
| `screen.capture.file.project` | For which project | daily-work / capture C18 | mockup |
| `screen.capture.watching.link` | See watched addresses | daily-work / capture A9 | mockup |
| `screen.held.from.doorbell` | Handed in through the doorbell | daily-work / held C11 | lane (U5) |
| `screen.open-file.release.why` | Why release it? | daily-work / open-file S3 | mockup |
| `screen.action.clock.metlate` | met late | deciding-and-acting / action C11 | mockup (journeys) |
| `screen.install.stopped.again` | Start again | getting-started / install A11 | mockup |
| `screen.leads.share.already2` | Nothing changed. | outside-the-team / leads V10 | mockup |
| `screen.watching.list.none` | Your team watches no address yet. Capture a document from its address under Add, then choose how often to look. | outside-the-team / watching S4 | lane |
| `screen.doorbell.consent.audience.team` | The whole team | outside-the-team / doorbell C8 (Differences) | mockup |
| `screen.doorbell.consent.audience.public` | Anyone | outside-the-team / doorbell C8 (Differences) | mockup |
| `screen.doorbell.consent.secret` | Your secret phrase | outside-the-team / doorbell C8 (Differences) | mockup |
| `screen.doorbell.consent.answer` | Your answer | outside-the-team / doorbell C8 (Differences) | mockup |
| `screen.doorbell.happens.court.link` | What that means | outside-the-team / doorbell C3 (Differences) | mockup |
| `screen.project.objective.open` | Open the objective | projects-and-questions / project C6 | mockup |
| `screen.project.suggested.head` | Suggested questions | projects-and-questions / project C15 | mockup |
| `screen.project.suggested.open` | Open this question | projects-and-questions / project C15 | mockup |
| `screen.project.about.label` | Who is this question about? | projects-and-questions / project C16 | lane (U3) |
| `screen.question.about.line` | About: {name} | projects-and-questions / question C15 | lane (U3) |
| `screen.question.about.change` | Change who it is about | projects-and-questions / question C15 | lane (U3) |
| `screen.question.about.why` | Why you change it | projects-and-questions / question C15 | lane (U3) |
| `screen.question.about.none` | This question does not name anyone it is about. | projects-and-questions / question C15 | lane (U3) |
| `screen.question.about.name` | Name who it is about | projects-and-questions / question C15 | lane (U3) |
| `screen.question.leggrade.copy` | Your team's grade for the copy | projects-and-questions / question C16 | lane (U9) |
| `screen.question.expertise.sent` | The request reached {count} members who declared this expertise. | projects-and-questions / question C17 | lane |
| `screen.question.expertise.sent.one` | The request reached 1 member who declared this expertise. | projects-and-questions / question C17 | lane |
| `screen.question.expertise.none` | Nobody was asked: no member who can see this question has declared this expertise. | projects-and-questions / question C17 | lane |
| `screen.answers.often` | How often | projects-and-questions / answers C9 | lane |
| `screen.answers.until` | Until when | projects-and-questions / answers C9 | lane |
| `signing.ceremony.keepkey.gone` | A key you do not keep on this device is gone when the browser closes. | publishing / ceremony C13 | lane (U7) |
| `screen.published.changed` | What changed in this edition: “{what}” | publishing / published C13 | lane |
| `screen.published.order` | Court order of {date}: {order} | publishing / published C13 | lane |
| `screen.published.lane.world` | What they did | publishing / published C14 | lane (the timeline's lane words) |
| `screen.published.lane.ours` | What we did | publishing / published C14 | lane (the timeline's lane words) |
| `screen.imported.watching` | Watching {address} for changes to this case. | publishing / imported C9 | lane |
| `screen.imported.sigfailed` | When this case was imported, its signature did not check against what {team} published. | publishing / imported C10 | lane |
| `screen.docket.order.label` | What the court orders | publishing / docket C8 | lane |
| `screen.docket.order.remove` | Remove | publishing / docket C8 | mockup (journeys) |
| `screen.docket.order.redact` | Redact | publishing / docket C8 | mockup (journeys) |
| `screen.docket.order.seal` | Seal | publishing / docket C8 | mockup (journeys) |
| `screen.docket.order.unseal` | Unseal | publishing / docket C8 | mockup (journeys) |
| `screen.document.stands` | Where it stands | reading-a-document / document C2 | mockup |
| `screen.document.copy.ceiling` | How well it could be captured | reading-a-document / document C31 | lane (U9) |
| `screen.document.copy.grade` | Your team's grade for the copy | reading-a-document / document C31 | lane (U9) |
| `screen.document.from.doorbell` | Handed in through the doorbell | reading-a-document / document C32 | lane (U5) |
| `screen.members.removed.line` | Administrator's powers removed on {date}. | team-and-account / members C12 | lane |
| `screen.members.removed.agreed` | {member} agreed: “{reason}” | team-and-account / members C12 | lane |
| `screen.members.ties.head` | Their ties | team-and-account / members C13 | lane |
| `screen.people.addother.submit` | Follow it | the-record / people S7 (and Differences) | mockup |
| `screen.person.claim.fold` | Say another record is this person… | the-record / person C6 | mockup |
| `screen.person.follow.registers` | Registers followed | the-record / person C8 | lane |
| `screen.person.follow.registers.row` | {address} · followed {date} | the-record / person C8 | lane |
| `screen.person.offices.head` | Offices in it | the-record / person S2 | mockup |
| `screen.timeline.rel.line` | Linked to {event}: {relation} | the-record / timeline C9 | lane |
| `screen.money.fiscal.unknown` | No fiscal-year view for {government}: the record does not hold its fiscal year yet. A member can state it, with how they checked. | the-record / money C11 | lane (U4) |
| `screen.calculation.expertise.confirmed` | confirmed: {label} | the-record / calculation C6 | lane (the words of `members`) |
| `screen.calculation.expertise.declared` | declared, not confirmed: {label} | the-record / calculation C6 | lane (the words of `members`) |
| `screen.explore.project` | For which project | the-record / explore C12 | lane (the words of `capture`) |

74 rows: 28 from the mockup, 46 the lane's own, none from the code alone (every place where the code draws words had a row already; see below).

## Marks settled by a row the table already holds

Fourteen marks named a control for which the table already holds a row, and the built code draws it. There the existing row stands and no new row is asked for; where the mockup drew other words, the page says they are not kept. Each page now names the row.

| existing key | English | screen page and part | mockup's words, not kept |
|---|---|---|---|
| `act.adoptversion.label.dash-project` | Adopt the newer version | daily-work / dash-project A2 | Adopt it |
| `act.acquire.label.capture` | Capture from an address | daily-work / capture A2 | Capture |
| `act.captureupload.label.capture` | Capture a file or photo | daily-work / capture A14 | Capture this file |
| `act.findin.label.find-in` | Find in this | daily-work / find-in A1 | Find |
| `installer.need.time` | About twenty minutes, at a computer. | getting-started / install S3 | (the same, without the comma) |
| `installer.remove.refused.typed` | Nothing was deleted: the short name typed doesn't match. … | getting-started / install V2 | (none) |
| `screen.follow.label`, `screen.follow.*` | Follow from here, and its acts | outside-the-team / registers A8 | (the same) |
| `act.leadread.label.leads` | Open a lead | outside-the-team / leads A2 (Differences) | Open it |
| `screen.calculation.name`, `screen.proceeding.name`, `screen.standard.name`, `screen.published.name` | Calculation, Proceeding, Standard, Published case | projects-and-questions / project C11 | (none) |
| `act.hypothesisrevise.label.question` | Revise a hunch | projects-and-questions / question A7 | Revise this hunch |
| `progression.steps` | Its steps | the-record / timeline S3 | Steps |
| `act.reconcile.label.money` | Compare two sources | the-record / money C7 | Compare the two |
| `screen.money.tension` | Each column is read from the figure's own source, … | the-record / money C8 | (the same) |
| `connection.kind.pos.name` | Position or membership | the-record / explore C2 | Positions and memberships |
