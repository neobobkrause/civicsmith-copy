Length: 607 lines. Last section: "Changes".

# Screens: The team and your account

Page `team-and-account` of the Screens document (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

The team, its members and settings; a member's own account, ties, notes and codes. What binds every screen is on the page "Every screen". Every screen here is in the working frame (rail place Settings) and needs a session. "admin" in a table means an administrator.

How to read this page:
- In a screen's section, a key written `.x` means `screen.<id>.x`. A button's words are its `act.<op>.label.<id>` row unless another key is named. An action leads to the same screen unless a screen id is named.
- The heading of every screen is its `screen.<id>.name` word; its `.purpose` word is the heading's explanation.
- Words are quoted exactly; a quote's key is the screen's own `screen.<id>.*` row unless a key or family is named. A link to another screen shows its `screen.<id>.name`; a wizard is named by its `wizard.<id>.name`. A longer explanation is named by its key and length.
- **The walk has no AI account.** The assistant dock is absent, not greyed, and every control marked `AI` is not drawn.

## The screens on this page

| id | heading | address | built? |
|---|---|---|---|
| `group-identity` | "Who your team is" | `/app/group-identity` | built |
| `members` | "Members" | `/app/members`; a member `/app/members/<handle>` | built |
| `security` | "Security" | `/app/security` | built, in part |
| `account` | "Your account" | `/app/account` | built |
| `connect` | "The assistant" | `/app/connect` | built; superseded by page `ai` |
| `teamai` | "The team's assistant" | `/app/teamai` | built; superseded by page `ai` |
| `bias` | "Declared bias" | `/app/bias`; a work `/app/bias/<run>` | built |
| `places` | "Places and offices" | `/app/places` | built |
| `recovery` | "Recovery codes" | `/app/recovery` | built |
| `group` | "Your team" | `/app/group` | built |
| `settings` | "Settings" | `/app/settings` | built |
| `updates` | "Updates" | `/app/updates` | built |
| `ties` | "Your ties" | `/app/ties` | built |
| `notes` | "Your notes" | `/app/notes` | built |
| `translations` | "Translations" | `/app/translations`; a language `/app/translations/<tag>` | built |
| `wizards` | "Wizards" | `/app/wizards` | built |

## group-identity: "Who your team is"

- **Who can see it** every member reads; only an administrator sees "Change it".
- **Purpose** What kind of team this is, its focus and purpose, and who sees them. **Entry points** `settings`.

- C1. Above the heading, one note: `.seed.recorded` "Your team's short name was recorded when Civicsmith was installed." or `.seed.unrecorded` (gap, 2 sentences: not recorded; run the installer again). No field or act for the short name.
- C2. Heading "Who your team is"; line "About {name}."
- C3. Once said: section "Who your team is": "What kind of team:" and the kinds; "What you focus on" and its text; "Why the team exists, in your own words" and its text; "Only members see this." or "Members and the public see this."
- C4. Administrator: section "Change it": checkboxes "What kind of team": "a professional group", "an issue group", "a community group", "a team for many things", "something else"; field "Describe your kind of team, in a few words"; fields "What you focus on", "Why the team exists, in your own words"; radios "Who sees all of this": "Members only", "Also our public page and the network directory"; button A1.
- C5. `AI` Assistant reachable: `.ask.intro` (1 sentence), fields "What does your team do?", "Who is in it, and who does it work for?", "Why did it start?" (`.ask.q.what`, `.who`, `.why`), button A2. A field it filled is labelled "Draft · the assistant's, asked by {handle}".

| State | When | What shows |
|---|---|---|
| S1 Short name recorded | installer recorded it | C1 `.seed.recorded`. |
| S2 Older installation | no short name | C1 `.seed.unrecorded`. |
| S3 Not said yet | nothing saved | No C3; a member sees only C1, C2. |
| S4 Assistant unreachable (the walk) | no AI account | No C5. |

| Action | When | Leads to |
|---|---|---|
| A1. button "Save who your team is, and who sees it" | admin | C3 shows what was saved; draft labels go. |
| A2. `AI` button "Ask the assistant to help write it" | administrator, assistant reachable | Focus and purpose fields filled and labelled; nothing saved. |

| Form message | Condition | Message |
|---|---|---|
| V1. whole form | no kind and every field empty, on A1 | `shell.field.needed`, naming "What you focus on" |
| V2. the three questions | all empty, on A2 | "Answer at least one question first. Nothing was sent." (`.ask.none`) |

## members: "Members"

- **Address** `/app/members`; `/app/members/<handle>` opens that member's row panel.
- **Who can see it** every member reads the roster; the rest is an administrator's.
- **Purpose** Everyone in the team and what each may do. **Entry points** `settings`; any member's name; `security` › "What you can do".

- C1. Under the heading: "Active members: {members} · Administrators: {administrators}".
- C2. Roster, founder first; columns "Handle", "Cover", "Role", "May do", "Status", "Expertise". Roles, capabilities, statuses and expertise in their words: `.role.*`, `.cap.*` (an administrator "all of it, as every administrator may"), `.status.*`, `.expertise.*` (none: "No expertise declared."). A founder without a handle: "The team's founder" (`member.founder.unnamed`); not joined: "Not joined yet".
- C3. Member's view: under the table, "Administrators add members and change what each may do."
- C4. Administrator, while the step is not met: "With one administrator, the team depends on that one person and the hosting account." (`.recovery.one`; or `.recovery.many`), then `.recovery.codes` or `.recovery.nocodes`; links "Add a second administrator", "Get your recovery codes" (without codes).
- C5. Administrator, a row's panel: the invitation's state (`.invitation.*`); checkboxes "What {handle} may do"; `.status.to.revoked` or `.status.to.active`; `.endorse.what` for a proposed administrator; field "Why remove their administrator's powers? (every administrator will see this)"; fold "When confirming or withdrawing an expertise is refused" with three refusals (`.expertise.refused.*`).
- C6. Section "Invite a member": fields "A short id for this invitation", "The cover the team knows them by, not a legal name"; checkboxes "What they may do"; button A1; note `.invite.noemail` (3 sentences). Ticking "look after the team's Civicsmith" draws "Propose {who} as an administrator?", `.cap.administer.confirm` (5 sentences), choices "Propose {who} as an administrator" / "Go back".
- C7. Shown once: after A1 `.invite.shown` and the link; after A2 `.reset.shown`, `.reset.noemail` and the link.
- C8. Section "Joining through your website": `.website.what` (2 sentences); fields "How many may join each day", "Days until it expires (1 to 30; seven if left empty)"; buttons A13, A14; then `.website.keyshown` or `.website.linkshown` and the key or link.
- C9. Section "More for administrators": links "Places and offices", "Security".
- C10. Section "Signing keys": 3 sentences (`.a.signing.key.lets.a` …); per member "key registered by {member}, {date}" with A3, "key withdrawn by {member}, {date}" · "it does not sign" with A4, or "no signing key yet"; 2 sentences (`.key.react.withdraw.a.key.when.a` …); choice "Whose key"; field "Their public key"; button A5; 2 sentences (`.the.record.shows.that.you` …).
- C11. Section "What removing an administrator takes": with one administrator "With {n} administrator, no administrator can be removed by vote." + 2 sentences; "Nothing here changes anything."; folds "If more administrators can act than the roster lists" (3 sentences) and "How it changes with the number of administrators" (a table for 1 to 7 administrators, `.scale.*`, the team's row "(now)"; 3 sentences).

| State | When | What shows |
|---|---|---|
| S1 As an administrator sees it | session administers | C1, C2, C4 (one administrator), C5 to C11. |
| S2 As a member sees it | session does not administer | C1; table of member, "May do", "Expertise"; C3. No act. |
| S3 A removal under way | votes outstanding | "Removing {member} as an administrator"; "{n} administrators: {members}."; section "What it takes": `.this.takes.3.of.4`, `.teo.is.counted.but.doesn`; a row per administrator (`.removal.agreed`, `.removal.notyet` + `.the.removal.waits.for.ana`, `.removal.faces` + `.counted.in.the.4.doesn`); "{n} of {total} have agreed so far." |
| S4 Nobody else yet | only the viewer | "Nobody is in the team yet but you." |

| Action | When | Leads to |
|---|---|---|
| A1. button "Create the invitation link" (`.invite.create`, `memberadd`) | admin | C7; an "invited" row (beyond the second administrator, a proposal awaiting endorsement). |
| A2. button "Make a reset link for a member" (`act.owed_passwordresetlink.label.members`) | row panel | C7's reset link. |
| A3. button "Withdraw {handle}'s signing key" | another's held key | The row reads withdrawn. |
| A4. button "Reactivate {member}'s signing key" | a current member's withdrawn key | The row reads registered. |
| A5. button "Register a key for this member" | admin | "key registered by {member}, {date}". |
| A6. button "Change what a member may do" | row panel | "May do" changes. |
| A7. button "Change a member's status" | row panel | Status "inactive" or "active". |
| A8. button "Endorse an administrator" | proposed administrator | Status changes once every administrator endorses. |
| A9. button "Remove an administrator"; in S3 "Agree: remove {member} as an administrator" | admin, with a reason | S3, counting the vote. |
| A10. button "Confirm declared expertise" | declared expertise | "confirmed: {label}". |
| A11. button "Withdraw an expertise" (`act.owed_expertisewithdraw.label.members`) | confirmed expertise | "No expertise declared." |
| A12. button "Withdraw an unused invitation" | unused invitation | "invitation withdrawn". |
| A13. button "Create a website key" | admin | The key, shown once. |
| A14. button "Turn on the reusable join link" | admin | The link, shown once. |
| A15. links in C9; "Get your recovery codes" | admin | `places`, `security`; `recovery`. |
| A16. a member's name | always | `/app/members/<handle>`, its panel open. |

| Form message | Condition | Message |
|---|---|---|
| V1. short id, cover | either empty, A1 | "Give both a short id and the cover the team knows them by. Nothing was sent." (`.invite.incomplete`) |
| V2. "How many may join each day" | not a whole number ≥ 1, A13/A14 | "Say how many may join each day: a whole number, one or more. Nothing was sent." (`.website.nocap`) |
| V3. removal reason | empty or over 2,000 characters, A9 | "Say why, in your own words, in at most 2,000 characters. Nothing was sent." (`.remove.noreason`) |

## security: "Security"

- **Who can see it** administrators; any other member sees S3.
- **Purpose** How hard the team's Civicsmith is being tried, against its usual; counts only. **Entry points** `settings`; `members` › "More for administrators"; a security notice in the `queue`.

- C1. Under the heading: line `.sub` "How hard your team's Civicsmith is being tried, against its usual. Only administrators see this."
- C2. Fields "From", "To" (`.from`, `.to`); button A1; fold "Dates in the wrong order" holding V1.
- C3. Section "How hard your team's Civicsmith was tried": mark "Ordinary." / "Raised." / "High.", explained by `.risk.means.ordinary`; `.period`; `.total`.
- C4. `.files.on` (3 sentences).
- C5. Fold "The counts, by kind, hour and place": "By kind and by hour", a 24-hour grid by kind, each square named in words (`.tip.hour_*`, `.heat.*`); "Totals for the period", table "Kind", "This period", "Usually" (`.kind.*`, `.totals.note`); by country (`.where.*`).
- C6. Section "When you are told": a notice row (`.notice.signin`, `.notice.sent`); `.told.note`.
- C7. Section "What is installed": "File scanner", "Safe view"; `.queue`; button A2.
- C8. Section "Your security tools": `.tools.about`; table "Tool", "State", "Added", "What it does", states `.state.*`; or `.tools.none`. Section "What happened to them": events (`.event.*`) or "Nothing yet."
- C9. Fold "Add another checker (advanced)": "Tools you can add" or `.catalogue.none`; each tool's panel: what it is sent, keeps and shares (`.h.*`), its fields, checkbox "I understand the vendor keeps the files it is sent" where it keeps files, checkbox "Check every file, not only those a member asks about" for an on-premises tool, buttons A3 to A5. Notes `.adding.private`, `.notoffered`, `.logsink`.
- C10. Section "What you can do": `.cando` (3 sentences), "Your account" and "Members" as links.

| State | When | What shows |
|---|---|---|
| S1 A week with a hard try | raised or high in the period | Mark "Raised." or "High."; "Someone tried hard to sign in on {when}. Every attempt was refused."; `.summary.detail` (3 sentences). |
| S2 An ordinary week | near the usual | Mark "Ordinary."; "Nothing unusual. There is nothing for you to do."; `.ordinary.line`. |
| S3 A member's view | not an administrator | Heading and "Security is set by your team's administrators. Administrators: {admins}. Ask one of them about anything here." only. |
| S4 No signatures | the scanner holds none | C7 says so, with `.nosignatures.next`. |

| Action | When | Leads to |
|---|---|---|
| A1. button "Show the level for a period" | admin | C3, C5 for that period. |
| A2. button "Check for new signatures now" | admin | "The scanner has been asked to check for new signatures. The result shows here once it has finished." |
| A3. button "Add a security tool" | a catalogue panel | The tool "added, not tested"; an event. |
| A4. button "Test a security tool" | an added tool | "The tool passed its test and is on." or "The tool stays off: {detail}". |
| A5. button "Remove a security tool" | a tool held | The row goes; "{tool} removed". |
| A6. links "Your account", "Members" | admin | `account`, `members`. |

| Form message | Condition | Message |
|---|---|---|
| V1. "From", "To" | end before start, A1 | "Choose a start and an end date, the start first. Nothing was read." (`.period.bad`) |
| V2. a tool's field | empty, A3 | "Fill in {field} first. Nothing was sent." (`.config.missing`) |

## account: "Your account"

- **Who can see it** every member, own account only.
- **Purpose** The member's own settings, and signing out. **Entry points** `settings`; `security` › "What you can do".

- C1. Heading "Your account".
- C2. Section "Your handle": the handle; "Your handle can't be changed: it names your work for good, and no one else can ever take it." (`handle.fixed`). No act changes it.
- C3. Section "Language and appearance": `.language.now` or `.language.device`; choices "Your language"; "Appearance": "Follow my device", "Light", "Dark" (`shell.appearance*`); "Explanations"; "Sounds": "Off", "On".
- C4. Section "Your cover name": `.pairing.says`, `.pairing.choose`; radios "Who can see which cover goes with your handle": `.pairing.private`, `.pairing.public`; button A3; `.pairing.change`, `.pairing.undone`.
- C5. Section "What you know": `.expertise.none`, `.expertise.declared` or `.expertise.confirmed`; field "Your expertise (optional)"; button A4.
- C6. Section "Signing out": buttons A5, A6; note `.signout.note`.
- C7. Section "Your password": fields "Your current password", "A new password", "Type it again"; button A7.
- C8. Section "Your signing key": `.key.held`; for a key an administrator registered, `.registered.for.you.by.rosa` and `.only.you.can.sign.with`; or `.key.none`; button A9 on a held key.
- C9. No key: section "Make your signing key": `.key.help` (3 sentences); checkbox `signing.ceremony.keepkey`; field "A passphrase for the key file (optional)"; button A8.
- C10. Section "Elsewhere in your settings": links "The assistant", "Your ties", "Your notes", "Glossary".

| State | When | What shows |
|---|---|---|
| S1 As usual | always | C1 to C10. |
| S2 A newer version is live | a newer release is served | The update band; "Reloading brings in the newest version. It changes only the program in your browser, never your team's record." |
| S3 Making your signing key | after A8 | Section "Your key is made": `.key.held`, the public line, `.key.save`, buttons "Save the key file", "Copy the public line", `.key.lost`. |
| S4 No key made | the browser made none | "No key was made, so nothing was registered." |

| Action | When | Leads to |
|---|---|---|
| A1. button "Choose your language" | always | The screen in that language. |
| A2. "Explanations" (`infolevelset`, "Choose how much is explained") | always | Explanations open after the chosen pause. |
| A3. button "Save my choice" | always | The choice kept after a reload. |
| A4. button "Declare your expertise" | always | "Declared: {label}". |
| A5. button "Sign out on this device" | always | `front`, signed out. |
| A6. button "Sign out everywhere" | always | `front`, signed out; every other session ends. |
| A7. button "Change your password" | always | "Your password is changed. Every other session signed in as you has ended." |
| A8. button "Register your signing key" | no key | S3. |
| A9. button "Revoke your signing key" | a key held | "You have no signing key registered."; C9. |
| A10. links in C10 | always | `connect`, `ties`, `notes`, `glossary`. |

| Form message | Condition | Message |
|---|---|---|
| V1. new password twice | not the same, A7 | "The two new passwords are not the same. Type them again. Nothing was sent." (`.password.differ`) |
| V2. expertise | empty, A4 | "Say what you know first. Nothing was sent." (`.expertise.nolabel`) |

## connect: "The assistant"

- **Who can see it** every member, own account.
- **Superseded.** The earlier "connect your Claude account" screen. In the first beta the page `ai` takes its place for AI providers: `aimine` ("Your AI") and `aiconnect` (DEC-420). Described here as built.
- **Purpose** Whether and how the assistant serves the member, their limit and use. **Entry points** `settings`; `account` › "Elsewhere in your settings".

- C1. Under the heading: "Optional. Everything in your team's Civicsmith works without the assistant."
- C2. One card saying what serves the member (each state's first line), then parts that open and close, each a heading and a line.
- C3. Foot, every state but S6: fold "Which account pays, and when" holding `ai.whopays` (3 sentences).

| State | When | What shows |
|---|---|---|
| S1 The team's key serves you | team key on, no own account | "The assistant serves you on the team's API key." + `.group.allowance`; meter "Today on the team's key, your share of it"; `.project.serves` where a project pays. Parts: "Before your first question" (mark "Outward · leaves your team's Civicsmith", `.notice.group`, button "I have read this"); "Your daily allowance" (`.grouplimits`, `.group.allowance.reached`, `.grouplimits.suggestions`); "Your use"; "Connect your own account (optional)" holding S5's form. |
| S2 Your own API key | member holds a key | `.own.apikey`, mark "Connected"; "Connected since {date}." Parts: "What the assistant may do for you" (switch groups "Everyday help", "Without being asked"); "A limit, if you want one" (`.part.limit.why.apikey`; the limit form, "Per" "day"/"month", fold "More choices"); "Your use" (table "Last 30 days", meter "Today on your own account", `.use.note`); "Disconnect" (`.own.thengroup`, button "Disconnect your API key"). |
| S3 Your Claude subscription | subscription connected | `.own.subscription`, mark "Connected"; `.own.until`, `.own.until.again`. Parts as S2 (`.part.limit.why.subscription`; tokens or calls only; "On your subscription"; button "Disconnect your subscription"). `not built`: button "Check the connection" and fold "If the check stops". |
| S4 Sign-in expired | Anthropic stopped accepting it | "Your Claude sign-in has expired, on {date}.", mark "Expired", `.expired.means`, `.expired.next`, button "Open Anthropic's sign-in page". |
| S5 Members bring their own | no team key, no own account | `.none` "The assistant isn't serving you yet. …" (2 sentences). Part "Before you connect": outward mark, `.disclosure.own`, `.disclosure.then`, button "I have read this". Radios "How do you want to connect the assistant?": "My Claude subscription (Pro or Max)", "My own Claude API key", "Not now". Subscription: four steps (`.signin.step1`–`4`), button "Open Anthropic's sign-in page", field "The code from Anthropic's page", button "Connect with this code", fold "If you signed in a while ago, it asks for your password first". API key: field "Your API key", button "Connect with this key". Not now: `.skip`. |
| S6 Material kept away from AI | an administrator turned it on | `.keptaway` with the quoted reason, then `.keptaway.ask`. No part, no act. Unreadable: `.keptaway.unread`. |
| S7 Sign-in state unreadable | that read failed | `.signin.statefailed`; never drawn as not connected. |
| S8 No AI account (the walk) | no team key, no own account | S5. The subscription way only while the sign-in part is installed. |

| Action | When | Leads to |
|---|---|---|
| A1. button "I have read this" (`.read.button`; `groupkeynoticeseen`, or `disclosureshown` before connecting) | S1, S5, until read | The part shows read; before connecting, the ways to connect show. |
| A3. button "Open Anthropic's sign-in page" | S4, S5 subscription | Anthropic's page in a new tab; this screen stays. |
| A4. button "Connect with this code" | S5 subscription | S3. |
| A5. button "Go on" | a password asked again | Does the act asked for, once. |
| A6. button "Connect with this key" | S5 API key | S2. |
| A7. use switches (`accountusesset`) | S2, S3 | The switch shows on or off. |
| A8. limit button (`ailimitset`) | S2, S3 | The limit listed. |
| A9. button "Disconnect your API key" | S2 | S1 or S5. |
| A10. button "Disconnect your subscription" | S3 | S1 or S5. |

| Form message | Condition | Message |
|---|---|---|
| V1. the code | empty, A4 | "Paste the code from Anthropic's page first. Nothing was sent." (`.signin.nocode`) |
| V2. the API key | empty, A6 | "Paste your API key first. Nothing was sent." (`.apikey.nokey`) |
| V3. the code | refused by the plane | the row `.refused.<CODE>` for the code answered (12 rows, `RUNNER_NOT_CONFIGURED` to `AI_KEPT_AWAY`), with the shell's reference |

## teamai: "The team's assistant"

- **Who can see it** administrators; any other member sees the heading and `.purpose` only.
- **Superseded.** In the first beta "AI providers" (`aiproviders`, page `ai`) takes its place (DEC-420). Described here as built.
- **Purpose** The team's API key, its uses, limits and use, and keeping material away from AI. **Entry points** `settings`.

- C1. Under the heading: "The team's API key serves members who have no account of their own."
- C2. Card: "The team's API key is held and on.", mark "On", `.setby`; meter "This month on the team's key"; held and off: `screen.members.key.heldoff`.
- C3. Part "What this account pays for" · "Everyday help is {everyday}; exploring is {explore}.": each use on/off with its switch; exploring's choice.
- C4. Part "Limits on this account" · `.limits.why` or "None set.": a table of limits, one form.
- C5. Part "This month's use" · "Summed over members; nobody is named."
- C6. Part "Keeping our material away from AI" · `screen.members.keepaway.off` or `.keepaway.on`; `act.aikeepaway.does`; "Keep our material away from AI": "For every use" / "Only for these uses", "The uses"; field "Why (every member will see this)"; buttons "Save", "Turn it off".
- C7. Part "The key itself" · "Replace it, switch it off or remove it.": field "The team's Anthropic API key"; buttons A1, A2, A5.
- C8. Part "Changes" · "Every change, with who made it and when."
- C9. Fold "Which account pays, and when" holding `ai.whopays`.
- Words here not in `screen.teamai.*` are `screen.members.key.*`, `screen.members.keepaway.*`, `screen.panel.*` and `screen.connect.whopays.summary` rows.

| State | When | What shows |
|---|---|---|
| S1 Key held and on | the design's usual | C1 to C9. |
| S2 No key held (the walk) | no team key | Card "No key is held. Members bring their own account, or use your team's Civicsmith without the assistant." (`screen.members.key.none`); C7 offers the field and "Hold the team's API key" only. |
| S3 A member's view | not an administrator | Heading and `.purpose` only. |
| S4 Keep-away unreadable | that read failed | "Whether the team keeps its material away from AI couldn't be read just now." (`screen.members.keepaway.unread`). |

| Action | When | Leads to |
|---|---|---|
| A1. button "Hold the team's API key"; with a key, "Replace the key" (`screen.members.key.replace`) | admin | C2 reads held; the key never drawn again. |
| A2. button "Switch it on" / "Switch it off" (`groupkeyswitch`) | a key held | C2's mark changes. |
| A3. use switches (`accountusesset`, "Set what the team's key pays for") | a key held | The use reads on or off. |
| A4. limit button (`ailimitset`, "Set a limit on the team's key") | a key held | The limit listed; a change in C8. |
| A5. button "Remove the team's key" | a key held | S2. |
| A6. button "Save" | admin, with a reason | C6 reads "On. …"; `connect` shows its S6 to every member. |

| Form message | Condition | Message |
|---|---|---|
| V1. the key | empty, A1 | "Paste the key first. Nothing was sent." (`screen.members.key.nokey`) |
| V2. the reason | empty or over 2,000 characters, A6 | "Give your reason, in 1 to 2,000 characters. Nothing was sent." (`screen.members.keepaway.noreason`) |
| V3. "The uses" | "Only for these uses", none ticked | "Choose at least one use, or keep it for every use. Nothing was sent." (`screen.members.keepaway.nouses`) |
| V4. the limit form | value refused | `ai.refused.limitinvalid`, `ai.refused.unitunavailable`, `ai.refused.switchvalue` |

## bias: "Declared bias"

- **Address** `/app/bias`; a work made under an earlier lens `/app/bias/<run>`.
- **Who can see it** every member; adopting is an administrator's (team) or an owner's (project).
- **Purpose** The lens the team reads evidence through; it never blocks work. **Entry points** `settings`; the `queue` (S4).

- C1. Under the heading: `.the_lens_your_team_reads` + "It never blocks work."
- C2. Choice "Whose lens": "The whole team" or a project; button A1.
- C3. Section "In force for {project}" or "In force for the whole team": each statement (`.kind.*`, `.row.*`); "Adopted" (`screen.standard.state.adopted`) with `.by_admin_for_the_team*`; "What this set does not enforce" and its text; "Lens", its number, `.the_same_lens_gives_the`.
- C4. Folds "When a project statement meets a locked one", "When an adopted set is only offered" (2 sentences each); note `.to_adopt_write_or_draft`, `.your_queue_tells_you_when`.

| State | When | What shows |
|---|---|---|
| S1 The lens in force (a project) | project chosen, lens adopted | C1 to C4: the team's statements, then the project's. |
| S2 Writing and adopting a set | writing | "Write a set", 2 sentences; field "Name of the set"; radios "Kind of statement" (`.scrutiny_how_closely_we_read`, `.inference_what_we_do_not`, `.pattern_how_a_source_has`); fields "Who or what it is about", "The statement", "Why you read it this way", "What it cites", "What this set does not enforce"; button A2; fold "When a set cannot be saved". "Adopt it": radios "Adopt it for" (`.the_whole_team_an_administrator`, `.one_project_the_coliseum_lease`); field "Why you adopt it"; button A3; 3 sentences; fold "When you cannot adopt it". `AI` A7. |
| S3 Drafted from an outside policy | pasting a policy | "Draft a set from an outside policy", 3 sentences; fields "The policy, in its own words", "Where it comes from", "When you read it"; button A4. Then "Proposed statements", each `.proposed_not_yet_yours`; `.it_read_sentences_of`; button "Start a set from these"; "Left out": "A bar" / "A verdict", each with why; `.nothing_was_saved_offered_or`. |
| S4 Work made under an earlier lens | `/app/bias/<run>` | "Work made under an earlier lens", 3 sentences; "Waiting for your word": the work, `.earlier.made`, button A5; field "Your reason" (`shell.reason`); button A6; 3 sentences (`.this_cannot_be_undone_your` …); fold "When it cannot be settled"; "Settled": `.earlier.settled`. |
| S5 No lens in force | nothing adopted | "No lens is in force for {project}." "A case published now says that your team declared none."; links "Write a set", "Draft one from an outside policy". |
| S6 The whole team's lens | "The whole team" chosen | C3 headed "In force for the whole team". |
| S7 No AI account (the walk) | assistant unreachable | No "Help me write this". |

| Action | When | Leads to |
|---|---|---|
| A1. button "Show the lens in force" | always | S1, S5 or S6. |
| A2. button "Save the set and offer it for adoption"; "Start a set from these" (`promote`) | S2; S3 | The set listed as offered. |
| A3. button "Adopt this set" | an offered set; administrator (team) or owner (project) | S1 or S6 with it in force. |
| A4. button "Propose statements from it" | S3 | Proposals and "Left out"; nothing saved. |
| A5. button "Show its record" | S4 | The work's record. |
| A6. button "Settle it, with your reason" | S4 | The work under "Settled". |
| A7. `AI` button "Help me write this" | assistant reachable | A labelled draft in the field. |
| A8. links in S5 | S5 | S2, S3. |

| Form message | Condition | Message |
|---|---|---|
| V1. a statement | a verdict or a bar, A2 | `.a_statement_in_it_says` + `.reword_that_statement_to_say` |
| V2. a statement | no reason, or a pattern citing nothing | "A statement has no reason, or a pattern statement cites nothing." + "Add what it asks for and offer the set again." |
| V3. "Adopt it for" | the team, not an administrator, A3 | "Only an administrator adopts a set for the whole team." + "Ask one, or adopt it for a project you own." |
| V4. "Adopt it for" | a project, not an owner | "Only an owner of a project adopts a set for it." + "Ask one of its owners: {owners}." |
| V5. the set | not offered, A3 | "The set must be offered for adoption first." + "Save it and offer it, then adopt it." |
| V6. "Your reason" | empty, A6 | "You gave no reason." + "Write why the change does not bear on this work, then settle it." |
| V7. the work | settled or not visible, A6 | "Someone settled it already, or you cannot open the work it is about." + "Open your queue to see what is left." |

## places: "Places and offices"

- **Who can see it** every member reads; any other member sees "Administrators choose these; you can read them here." (S3).
- **Purpose** The places whose rules apply, and the offices and courts the team deals with. **Entry points** `settings`; `members` › "More for administrators".

- C1. Under the heading: `.sub`.
- C2. Section "The places whose rules apply": "The places, read in this order"; warning `.profiles.warning`; button A1. None chosen: `.profiles.none`. Disagreeing: `.profiles.conflicts`.
- C3. Section "A place not listed yet": "You named {name} on {date}." or "No place is named."; `.wanted.match`; field "A place you want that isn't listed (optional)"; button A2.
- C4. Section "Where else to go" (`places.elsewhere.*`): `.says` (2 sentences); link "See the list"; none listed: `places.elsewhere.none`.
- C5. Section "Offices and seats": each office, "from your places' rules" or "added by your team"; one a member named carries its mark and A5; "This office is confirmed."; note `.offices.note`; or "No offices are held yet."; button A3; "Change the offices": fields "The office's name", "Who or what this office is"; button A4.
- C6. Section "Courts": each court, "from your place's rules" or "added by {name} on {date}".
- C7. Section "Your team's own rules" (`screen.grouprules.name`): `.rules.note`; link "Your team's own rules".

| State | When | What shows |
|---|---|---|
| S1 A state with a profile | a held place chosen | C1 to C7. |
| S2 A state with no profile | a place named, none held | "No profile for {state} yet": `.noprofile.says`, `.noprofile.offers`, `.noprofile.still`, `.noprofile.asks`; field "Tell us the place you want"; button A2; C7. No C4 to C6. |
| S3 A member's view | not an administrator | `.admins`; sections read-only. |
| S4 Offices partly read | a later page failed | "The rest of the offices couldn't be read just now." |

| Action | When | Leads to |
|---|---|---|
| A1. button "Choose the places whose rules apply" | admin | C2 lists the places. |
| A2. button "Save the place you want" | admin | "You named {name} on {date}." |
| A3. button "Fill in the offices again" | admin | "Filled in: {seeded} new, {already} already held, {unseeded} that couldn't be." |
| A4. button "Add an office yourself" | admin | The office "added by your team"; a court: "Added the court: {name}." |
| A5. button "Confirm this office" | an office a member named | "This office is confirmed." |
| A6. links "See the list"; "Your team's own rules" | as drawn | `elsewhere`; `grouprules`. |

| Form message | Condition | Message |
|---|---|---|
| V1. office name and what it is | either empty, A4 | "Give both the office's name and what it is. Nothing was sent." (`.add.incomplete`) |

## recovery: "Recovery codes"

- **Who can see it** every member, own codes.
- **Purpose** The member's own one-time recovery codes. **Entry points** `settings`; `members` › "Get your recovery codes".

- C1. Under the heading: `.sub` (3 sentences).
- C2. Section "Your codes": "You hold recovery codes: {remaining} of {total} unused, issued {date}.", or "Every code issued on {date} is used.", or "You hold no recovery codes yet."; `.onlyyou` (3 sentences).
- C3. Section "New codes": `.spends` (2 sentences); button A1.
- C4. Section "If you lose your codes too": `.lost.what` (2 sentences).

| State | When | What shows |
|---|---|---|
| S1 Codes held | codes held | C1 to C4. |
| S2 New codes just issued | after A1 | `.shown` (3 sentences, from "Save these now: they are shown only this once.") and ten codes; not shown again after leaving. |
| S3 None | none issued, or all used | C2 reads `.none` or `.spent`. |

| Action | When | Leads to |
|---|---|---|
| A1. button "Get new recovery codes" | always | S2. |

## group: "Your team"

- **Who can see it** every member reads; any other member sees `.admins` "These are your team's settings. …" and the values, with no field or act.
- **Purpose** The settings chosen at setup, changeable here. **Entry points** `settings`.

- C1. Under the heading: "Administrators only. The settings chosen at setup, all changeable here."
- C2. Section "Name and logo": "Your team is called {name}." or `.name.none`; field "The team's name"; button A1; fold "Saving the same name"; `.logo.set` or `.logo.none`; field "A new logo"; button A2.
- C3. Section "Website": `.domain.verified`, `.domain.unverified` or `.domain.none`; the last verdict (`.domain.verdict.*`), `.domain.checked`; field "Your team's web address"; button A3.
- C4. Section "Languages": `.languages.now` or `.languages.none`; checkboxes "The languages"; button A4.
- C5. Section "Time zone": `.timezone.governs.profile` or `.governs.local`; a zone choice; fields "How you checked it", "Where you checked it" (both required); button A5; folds "When two places give different zones", "When your team's time zone isn't set".
- C6. Section "The court notice": `.court.says`; `.court.tell` or `.court.dont`; checkbox "Show members the notice, before their first note and in their settings"; button A6.
- C7. Section "The hosting account": `.hosting.says`; `.hosting.now*` and the holder, or `.hosting.none`; fields "Who holds it", "A note (optional)"; button A7.
- C8. Section "A copy of your team's record": `.export.says`; field "Why you are taking it (optional)"; button A8; `.export.undone` + `.export.undone.why`; fold "When taking a copy is refused" (`.export.refused.founder`, `.refused.next`); button A9; the copies, newest first; `.export.log.cap`.
- C9. Section "What the team has at stake": field "The team's statement" (`stake.group.*`); button A10; `AI` A12 under it.
- C10. Section "The team's bar": `.bar.now` or `.bar.none`; choices "Capture", "Connection", each with "No bar"; field "Why (every member will see this)"; button A11.

States: one view; each section shows its value or its none line as listed. A member's view is described under Who can see it. With no AI account (the walk) "Help me write this" is absent.

| Action | When | Leads to |
|---|---|---|
| A1. button "Save the name" | admin | "Saved. Your team is now called {name}."; same name: "That's already your team's name, so nothing changed." |
| A2. button "Change the logo" | admin | `.logo.set`; the logo in the frame. |
| A3. button "Verify the website" | admin | C3's line and verdict. |
| A4. button "Save the languages" | admin | `.languages.now`. |
| A5. button "Correct the time zone" | admin | "Your team's time zone is now {zone}." |
| A6. button "Show the court notice" | admin | C6's line changes. |
| A7. button "Record who holds the hosting account" | admin | `.hosting.now` and the holder. |
| A8. button "Take a copy of the record" | the founder | A row added to the copies. |
| A9. button "Show the list of copies" | admin | The list. |
| A10. button "Save the statement" | admin | The statement, with who and when. |
| A11. button "Set the team's bar" | admin, with a reason | C10's line. |
| A12. `AI` button "Help me write this" | assistant reachable | A labelled draft in the statement. |

| Form message | Condition | Message |
|---|---|---|
| V1. name | empty, A1 | "Give the name first. Nothing was sent." (`.name.empty`) |
| V2. logo | none / not PNG or JPEG / over 200 KB, A2 | "Choose the image first. Nothing was sent." / "That isn't a PNG or JPEG image. Nothing was sent." / "That image is larger than 200 KB. Nothing was sent." (`.logo.nofile`, `.logo.type`, `.logo.size`) |
| V3. web address | empty, A3 | "Give the web address first. Nothing was sent." (`.domain.empty`) |
| V4. languages | 0 or over 20, A4 | "Tick from 1 to 20 languages. Nothing was sent." (`.languages.count`) |
| V5. "Who holds it" | empty, A7 | "Say who holds it first. Nothing was sent." (`.hosting.empty`) |
| V6. bar grades | neither, A11 | "Choose a grade for capture, connection or both. Nothing was sent." (`.bar.nograde`) |
| V7. bar reason | empty or over 2,000, A11 | "Say why, in 1 to 2,000 characters. Nothing was sent." (`.bar.noreason`) |

## settings: "Settings"

- **Who can see it** every member; "How full your team's record is" and "The team's" only to an administrator.
- **Purpose** Every setting in one list: the member's own, then the team's. **Entry points** the rail (on a phone, More) › Settings; Home's area block Administration.

- C1. Under the heading: "Your own settings first; then the team's, which only administrators change."
- C2. Section "Yours": links "Your account", "The assistant", "Your ties", "Your notes", "Recovery codes", each with its screen's purpose beneath.
- C3. Administrator: section "How full your team's record is": "{used} of {limit} ({pct}%)" and `.storage.what`; from 70% `.storage.warn70`; fold "When it passes 90%, or its size isn't known" holding `.storage.warn90`, `.storage.unknown`; note `.storage.factors`.
- C4. Administrator: section "The team's": links "Your team", "Who your team is", "Members", "The team's assistant", "Places and offices", "Security", "Updates", "Translations", "Wizards", each with its purpose.
- C5. Section "For every member": link "Declared bias" with its purpose.

| State | When | What shows |
|---|---|---|
| S1 An administrator's | administers | C1 to C5. |
| S2 A member's | does not | C1, C2, C5. |

| Action | When | Leads to |
|---|---|---|
| A1. each link | as its section | `account`, `connect`, `ties`, `notes`, `recovery`; `group`, `group-identity`, `members`, `teamai`, `places`, `security`, `updates`, `translations`, `wizards`; `bias`. |

## updates: "Updates"

- **Who can see it** administrators (listed in `settings` only to them); any other member sees S4.
- **Purpose** The release running, the release ready, and the choice to update. **Entry points** `settings`; a release item in an administrator's `queue`.

- C1. Under the heading: `updates.says` (2 sentences). Words without a `screen.updates` row are `updates.*` rows.
- C2. Section "Running now": `updates.running.release` (or `_setup`, `_noactor`); `updates.running.checked` · `updates.running.checked_note`.
- C3. Section "How your copy is doing": button A5, then the check lines (`.health.store`, `.health.file.test`, `.health.captures.off`), `.health.check.note`, fold "When the check finds a problem"; button A6, then a row per part (`.health.part.*`) with its release and state (`.health.part.state.*`, `.health.part.silent`), fold "Other things a part can show"; button A7, then `.health.runtime.heaviest`, `.average`, `.samples`, `.runtime.note`.
- C4. Section "Earlier releases": `updates.earlier.installed` or `updates.earlier.skipped`.

| State | When | What shows |
|---|---|---|
| S1 A release ready; an administrator not holding the Cloudflare account | a release ready | "Ready to install": `updates.ready.release`, mark "Security fix" for one, `updates.ready.signed`; "For members", "For administrators", "What an administrator must do", `updates.notes.plain`. "Pass it to whoever holds your Cloudflare account": `updates.handoff.says`, the link, `updates.handoff.for`, button "Copy the link"; button "Not now"; fold "Skip this version": `updates.skip.says`, field "Why skip it? (every administrator will see this)", button "Skip this version, with this reason". |
| S2 The same, seen by the holder | holds the Cloudflare account | As S1 with buttons "Update" and "Not now" in place of the hand-off. |
| S3 Nothing ready | the newest runs | "Ready to install" holds "Nothing to install. Your team's Civicsmith runs the newest release. When a new one is out, it appears here and in every administrator's queue." (`updates.none`). |
| S4 A member's view | not an administrator | Heading and "Only your team's administrators install updates. Administrators: {admins}. If something needs updating, ask one of them." only. |

| Action | When | Leads to |
|---|---|---|
| A1. button "Update" (`updates.act.update`; act `updatestart`) | S2 | The installer's `update` page, set to that release, in a new tab. |
| A2. button "Not now" | S1, S2 | The release put aside for every administrator. |
| A3. button "Skip this version, with this reason" | S1, S2, with a reason | S3 or the next release; a skipped row in C4. |
| A4. button "Copy the link" | S1 | The link copied. |
| A5. button "Check your copy now" | always | C3's check lines. |
| A6. button "Show what each part runs" | always | C3's part rows. |
| A7. button "Show what running costs" | always | C3's work rows. |

## ties: "Your ties"

- **Who can see it** every member, own ties; the list is seen only by them and administrators.
- **Purpose** The member's own ties, and how a case would disclose them. **Entry points** `settings`; `account` › "Elsewhere in your settings".

- C1. Under the heading: `.sub`.
- C2. Open fold `.summary` "Why you are asked, and who sees it · so readers can trust a case · only you and the administrators see this list": "Why you are asked" with 4 points (`.why.1`–`4`); "Who sees it" with `.who.1`–`3` and `.who.change`.
- C3. Section "Your ties": table "Kind", "Who", "A case would say"; each row "a case would say: “{says}”" or "a case would name me".
- C4. Section "Add a tie": choice "Kind": "Employer", "Relative", "A business I have an interest in", "Other"; field "Who"; field "The tie, in your words"; radios "If a case the team publishes concerns them, the case discloses this tie": "Naming me by my handle: “{handle}, who worked on this case, is {tie}.”", "Without naming me: “A member of the team who worked on this case is {tie}.”"; note `.either`; button A1.

| State | When | What shows |
|---|---|---|
| S1 Ties listed | ties declared | C1 to C4. |
| S2 None yet | none | C3: "Nothing is listed yet. Start with “Add this tie”: say who it is with, and how you want a case to name it." |

| Action | When | Leads to |
|---|---|---|
| A1. button "Add a tie" | always | The tie a row of C3. |
| A2. button "Remove a tie" | a tie's row | The row goes. |

| Form message | Condition | Message |
|---|---|---|
| V1. "Who", the tie | empty, A1 | "Name who the tie is with and describe it." (`.add.empty`) |

## notes: "Your notes"

- **Who can see it** every member, own notes; nobody else, administrators included.
- **Purpose** Private notes, and turning one into an observation, hunch or question. **Entry points** `settings`; `account` › "Elsewhere in your settings".

- C1. Under the heading: "Only you can see these in your team."; link "What this protects, and from whom", showing `.protects` (3 sentences).
- C2. Field "New note"; button A1.
- C3. Section "Kept": table "Note", "Kept"; each row's date with "only you", "revised {date}", or "turned into observation {id}", "turned into hunch {id}" or "turned into question {id}".
- C4. A row's panel: field "Your note"; buttons A2, A3; "Turn it into": "an observation", "a hunch", "a question"; field "The observation or question you made from it"; for a hunch "For a hunch: the inquiry it belongs to", "For a hunch: what kind" ("a cause", "who someone is", "a relation", "a flow of money or things", "something else"), "For a hunch: what it is about"; button A4.
- C5. The first note kept while the team tells members what a court can reach: `.court` (3 sentences).
- C6. `AI` "Help me write this" under the note's field; its draft labelled "Draft · the assistant's, asked by {handle}".

| State | When | What shows |
|---|---|---|
| S1 Notes kept | notes held | C1 to C4. |
| S2 None yet | none | C3: "You have kept no notes yet." |
| S3 No AI account (the walk) | assistant unreachable | No C6. |

| Action | When | Leads to |
|---|---|---|
| A1. button "Write a note" | always | The note first in C3; C5 the first time. |
| A2. button "Revise your note" | row panel | "revised {date}". |
| A3. button "Delete your note" | row panel | The row goes. |
| A4. button "Turn a note into an observation, hunch or question" | row panel | "turned into … {id}" (C3); the note stays private. |
| A5. `AI` button "Help me write this" | assistant reachable | A labelled draft in the field. |

| Form message | Condition | Message |
|---|---|---|
| V1. note | empty, A1/A2 | "Write the note first. Nothing was sent." (`.notext`) |
| V2. made id | empty, A4 | "Give the id of the observation or question you made. Nothing was sent." (`.turn.nomade`) |
| V3. hunch | no inquiry or subject, A4 | "A hunch names its inquiry and what it is about. Nothing was sent." (`.turn.incomplete`) |
| V4. hunch subject | not two records for a cause, identity or relation | "A cause, who someone is or a relation is about two records, from and to. Nothing was sent." (`.turn.pair`) |

## translations: "Translations"

- **Address** `/app/translations`; one language `/app/translations/<tag>`.
- **Who can see it** every member reads; granted members translate; administrators grant, confirm and undo.
- **Purpose** The words members see, in the team's languages. **Entry points** `settings`.

- C1. Heading "Translations".
- C2. Section "Your team's languages": each language a link; "Choose a language to see its words."
- C3. Section "Who may translate {language}": granted members, "granted by {name}, {date}". Administrator: section "Who may translate": field "The member to grant {language} to (their id)", checkbox "Take the grant away instead", button A2.
- C4. Section "The words": `.counts`; table "English", "State", "Translation"; mark "protected"; states `.state.*`; `.changed`; `.adopted`; a local name `.localname`.
- C5. A word's panel: field "Your translation" (help "Type the translation, keeping every {name} part as it is."); buttons A3, A4, A5.
- C6. Without the assistant: note `.typed.note` (2 sentences); with it, `.drafts.note` (3 sentences).
- C7. Notes `.marked.note` and `.localnames.note`.
- C8. `AI` Assistant reachable: words can be picked; button "Ask the assistant to draft the {n} missing"; section "The assistant's drafts", each `.draft.label`; on an awaiting protected word, an administrator's button "Read it back into English", its answer `.reading.label`.

| State | When | What shows |
|---|---|---|
| S1 In use | a language besides English, chosen | C1 to C7. |
| S2 Only English | no other language | "Your team uses no language but English yet."; nothing else. |
| S3 No AI account (the walk) | assistant unreachable | No C8; C6 shows `.typed.note`. |

| Action | When | Leads to |
|---|---|---|
| A1. a language in C2 | S1 | `/app/translations/<tag>`. |
| A2. button "Give a member the grant for a language" | admin | The member listed in C3 (or removed). |
| A3. button "Adopt a translation" | granted member | The word "shown", or "awaiting a second check" for a changed protected word. |
| A4. button "Confirm a protected word" | another granted speaker or an administrator | The word "shown". |
| A5. button "Undo a change" | admin | The word as before. |
| A6. `AI` button "Ask the assistant to draft" (drawn with `.draft.missing`) | assistant reachable, words picked | Drafts listed, shown to no member until adopted. |

| Form message | Condition | Message |
|---|---|---|
| V1. member id | empty, A2 | "Name the member first. Nothing was sent." (`.grant.nomember`) |
| V2. translation | empty, no draft chosen, A3 | "Type a translation or choose a draft first. Nothing was sent." (`.text.none`) |
| V3. words | none picked, A6 | "Pick the words to draft first. Nothing was sent." (`.pick`) |

## wizards: "Wizards"

- **Who can see it** every member; a team's own wizards are listed to their projects' owners and to administrators.
- **Purpose** The team's wizard library. **Entry points** `settings`.

- C1. Heading "Wizards".
- C2. Choice "Which wizards": "Offered to members", "Drafts", "Submitted for approval", "Withdrawn", "Retired", "Broken: no longer matching the screens", "Open proposals"; "Showing: {state}".
- C3. Table "Wizard", "Whose", "Based on", "Approved by", "Finished", its cells in the words of `.whose.*`, `.required`, `.finished`, `.nobase`, `.basedon`, `.basehidden`, `.notapproved`, `.vstate.*`, `.version`, `.broken`, `.retired`, `.originalchanged`.
- C4. A wizard's panel: button "See its steps", section "Its steps". A Civicsmith wizard: `.civicsmith.only`, button "Copy a wizard to change it". A copy whose original changed: "What changed in {name}", button "Bring the change across", or for an approved copy button "Start a new draft of it".
- C5. Button A1.
- C6. Fold "Writing your own wizards": `.own.says`; "Record a new wizard": `.record.intro`; fields "For which project", "Its name", "Why"; button A3. A draft's panel: "Change this draft" (`.edit.*`), buttons "Save the changes", "Make it team-wide", "Withdraw this version", "Retire the wizard", A5 to A8. An open proposal: `.proposal.by`, buttons "Draft a wizard from these steps", "Adopt these steps into a draft", field "Into which of your drafts".
- C7. Note `.copy.note` (3 sentences).

| State | When | What shows |
|---|---|---|
| S1 Offered to members | default | C1 to C7. |
| S2 Another state | chosen in C2 | That state's table; "Showing: {state}". |
| S3 Nothing to show | none in the state, or none visible | "No wizards to show here. Your team's wizards are listed to the owners of their projects and to administrators." |

| Action | When | Leads to |
|---|---|---|
| A1. button "See the library" | always | S1. |
| A2. a choice in "Which wizards" | always | S2, read at once. |
| A3. button "Record a new wizard" | a project chosen | The guide in the dock records on the real screens; each act pressed is a step. |
| A4. button "Copy a wizard to change it" | a wizard's panel | A draft "based on Civicsmith's “{name}”" under "Drafts". |
| A5. button "Revise a draft" / "Save the changes" (`wizardrevise`) | a draft | Its steps changed. |
| A6. button "Submit for approval" | a draft | "Submitted". |
| A7. button "Approve" | a submitted version, its approver | "Approved"; offered to members. |
| A8. button "Retire" / "Retire the wizard" (`wizardretire`) | a team wizard | "Retired: {reason}". |
| A9. buttons "Bring the change across", "Start a new draft of it" | a copy whose original changed | The copy's draft takes the newer steps. |

| Form message | Condition | Message |
|---|---|---|
| V1. project | none, A3 | "Choose the project first. Nothing was sent." (`.project.none`) |
| V2. "Why" | empty | "Say why. Nothing was sent." (`.reason.needed`) |
| V3. drafts | none to adopt into | "You have no draft to adopt these steps into. Nothing was sent." (`.draftfor.none`) |
| V4. steps | all removed, A5 | "A wizard needs at least one step. Nothing was sent." (`.edit.nosteps`) |
| V5. a step | refused by a check | "Step {step}: {words}" (`.refusal.step`) |

## Differences seen in the code

Paths under `bio-plane/src/screens-settings/` unless longer; the design above stands.

- `settings`: "How full your team's record is" is drawn on `group` instead (`group.mjs:254`).
- `settings`: "For every member" also lists "Your team's own rules", "Watched addresses" and "Leads" (`settings.mjs:29`).
- `members`: "More for administrators" links Your team, Places and offices, Recovery codes (`members.mjs:173`).
- `members`: a removal under way (S3) is drawn inside "What removing an administrator takes", not as its own view (`members.mjs:274-290`).
- `group-identity`: the three questions and `.ask.intro` are drawn, not `.ask.what` (`identity.mjs:59-60`).
- `security`: no hour grid, totals, countries, "When you are told" or "What you can do" (`security.mjs`, no such key used).
- `connect`: "Check the connection" is not drawn (`connect.mjs:13-14`).
- `bias`: the four views are one page of four parts (`bias.mjs:1-8`).
- `recovery`: no "If you lose your codes too" (`recovery.mjs`, no `lost.*` key used).
- `ties`: `.who.change` and `.summary` are not drawn (`screens-investigate/ties.mjs`).
- `account`: the mockup has one section "Password and signing key"; the code has two, "Your password" and "Your signing key", both design rows, which C7 and C8 follow (`account.mjs:98`, `:123`).
- `teamai`, `security`, `group`, `places`, `updates`: served to every member with a sentence saying whose screen it is, not `unavailable` (`teamai.mjs:37`, `security.mjs:51`, `group.mjs:67`, `places.mjs:44`, `updates.mjs:34`).

## Changes

- 22 Nov 2026: written.
