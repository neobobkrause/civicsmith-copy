Length: <N> lines. Last section: "Changes".

# Screens: The team and your account

Page `team-and-account` of the Screens document (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

The team, its members and its settings; a member's own account, ties, notes and recovery codes. What binds every screen (frames, rail, dock, refusals, `unavailable`) is on the page "Every screen". Every screen here is in the working frame (rail place Settings) and needs a session.

How to read this page:
- In a screen's section, a key written `.x` means `screen.<id>.x`. A button's words are its `act.<op>.label.<id>` row unless another key is named; the Actions tables give each button's words.
- The heading of every screen is its `screen.<id>.name` word; its `.purpose` word is the heading's explanation.
- Words are quoted for headings, controls, state lines and messages. A longer explanation is named by its key and its length.
- **The walk has no AI account.** The assistant dock is absent, not greyed, and every control marked `AI` is not drawn.

## The screens on this page

| id | heading | address | built? |
|---|---|---|---|
| `group-identity` | "Who your team is" | `/app/group-identity` | built |
| `members` | "Members" | `/app/members`; a member `/app/members/<handle>` | built |
| `security` | "Security" | `/app/security` | built, in part |
| `account` | "Your account" | `/app/account` | built |
| `connect` | "The assistant" | `/app/connect` | built; superseded in the first beta by page `ai` |
| `teamai` | "The team's assistant" | `/app/teamai` | built; superseded in the first beta by page `ai` |
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

---

## group-identity: "Who your team is"

- **Address** `/app/group-identity`. **Who can see it** every member reads; only an administrator sees "Change it".
- **Purpose** Say what kind of team this is, what it focuses on, why it exists, and who sees that.
- **Entry points** `settings` › "The team's" › "Who your team is". Wizard "Say who your team is".

Content
- C1. Above the heading, one note: `.seed.recorded` "Your team's short name was recorded when Civicsmith was installed." or `.seed.unrecorded` (gap, 2 sentences: not recorded; run the installer again). No field or act for the short name.
- C2. Heading "Who your team is"; line "About {name}." (`.group`).
- C3. Once said: section "Who your team is" (`.now.heading`): "What kind of team:" (`.kinds`) and the kinds; "What you focus on" (`.focus.field`) and its text; "Why the team exists, in your own words" (`.purpose.field`) and its text; "Only members see this." (`.visibility.members`) or "Members and the public see this." (`.visibility.public`).
- C4. Administrator: section "Change it" (`.edit.heading`): checkboxes "What kind of team" (`.kinds.field`): "a professional group", "an issue group", "a community group", "a team for many things", "something else" (`.kind.*`); field "Describe your kind of team, in a few words" (`.other.field`, help `.other.help`); fields "What you focus on", "Why the team exists, in your own words"; radios "Who sees all of this" (`.visibility.field`): "Members only", "Also our public page and the network directory" (`.visibility.choice.*`); button A1.
- C5. `AI` Assistant reachable: `.ask.intro` (1 sentence), fields "What does your team do?", "Who is in it, and who does it work for?", "Why did it start?" (`.ask.q.what`, `.who`, `.why`), button A2. A field it filled is labelled "Draft · the assistant's, asked by {handle}" (`.draft.label`).

| State | When | What shows |
|---|---|---|
| S1 Short name recorded | installer recorded it | C1 `.seed.recorded`. |
| S2 Older installation | no short name | C1 `.seed.unrecorded`. |
| S3 Not said yet | nothing saved | No C3; a member sees only C1, C2. |
| S4 Assistant unreachable (the walk) | no AI account | No C5. |

| Action | When | Leads to |
|---|---|---|
| A1. button "Save who your team is, and who sees it" | administrator | Same screen; C3 shows what was saved; draft labels go. |
| A2. `AI` button "Ask the assistant to help write it" | administrator, assistant reachable | Same screen; focus and purpose fields filled and labelled; nothing saved. |

| Form message | Condition | Message |
|---|---|---|
| V1. whole form | no kind and every field empty, on A1 | `shell.field.needed`, naming "What you focus on" |
| V2. the three questions | all empty, on A2 | "Answer at least one question first. Nothing was sent." (`.ask.none`) |

---

## members: "Members"

- **Address** `/app/members`; `/app/members/<handle>` opens that member's row panel.
- **Who can see it** every member reads the roster; invitations, joining, signing keys, administrators' acts and the removal rule are an administrator's.
- **Purpose** Everyone in the team and what each may do; administrators invite and change what members may do.
- **Entry points** `settings` › "The team's" › "Members"; any member's name; `security` › "What you can do". Wizard "Invite a member".

Content
- C1. Heading "Members"; "Active members: {members} · Administrators: {administrators}" (`.count`).
- C2. Roster, founder first; columns "Handle", "Cover", "Role", "May do", "Status", "Expertise" (`.col.*`). Roles, capabilities, statuses and expertise in their words: `.role.*`, `.cap.*` (an administrator "all of it, as every administrator may"), `.status.*`, `.expertise.*` (none: "No expertise declared."). A founder without a handle: "The team's founder" (`member.founder.unnamed`); not joined: "Not joined yet" (`.nohandle`).
- C3. Member's view: under the table, "Administrators add members and change what each may do." (`.member.note`).
- C4. Administrator, while the step is not met: "With one administrator, the team depends on that one person and the hosting account." (`.recovery.one`; or `.recovery.many`), then `.recovery.codes` or `.recovery.nocodes`; links "Add a second administrator", "Get your recovery codes" (without codes).
- C5. Administrator, a row's panel: the invitation's state (`.invitation.*`); checkboxes "What {handle} may do"; `.status.to.revoked` or `.status.to.active`; `.endorse.what` for a proposed administrator; field "Why remove their administrator's powers? (every administrator will see this)"; fold "When confirming or withdrawing an expertise is refused" with three refusals (`.expertise.refused.*`).
- C6. Section "Invite a member" (`.invite.heading`): fields "A short id for this invitation", "The cover the team knows them by, not a legal name"; checkboxes "What they may do"; button A1; note `.invite.noemail` (3 sentences: no email; copy the link; once, seven days). Ticking "look after the team's Civicsmith" draws "Propose {who} as an administrator?", `.cap.administer.confirm` (5 sentences), choices "Propose {who} as an administrator" / "Go back".
- C7. Shown once: after A1 `.invite.shown` and the link; after A2 `.reset.shown`, `.reset.noemail` and the link.
- C8. Section "Joining through your website" (`.website.heading`): `.website.what` (2 sentences); fields "How many may join each day", "Days until it expires (1 to 30; seven if left empty)"; buttons A13, A14; then `.website.keyshown` or `.website.linkshown` and the key or link.
- C9. Section "More for administrators" (`.more.heading`): links "Places and offices", "Security".
- C10. Section "Signing keys" (`.keys.heading`): 3 sentences (`.a.signing.key.lets.a` …); per member "key registered by {member}, {date}" with A3, "key withdrawn by {member}, {date}" · "it does not sign" with A4, or "no signing key yet"; 2 sentences (`.key.react.withdraw.a.key.when.a` …); choice "Whose key"; field "Their public key"; button A5; 2 sentences (`.the.record.shows.that.you` …).
- C11. Section "What removing an administrator takes": with one administrator "With {n} administrator, no administrator can be removed by vote." + 2 sentences; "Nothing here changes anything."; fold "If more administrators can act than the roster lists" (3 sentences); fold "How it changes with the number of administrators": table "Administrators", "Votes it takes", "Who votes" for 1 to 7, the team's row "(now)", rows 1 and 2 "not removable", then 3 sentences (`.removal.takes.a.majority.of` …).

| State | When | What shows |
|---|---|---|
| S1 As an administrator sees it | session administers | C1, C2, C4 (one administrator), C5 to C11. |
| S2 As a member sees it | session does not administer | C1; table of member, "May do", "Expertise"; C3. No act. |
| S3 A removal under way | votes outstanding | "Removing {member} as an administrator"; "{n} administrators: {members}."; section "What it takes": "This takes {n} of {total} administrators' votes.", `.teo.is.counted.but.doesn`; rows "{member} · agreed", "{member} · hasn't voted yet" + "the removal waits for {member}", "{member} · faces removal" + "counted in the {n}, doesn't vote"; "{n} of {total} have agreed so far." |
| S4 Nobody else yet | only the viewer | "Nobody is in the team yet but you." (`.empty`). |

| Action | When | Leads to |
|---|---|---|
| A1. button "Create the invitation link" (`.invite.create`, `memberadd`) | administrator | C7; an "invited" row (beyond the second administrator, a proposal awaiting endorsement). |
| A2. button "Make a reset link for a member" (`act.owed_passwordresetlink.label.members`) | row panel | C7's reset link. |
| A3. button "Withdraw {handle}'s signing key" (`signerset`) | another's held key | The row reads withdrawn. |
| A4. button "Reactivate {member}'s signing key" (`signerset`) | a current member's withdrawn key | The row reads registered. |
| A5. button "Register a key for this member" | administrator | "key registered by {member}, {date}". |
| A6. button "Change what a member may do" | row panel | "May do" changes. |
| A7. button "Change a member's status" | row panel | Status "inactive" or "active". |
| A8. button "Endorse an administrator" | proposed administrator | Status changes once every administrator endorses. |
| A9. button "Remove an administrator" (`adminremove`); in S3 "Agree: remove {member} as an administrator" | administrator, with a reason | S3, counting the vote. |
| A10. button "Confirm declared expertise" | declared expertise | "confirmed: {label}". |
| A11. button "Withdraw an expertise" (`act.owed_expertisewithdraw.label.members`) | confirmed expertise | "No expertise declared." |
| A12. button "Withdraw an unused invitation" | unused invitation | "invitation withdrawn". |
| A13. button "Create a website key" | administrator | The key, shown once. |
| A14. button "Turn on the reusable join link" | administrator | The link, shown once. |
| A15. links in C9; "Get your recovery codes" | administrator | `places`, `security`; `recovery`. |
| A16. a member's name | always | `/app/members/<handle>`, its panel open. |

| Form message | Condition | Message |
|---|---|---|
| V1. short id, cover | either empty, A1 | "Give both a short id and the cover the team knows them by. Nothing was sent." (`.invite.incomplete`) |
| V2. "How many may join each day" | not a whole number ≥ 1, A13/A14 | "Say how many may join each day: a whole number, one or more. Nothing was sent." (`.website.nocap`) |
| V3. removal reason | empty or over 2,000 characters, A9 | "Say why, in your own words, in at most 2,000 characters. Nothing was sent." (`.remove.noreason`) |

---

## security: "Security"

- **Address** `/app/security`. **Who can see it** administrators; any other member sees the heading and "Security is set by your team's administrators. Administrators: {admins}. Ask one of them about anything here." (`.admins`) only.
- **Purpose** How hard the team's Civicsmith is being tried, by kind and hour, against its own usual; counts only.
- **Entry points** `settings` › "The team's" › "Security"; `members` › "More for administrators"; a security notice in an administrator's `queue` (opens at that period).

Content
- C1. Heading "Security"; line `.sub` "How hard your team's Civicsmith is being tried, against its usual. Only administrators see this."
- C2. Fields "From", "To" (`.from`, `.to`); button A1; fold "Dates in the wrong order" (`.period.bad.summary`) holding V1.
- C3. Section "How hard your team's Civicsmith was tried" (`.level.heading`): mark "Ordinary." / "Raised." / "High." (`.level.*`), explained by `.risk.means.ordinary`; "From {from} to {to}." (`.period`); "{count} attempts, against {usual} usually." (`.total`).
- C4. `.files.on` (3 sentences: files checked on arrival and weekly; safe view until a deeper check).
- C5. Fold "The counts, by kind, hour and place" (`.counts.fold`): section "By kind and by hour" (`.heat.heading`), a 24-hour grid by kind, each square named in words (`.tip.hour_*`), key "at or below the usual", "up to {n} times the usual", note `.heat.note`; section "Totals for the period" (`.totals.heading`), table "Kind", "This period", "Usually", rows "Refused sign-ins", "Refused keys and links", "Requests over the limit", "Refused hand-overs", "Let through after a check" (`.kind.*`), note `.totals.note`; where from, by country (`.where.what`, note `.where.note`).
- C6. Section "When you are told" (`.told.heading`): a notice row (`.notice.signin`, `.notice.sent`); note `.told.note`.
- C7. Section "What is installed" (`.parts.heading`): "File scanner", "Safe view"; "Files waiting to be scanned: {queued}. Files held: {held}." (`.queue`); button A2.
- C8. Section "Your security tools" (`.tools.heading`): `.tools.about`; table "Tool", "State", "Added", "What it does", states "added, not tested", "on", "off: its test failed", "off"; or "Your team uses no security tool of its own." (`.tools.none`). Section "What happened to them" (`.events.heading`): events (`.event.*`) or "Nothing yet."
- C9. Fold "Add another checker (advanced)" (`.add.fold`): section "Tools you can add" (`.catalogue.heading`) or "No tool can be added just now."; each tool's panel: "What it is sent", "Never sent", "Who receives it", "Where", "How long it keeps files", "How long it keeps results", "Whether it shares them" (`.h.*`); its config fields; checkbox "I understand the vendor keeps the files it is sent" (`.keep`) where it keeps files; for an on-premises tool, checkbox "Check every file, not only those a member asks about" (`.every`); buttons A3 to A5. Notes `.adding.private`, `.notoffered`, `.logsink`.
- C10. Section "What you can do" (`.cando.heading`): `.cando` (3 sentences), "Your account" and "Members" as links.

| State | When | What shows |
|---|---|---|
| S1 A week with a hard try | raised or high in the period | Mark "Raised." or "High."; "Someone tried hard to sign in on {when}. Every attempt was refused." (`.summary.signin`); `.summary.detail` (3 sentences). |
| S2 An ordinary week | near the usual | Mark "Ordinary."; "Nothing unusual. There is nothing for you to do." (`.ordinary.head`); `.ordinary.line`. |
| S3 A member's view | not an administrator | Heading and `.admins` only. |
| S4 No signatures | the scanner holds none | C7 says so, with `.nosignatures.next`. |

| Action | When | Leads to |
|---|---|---|
| A1. button "Show the level for a period" | administrator | Same screen; C3, C5 for that period. |
| A2. button "Check for new signatures now" | administrator | Same screen; "The scanner has been asked to check for new signatures. The result shows here once it has finished." (`.mirror.started`). |
| A3. button "Add a security tool" | a catalogue panel | Same screen; the tool "added, not tested"; an event. |
| A4. button "Test a security tool" | an added tool | Same screen; "The tool passed its test and is on." or "The tool stays off: {detail}" (`.tested.*`). |
| A5. button "Remove a security tool" | a tool held | Same screen; the row goes; "{tool} removed". |
| A6. links "Your account", "Members" | administrator | `account`, `members`. |

| Form message | Condition | Message |
|---|---|---|
| V1. "From", "To" | end before start, A1 | "Choose a start and an end date, the start first. Nothing was read." (`.period.bad`) |
| V2. a tool's field | empty, A3 | "Fill in {field} first. Nothing was sent." (`.config.missing`) |

---

## account: "Your account"

- **Address** `/app/account`. **Who can see it** every member, own account only.
- **Purpose** The member's own handle, password, signing key, language, cover name and expertise; signing out.
- **Entry points** `settings` › "Yours" › "Your account"; `security` › "What you can do".

Content
- C1. Heading "Your account".
- C2. Section "Your handle" (`.handle.heading`): the handle; "Your handle can't be changed: it names your work for good, and no one else can ever take it." (`handle.fixed`). No act changes it.
- C3. Section "Language and appearance" (`.language.heading`): "Your screens use {language}." or "Your screens follow your device's setting." (`.language.now`, `.language.device`); choice "Your language" (`.language.field`); choice "Appearance" (`shell.appearance`): "Follow my device", "Light", "Dark"; choice "Explanations" (`.level.field`, help `.explain.help`); choice "Sounds": "Off", "On" (`.sounds*`).
- C4. Section "Your cover name" (`.pairing.head`): `.pairing.says`, `.pairing.choose`; radios "Who can see which cover goes with your handle" (`.pairing.legend`): `.pairing.private`, `.pairing.public`; button "Save my choice" (`.pairing.save`); note `.pairing.change`, `.pairing.undone`.
- C5. Section "What you know" (`.expertise.heading`): "You have declared no expertise.", "Declared: {label}" or "Confirmed by an administrator: {label}"; field "Your expertise (optional)" (help `.expertise.help`); button A4.
- C6. Section "Signing out" (`.signout.heading`): buttons A5, A6; note `.signout.note`.
- C7. Section "Your password" (`.password.heading`): fields "Your current password", "A new password" (help "At least 12 characters. A short sentence you can remember works well."), "Type it again"; button A7.
- C8. Section "Your signing key" (`.key.heading`): "Key ending {key}, registered {date}" (`.key.held`); for a key an administrator registered, "registered for you by {member}, an administrator, on {date}." and "Only you can sign with it; revoke it here if it isn't yours."; or "You have no signing key registered." (`.key.none`); button A9 on a held key.
- C9. No key: section "Make your signing key" (`.key.make.heading`): `.key.help` (3 sentences); checkbox `signing.ceremony.keepkey`; field "A passphrase for the key file (optional)" (help `.key.passphrase.help`); button A8.
- C10. Section "Elsewhere in your settings" (`.elsewhere.heading`): links "The assistant", "Your ties", "Your notes", "Glossary".

| State | When | What shows |
|---|---|---|
| S1 As usual | always | C1 to C10. |
| S2 A newer version is live | a newer release is served | The update band; "Reloading brings in the newest version. It changes only the program in your browser, never your team's record." (`.update.note`). |
| S3 Making your signing key | after A8 | Section "Your key is made" (`.key.made.heading`): "Key ending {key}, registered {date}", the public line, `.key.save` (1 sentence), buttons "Save the key file" and "Copy the public line" (`.key.savefile`, `.key.copyline`), `.key.lost`. |
| S4 No key made | the browser made none | "No key was made, so nothing was registered." (`.key.declined`). |

| Action | When | Leads to |
|---|---|---|
| A1. button "Choose your language" (`memberlanguageset`) | always | Same screen, in that language. |
| A2. "Explanations" (`infolevelset`, "Choose how much is explained") | always | Explanations open after the chosen pause. |
| A3. button "Save my choice" (`memberpairingset`) | always | Same screen; the choice kept after a reload. |
| A4. button "Declare your expertise" | always | Same screen; "Declared: {label}". |
| A5. button "Sign out on this device" | always | `front`, signed out. |
| A6. button "Sign out everywhere" | always | `front`, signed out; every other session ends. |
| A7. button "Change your password" | always | Same screen; "Your password is changed. Every other session signed in as you has ended." (`.password.changed`). |
| A8. button "Register your signing key" | no key | S3. |
| A9. button "Revoke your signing key" | a key held | Same screen; "You have no signing key registered."; C9. |
| A10. links in C10 | always | `connect`, `ties`, `notes`, `glossary`. |

| Form message | Condition | Message |
|---|---|---|
| V1. new password twice | not the same, A7 | "The two new passwords are not the same. Type them again. Nothing was sent." (`.password.differ`) |
| V2. expertise | empty, A4 | "Say what you know first. Nothing was sent." (`.expertise.nolabel`) |

---

## connect: "The assistant"

- **Address** `/app/connect`. **Who can see it** every member, own account.
- **Superseded.** The earlier "connect your Claude account" screen. In the first beta the page `ai` takes its place for AI providers: a member's own AI is `aimine` ("Your AI") and connecting one is `aiconnect` (DEC-420). Described here as built.
- **Purpose** Whether and how the assistant serves the member: the team's key, their own Claude account, or nothing; their limit and use.
- **Entry points** `settings` › "Yours" › "The assistant"; `account` › "Elsewhere in your settings". Wizard "Connect your Claude account".

Content
- C1. Heading "The assistant"; "Optional. Everything in your team's Civicsmith works without the assistant." (`.optional`).
- C2. One card saying what serves the member (each state's first line), then parts that open and close, each a heading and a line.
- C3. Foot, every state but S6: fold "Which account pays, and when" (`.whopays.summary`) holding `ai.whopays` (3 sentences).

| State | When | What shows |
|---|---|---|
| S1 The team's key serves you | team key on, no own account | "The assistant serves you on the team's API key." (`.group`) + `.group.allowance`; meter "Today on the team's key, your share of it"; `.project.serves` where a project pays. Parts: "Before your first question" · "Read once: what happens to what you ask." with mark "Outward · leaves your team's Civicsmith" (`.outward`), `.notice.group`, button "I have read this" (`.read.button`); "Your daily allowance" · "Set by your administrators." (`.grouplimits`, `.group.allowance.reached`, "Suggestions: {suggestions}."); "Your use" · "Only you see this."; "Connect your own account (optional)" · `.own.instead`, holding S5's form. |
| S2 Your own API key | member holds a key | `.own.apikey`, mark "Connected"; "Connected since {date}." Parts: "What the assistant may do for you" · `.part.uses.why`, switch groups "Everyday help", "Without being asked" (help `.uses.unasked.help`); "A limit, if you want one" · "None set: only Anthropic's own spending limit on your key applies.", the limit form ("Per" "day"/"month", fold "More choices"), `.limit.binds`; "Your use", table "Last 30 days", meter "Today on your own account", note `.use.note`; "Disconnect" · "If you disconnect it, the team's API key serves you instead.", button "Disconnect your API key" (`.disconnect.button`). |
| S3 Your Claude subscription | subscription connected | `.own.subscription`, mark "Connected"; "Anthropic accepts it until {date}." "Then you sign in again here." Parts as S2, limit line "None set: only your plan's own allowance applies.", units tokens or calls, use row "On your subscription", button "Disconnect your subscription". `not built`: button "Check the connection" (`.check`) and fold "If the check stops". |
| S4 Sign-in expired | Anthropic stopped accepting it | "Your Claude sign-in has expired, on {date}." (`.expired`), mark "Expired", `.expired.means`, `.expired.next`, button "Open Anthropic's sign-in page". |
| S5 Members bring their own | no team key, no own account | "The assistant isn't serving you yet. Your team doesn't pay for the assistant; if you want it, connect your own account below, or skip it." (`.none`). Part "Before you connect" · "Read once: what connecting means.": outward mark, `.disclosure.own`, `.disclosure.then`, button "I have read this". Then radios "How do you want to connect the assistant?": "My Claude subscription (Pro or Max)", "My own Claude API key", "Not now" (`.way.*`). Subscription: "With your Claude subscription (Pro or Max)" (`.signin.heading`), four steps (`.signin.step1`–`4`), button "Open Anthropic's sign-in page", field "The code from Anthropic's page" (help `.signin.help`), button "Connect with this code" (`.signin.withcode`), fold "If you signed in a while ago, it asks for your password first" (`.reauth.summary`), `.refusal.reference`. API key: "With your own Claude API key", field "Your API key" (help `.apikey.help`), button "Connect with this key" (`.apikey.connect`). Not now: `.skip`. |
| S6 Material kept away from AI | an administrator turned it on | `.keptaway` with the quoted reason, then `.keptaway.ask`. No part, no act. Unreadable: `.keptaway.unread`. |
| S7 Sign-in state unreadable | that read failed | `.signin.statefailed`; never drawn as not connected. |
| S8 No AI account (the walk) | no team key, no own account | S5. The subscription way only while the sign-in part is installed. |

| Action | When | Leads to |
|---|---|---|
| A1. button "I have read this" (`groupkeynoticeseen`) | S1, until read | The part shows read. |
| A2. button "I have read this" (`disclosureshown`) | S1's own-account part, S5 | The ways to connect show. |
| A3. button "Open Anthropic's sign-in page" (`subscriptionsignin`) | S4, S5 subscription | Anthropic's page in a new tab; this screen stays. |
| A4. button "Connect with this code" (`subscriptionsignin`) | S5 subscription | S3. |
| A5. button "Go on" (`reauth`) | a password asked again | Does the act asked for, once. |
| A6. button "Connect with this key" (`accountreferenceset`) | S5 API key | S2. |
| A7. use switches (`accountusesset`) | S2, S3 | The switch shows on or off. |
| A8. limit button (`ailimitset`) | S2, S3 | The limit listed. |
| A9. button "Disconnect your API key" (`accountreferenceremove`) | S2 | S1 or S5. |
| A10. button "Disconnect your subscription" (`subscriptiondisconnect`) | S3 | S1 or S5. |

| Form message | Condition | Message |
|---|---|---|
| V1. the code | empty, A4 | "Paste the code from Anthropic's page first. Nothing was sent." (`.signin.nocode`) |
| V2. the API key | empty, A6 | "Paste your API key first. Nothing was sent." (`.apikey.nokey`) |
| V3. the code | refused | `.refused.<CODE>` for `RUNNER_NOT_CONFIGURED`, `RUNNER_NOT_STARTED`, `RUNNER_SILENT`, `AGENT_WORKER_SILENT`, `ATTEMPT_SUPERSEDED`, `NOT_THIS_MEMBER`, `BAD_CODE`, `BAD_REQUEST`, `SIGNIN_NOT_HELD`, `SIGNIN_TOKEN_REFUSED`, `SIGNOUT_FAILED`, `AI_KEPT_AWAY`, with the shell's reference |

---

## teamai: "The team's assistant"

- **Address** `/app/teamai`. **Who can see it** administrators; any other member sees the heading and `.purpose` only.
- **Superseded.** In the first beta "AI providers" (`aiproviders`, page `ai`) takes its place (DEC-420). Described here as built.
- **Purpose** The team's API key, what it pays for, its limits, its use summed over members, keeping material away from AI.
- **Entry points** `settings` › "The team's" › "The team's assistant".

Content
- C1. Heading "The team's assistant"; "The team's API key serves members who have no account of their own." (`.sub`).
- C2. Card: "The team's API key is held and on." (`.held`), mark "On", "{who} set it on {date}." (`.setby`); meter "This month on the team's key" (`ai.usage.meter.month_group`). Held and off: "Held · off · set by {by}, {date}" (`screen.members.key.heldoff`).
- C3. Part "What this account pays for" (`screen.panel.uses.heading`) · "Everyday help is {everyday}; exploring is {explore}." (`.uses.why`): each use on/off with its switch; exploring's choice.
- C4. Part "Limits on this account" (`screen.panel.limits.heading`) · `.limits.why` or "None set.": a table of limits, one form.
- C5. Part "This month's use" (`screen.panel.usage.heading`) · "Summed over members; nobody is named." (`.use.why`).
- C6. Part "Keeping our material away from AI" (`screen.members.keepaway.heading`) · "Off. Members may use the team's key, a project's account or their own." or "On. {by} turned this on on {date}, and gave this reason:" (`screen.members.keepaway.off`, `.on`); `act.aikeepaway.does`; checkboxes "Keep our material away from AI": "For every use" / "Only for these uses", "The uses"; field "Why (every member will see this)"; buttons "Save", "Turn it off" (`screen.members.keepaway.*`).
- C7. Part "The key itself" (`.key`) · "Replace it, switch it off or remove it." (`.key.why`): field "The team's Anthropic API key" (`screen.members.key.field`); buttons A1, A2, A5.
- C8. Part "Changes" (`screen.panel.changes.heading`) · "Every change, with who made it and when." (`.changes.why`).
- C9. Fold "Which account pays, and when" holding `ai.whopays`.

| State | When | What shows |
|---|---|---|
| S1 Key held and on | the design's usual | C1 to C9. |
| S2 No key held (the walk) | no team key | Card "No key is held. Members bring their own account, or use your team's Civicsmith without the assistant." (`screen.members.key.none`); C7 offers the field and "Hold the team's API key" only. |
| S3 A member's view | not an administrator | Heading and `.purpose` only. |
| S4 Keep-away unreadable | that read failed | "Whether the team keeps its material away from AI couldn't be read just now." (`screen.members.keepaway.unread`). |

| Action | When | Leads to |
|---|---|---|
| A1. button "Hold the team's API key"; with a key, "Replace the key" (`screen.members.key.replace`) | administrator | C2 reads held; the key never drawn again. |
| A2. button "Switch it on" / "Switch it off" (`groupkeyswitch`) | a key held | C2's mark changes. |
| A3. use switches (`accountusesset`, "Set what the team's key pays for") | a key held | The use reads on or off. |
| A4. limit button (`ailimitset`, "Set a limit on the team's key") | a key held | The limit listed; a change in C8. |
| A5. button "Remove the key" (`groupkeyremove`) | a key held | S2. |
| A6. button "Save" (`aikeepaway`) | administrator, with a reason | C6 reads "On. …"; `connect` shows its S6 to every member. |

| Form message | Condition | Message |
|---|---|---|
| V1. the key | empty, A1 | "Paste the key first. Nothing was sent." (`screen.members.key.nokey`) |
| V2. the reason | empty or over 2,000 characters, A6 | "Give your reason, in 1 to 2,000 characters. Nothing was sent." (`screen.members.keepaway.noreason`) |
| V3. "The uses" | "Only for these uses", none ticked | "Choose at least one use, or keep it for every use. Nothing was sent." (`screen.members.keepaway.nouses`) |
| V4. the limit form | value refused | `ai.refused.limitinvalid`, `ai.refused.unitunavailable`, `ai.refused.switchvalue` |

---

## bias: "Declared bias"

- **Address** `/app/bias`; a work made under an earlier lens `/app/bias/<run>`.
- **Who can see it** every member reads and writes sets; an administrator adopts for the team, a project's owner for the project.
- **Purpose** The lens the team reads evidence through, stated so a reader can discount it; it never blocks work.
- **Entry points** `settings` › "For every member" › "Declared bias"; the `queue` when a lens changes under work already made (S4).

Content
- C1. Heading "Declared bias"; `.the_lens_your_team_reads` + "It never blocks work."
- C2. Choice "Whose lens" (`.lens.label`): "The whole team" (`.lens.team`) or a project; button A1.
- C3. Section "In force for {project}" (`.in_force_for_the_coliseum`) or "In force for the whole team" (`.head.team`): each statement's kind "Scrutiny" / "Inference" / "Pattern" (`.kind.*`), "about {subject}", the statement, "Why: {reason}", "the team's, locked" or "this project's" (`.row.*`); "Adopted" lines (`.by_admin_for_the_team*`); "What this set does not enforce" and its text; "Lens" (`.dt.lens`), its number, `.the_same_lens_gives_the`.
- C4. Folds "When a project statement meets a locked one", "When an adopted set is only offered" (2 sentences each); note `.to_adopt_write_or_draft`, `.your_queue_tells_you_when`.

| State | When | What shows |
|---|---|---|
| S1 The lens in force (a project) | project chosen, lens adopted | C1 to C4: the team's statements, then the project's. |
| S2 Writing and adopting a set | writing | "Write a set" (`.head.write`), `.a_set_is_a_list`, `.a_set_stays_a_draft`; fields "Name of the set"; radios "Kind of statement": "Scrutiny: how closely we read a source", "Inference: what we do not conclude from something", "Pattern: how a source has behaved before"; "Who or what it is about"; "The statement"; "Why you read it this way"; "What it cites"; "What this set does not enforce"; button A2; fold "When a set cannot be saved". Section "Adopt it" (`.head.adopt`): radios "Adopt it for": "The whole team (an administrator adopts)", "One project: {project} (its owners adopt)"; field "Why you adopt it"; button A3; 3 sentences (`.adopting_names_the_revision_in` …); fold "When you cannot adopt it". `AI` "Help me write this" under the statement fields. |
| S3 Drafted from an outside policy | pasting a policy | "Draft a set from an outside policy", 3 sentences; fields "The policy, in its own words", "Where it comes from", "When you read it"; button A4. After it: "Proposed statements" (`.head.proposed`), each "Proposed, not yet yours." "Choose who it is about and write why."; "It read {read} of {of} sentences."; button "Start a set from these"; "Left out" (`.head.left_out`): "A bar" / "A verdict", each with why; `.nothing_was_saved_offered_or`. |
| S4 Work made under an earlier lens | `/app/bias/<run>` | "Work made under an earlier lens", 3 sentences; "Waiting for your word": the work, `.earlier.made`, button A5; field "Your reason"; button A6; `.this_cannot_be_undone_your`, "The assistant cannot settle it."; fold "When it cannot be settled"; "Settled" (`.head.settled`): `.earlier.settled`. |
| S5 No lens in force | nothing adopted | "No lens is in force for {project}." "A case published now says that your team declared none."; links "Write a set · …", "Draft one from an outside policy · …" (`.link.*`). |
| S6 The whole team's lens | "The whole team" chosen | C3 headed "In force for the whole team". |
| S7 No AI account (the walk) | assistant unreachable | No "Help me write this". |

| Action | When | Leads to |
|---|---|---|
| A1. button "Show the lens in force" | always | S1, S5 or S6. |
| A2. button "Save the set and offer it for adoption" (`promote`); "Start a set from these" (`promote`) | S2; S3 | The set listed as offered. |
| A3. button "Adopt this set" | an offered set; administrator (team) or owner (project) | S1 or S6 with it in force. |
| A4. button "Propose statements from it" | S3 | Proposals and "Left out"; nothing saved. |
| A5. button "Show its record" | S4 | The work's record. |
| A6. button "Settle it, with your reason" | S4 | The work under "Settled". |
| A7. `AI` button "Help me write this" | assistant reachable | A labelled draft in the field. |
| A8. links in S5 | S5 | S2, S3. |

| Form message | Condition | Message |
|---|---|---|
| V1. a statement | a verdict or a bar, A2 | `.a_statement_in_it_says` + "Reword that statement to say how you read the source, and offer the set again." |
| V2. a statement | no reason, or a pattern citing nothing | "A statement has no reason, or a pattern statement cites nothing." + "Add what it asks for and offer the set again." |
| V3. "Adopt it for" | the team, not an administrator, A3 | "Only an administrator adopts a set for the whole team." + "Ask one, or adopt it for a project you own." |
| V4. "Adopt it for" | a project, not an owner | "Only an owner of a project adopts a set for it." + "Ask one of its owners: {owners}." |
| V5. the set | not offered, A3 | "The set must be offered for adoption first." + "Save it and offer it, then adopt it." |
| V6. "Your reason" | empty, A6 | "You gave no reason." + "Write why the change does not bear on this work, then settle it." |
| V7. the work | settled or not visible, A6 | "Someone settled it already, or you cannot open the work it is about." + "Open your queue to see what is left." |

---

## places: "Places and offices"

- **Address** `/app/places`. **Who can see it** every member reads; a member who does not administer sees "Administrators choose these; you can read them here." (`.admins`) and no administrator's act.
- **Purpose** The places whose rules apply, and the offices, seats and courts the team deals with.
- **Entry points** `settings` › "The team's" › "Places and offices"; `members` › "More for administrators".

Content
- C1. Heading "Places and offices"; `.sub`.
- C2. Section "The places whose rules apply" (`.profiles.heading`): "The places, read in this order" (`.profiles.field`, help `.profiles.help`); warning `.profiles.warning`; button A1. None chosen: `.profiles.none`. Disagreeing: `.profiles.conflicts`.
- C3. Section "A place not listed yet" (`.wanted.heading`): "You named {name} on {date}." or "No place is named."; `.wanted.match`; field "A place you want that isn't listed (optional)" (help `.wanted.help`); button A2.
- C4. Section "Where else to go" (`places.elsewhere.head`): `places.elsewhere.says` (2 sentences); link "See the list" (`places.elsewhere.open`); none listed: `places.elsewhere.none`.
- C5. Section "Offices and seats" (`.offices.heading`): each office, "from your places' rules" or "added by your team"; one a member named carries its mark and A5; "This office is confirmed." (`.office.confirmed`); note `.offices.note`; or "No offices are held yet."; button A3; "Change the offices" (`.add.heading`): fields "The office's name", "Who or what this office is"; button A4.
- C6. Section "Courts" (`.courts`): each court, "from your place's rules" or "added by {name} on {date}".
- C7. Section "Your team's own rules" (`screen.grouprules.name`): `.rules.note`; link "Your team's own rules".

| State | When | What shows |
|---|---|---|
| S1 A state with a profile | a held place chosen | C1 to C7. |
| S2 A state with no profile | a place named, none held | "No profile for {state} yet" (`.noprofile.heading`): `.noprofile.says`, `.noprofile.offers`, `.noprofile.still`, `.noprofile.asks`; field "Tell us the place you want" (help `.noprofile.want.help`); button A2; C7. No C4 to C6. |
| S3 A member's view | not an administrator | `.admins`; sections read-only. |
| S4 Offices partly read | a later page failed | "The rest of the offices couldn't be read just now." |

| Action | When | Leads to |
|---|---|---|
| A1. button "Choose the places whose rules apply" | administrator | C2 lists the places. |
| A2. button "Save the place you want" | administrator | "You named {name} on {date}." |
| A3. button "Fill in the offices again" | administrator | "Filled in: {seeded} new, {already} already held, {unseeded} that couldn't be." (`.seeded`). |
| A4. button "Add an office yourself" | administrator | The office "added by your team"; a court: "Added the court: {name}." |
| A5. button "Confirm this office" | an office a member named | "This office is confirmed." |
| A6. links "See the list"; "Your team's own rules" | as drawn | `elsewhere`; `grouprules`. |

| Form message | Condition | Message |
|---|---|---|
| V1. office name and what it is | either empty, A4 | "Give both the office's name and what it is. Nothing was sent." (`.add.incomplete`) |

---

## recovery: "Recovery codes"

- **Address** `/app/recovery`. **Who can see it** every member, own codes.
- **Purpose** The member's own one-time recovery codes: how many are left; getting new ones.
- **Entry points** `settings` › "Yours" › "Recovery codes"; `members` › "Get your recovery codes".

Content
- C1. Heading "Recovery codes"; `.sub` (3 sentences).
- C2. Section "Your codes" (`.held.heading`): "You hold recovery codes: {remaining} of {total} unused, issued {date}." (`.held`), or "Every code issued on {date} is used." (`.spent`), or "You hold no recovery codes yet." (`.none`); `.onlyyou` (3 sentences).
- C3. Section "New codes" (`.issue.heading`): `.spends` (2 sentences); button A1.
- C4. Section "If you lose your codes too" (`.lost.heading`): `.lost.what` (2 sentences).

| State | When | What shows |
|---|---|---|
| S1 Codes held | codes held | C1 to C4. |
| S2 New codes just issued | after A1 | "Save these now: they are shown only this once. Keep them somewhere only you can reach, apart from your password. Civicsmith keeps only a fingerprint of each, so it can never show them again." (`.shown`) and ten codes; not shown again after leaving. |
| S3 None | none issued, or all used | C2 reads `.none` or `.spent`. |

| Action | When | Leads to |
|---|---|---|
| A1. button "Get new recovery codes" | always | S2. |

---

## group: "Your team"

- **Address** `/app/group`. **Who can see it** every member reads; a member who does not administer sees "These are your team's settings. Administrators change them; you can read them here." (`.admins`), the values, and no field or act.
- **Purpose** The settings chosen at setup, changeable here.
- **Entry points** `settings` › "The team's" › "Your team".

Content
- C1. Heading "Your team"; "Administrators only. The settings chosen at setup, all changeable here." (`.sub`).
- C2. Section "Name and logo" (`.name.heading`): "Your team is called {name}." or `.name.none`; field "The team's name" (help `.name.help`); button A1; fold "Saving the same name". "Your team has a logo." or "Your team has no logo; its name is shown alone."; field "A new logo" (help "A PNG or JPEG image, at most 200 KB."); button A2.
- C3. Section "Website" (`.domain.heading`): "{domain}, verified on {date}.", "{domain}, not verified yet." or "No website is recorded."; the last verdict (`.domain.verdict.*`), "Checked {date} at {time}."; field "Your team's web address" (help `.domain.help`); button A3.
- C4. Section "Languages" (`.languages.heading`): "Your members use: {languages}." or `.languages.none`; checkboxes "The languages" (help "Tick from 1 to 20 languages your members use."); button A4.
- C5. Section "Time zone" (`.timezone`): "{zone}, from {profile}" or "{zone}, corrected by your team"; a zone choice (help `.timezone.help`); fields "How you checked it", "Where you checked it" (each help starts "Required."); button A5; folds "When two places give different zones" (holding `.timezone.two`), "When your team's time zone isn't set" (holding "No time zone is held yet. Choose one below.").
- C6. Section "The court notice" (`.court.heading`): `.court.says`; "Members are told what a court order could reach." or "Members are not told what a court order could reach."; checkbox "Show members the notice, before their first note and in their settings" (`.court.show`); button A6.
- C7. Section "The hosting account" (`.hosting.heading`): `.hosting.says`; "Recorded by {by} on {date}:" (or `.hosting.now.setup`, `.now.system`, `.now.date`) and the holder, or "Nobody has recorded who holds the hosting account."; fields "Who holds it", "A note (optional)"; button A7.
- C8. Section "A copy of your team's record" (`.export.head`): `.export.says`; field "Why you are taking it (optional)" (help `.export.note.help` + "Anything past 280 characters is cut."); button A8; "Taking a copy cannot be undone." + `.export.undone.why`; fold "When taking a copy is refused": "Only the founder can take a copy." "Ask the founder to take it."; button A9; the copies, newest first; "Up to 200 are shown; if more exist, the list says so."
- C9. Section "What the team has at stake" (`stake.group.title`): field "The team's statement" (`stake.group.label`, help `stake.group.help`); button A10. `AI` "Help me write this" under it.
- C10. Section "The team's bar" (`.bar.heading`): "Capture at least {capture}, connection at least {connection}, set on {date}:" or "Your team has set no bar."; choices "Capture", "Connection", each with "No bar"; field "Why (every member will see this)"; button A11.

States: one view; each section shows its value or its "none" line as listed. A member's view is described under Who can see it. With no AI account (the walk) "Help me write this" is absent.

| Action | When | Leads to |
|---|---|---|
| A1. button "Save the name" | administrator | "Saved. Your team is now called {name}." (`.name.saved`); same name: "That's already your team's name, so nothing changed." (`.name.same`). |
| A2. button "Change the logo" | administrator | "Your team has a logo."; the logo in the frame. |
| A3. button "Verify the website" | administrator | C3's line and verdict. |
| A4. button "Save the languages" | administrator | "Your members use: {languages}." |
| A5. button "Correct the time zone" | administrator | "Your team's time zone is now {zone}." (`.timezone.saved`). |
| A6. button "Show the court notice" | administrator | C6's line changes. |
| A7. button "Record who holds the hosting account" | administrator | "Recorded by {by} on {date}:" and the holder. |
| A8. button "Take a copy of the record" | the founder | A row added to the copies. |
| A9. button "Show the list of copies" | administrator | The list. |
| A10. button "Save the statement" | administrator | The statement, with who and when. |
| A11. button "Set the team's bar" | administrator, with a reason | C10's line. |
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

---

## settings: "Settings"

- **Address** `/app/settings`, the rail's place Settings. **Who can see it** every member; "How full your team's record is" and "The team's" only to an administrator.
- **Purpose** Every setting in one list: the member's own, then the team's.
- **Entry points** the rail (on a phone, More) › Settings; Home's area block Administration.

Content
- C1. Heading "Settings"; "Your own settings first; then the team's, which only administrators change." (`.sub`).
- C2. Section "Yours" (`.yours`): links "Your account", "The assistant", "Your ties", "Your notes", "Recovery codes", each with its screen's purpose beneath.
- C3. Administrator: section "How full your team's record is" (`.storage.head`): "{used} of {limit} ({pct}%)" and `.storage.what`; from 70% `.storage.warn70`; fold "When it passes 90%, or its size isn't known" (`.storage.more`) holding `.storage.warn90`, `.storage.unknown`; note `.storage.factors`.
- C4. Administrator: section "The team's" (`.groups`): links "Your team", "Who your team is", "Members", "The team's assistant", "Places and offices", "Security", "Updates", "Translations", "Wizards", each with its purpose.
- C5. Section "For every member" (`.everyone`): link "Declared bias" with its purpose.

| State | When | What shows |
|---|---|---|
| S1 An administrator's | administers | C1 to C5. |
| S2 A member's | does not | C1, C2, C5. |

| Action | When | Leads to |
|---|---|---|
| A1. each link | as its section | `account`, `connect`, `ties`, `notes`, `recovery`; `group`, `group-identity`, `members`, `teamai`, `places`, `security`, `updates`, `translations`, `wizards`; `bias`. |

---

## updates: "Updates"

- **Address** `/app/updates`. **Who can see it** administrators (listed in `settings` only to them); a member who opens it sees the heading and "Only your team's administrators install updates. Administrators: {admins}. If something needs updating, ask one of them." (`.admins`) only.
- **Purpose** The release running, the release ready and what changes in it, and Update, Not now or Skip this version.
- **Entry points** `settings` › "The team's" › "Updates"; a release item in an administrator's `queue`. Wizard "Update your team's Civicsmith".

Content
- C1. Heading "Updates"; `updates.says` (2 sentences).
- C2. Section "Running now" (`updates.running.head`), help `.tip.running`: "Release {version} · installed {date}, allowed by {who}" (`updates.running.release`, or `.release_setup`, `.release_noactor`); "Last check for a new release: {when}" · "once a day; the check sends nothing about your team".
- C3. Section "How your copy is doing" (`.health.head`): button A5, then "The team's record answers", "A test file was written and read back", "Captured pages are not set up on this copy" (`.health.*`), note `.health.check.note` + `.check.next`, fold "When the check finds a problem"; button A6, then a row per part — "The assistant's worker", "Reading PDFs", "Reading text in images", "Reading spreadsheets", "The file scanner", "The assistant's runner" — with "release {version}" and "answering", "did not answer within 4 seconds", "not connected to your copy" or "answers under another name"; fold "Other things a part can show"; button A7, then "Heaviest so far: {peak} {unit}", "average {mean} {unit}", "measured over {samples} requests", note `.health.runtime.note`.
- C4. Section "Earlier releases" (`updates.earlier.head`), help `.tip.history`: "Release {version} · installed {date}, allowed by {who}" or "Release {version} · skipped {date} by {who}: “{reason}”".

| State | When | What shows |
|---|---|---|
| S1 A release ready; administrator not holding the Cloudflare account | a release ready | Section "Ready to install" (`updates.ready.head`): "Release {version} · {date}", mark "Security fix" for one (`updates.ready.security`), "signed by Civicsmith · signature checked"; "For members", "For administrators", "What an administrator must do" (`updates.notes.*`) and `updates.notes.plain`. "Pass it to whoever holds your Cloudflare account" (`updates.handoff.head`): `updates.handoff.says`, the link, `updates.handoff.for`, button "Copy the link"; button "Not now"; fold "Skip this version": `updates.skip.says`, field "Why skip it? (every administrator will see this)", button "Skip this version, with this reason". |
| S2 The same, seen by the holder | holds the Cloudflare account | As S1 with buttons "Update" and "Not now" in place of the hand-off. |
| S3 Nothing ready | the newest runs | "Ready to install" holds "Nothing to install. Your team's Civicsmith runs the newest release. When a new one is out, it appears here and in every administrator's queue." (`updates.none`). |
| S4 A member's view | not an administrator | Heading and `.admins` only. |

| Action | When | Leads to |
|---|---|---|
| A1. button "Update" (`updates.act.update`; act `updatestart`) | S2 | The installer's `update` page, set to that release, in a new tab. |
| A2. button "Not now" (`updatelater`) | S1, S2 | The release put aside for every administrator. |
| A3. button "Skip this version, with this reason" (`updateskip`) | S1, S2, with a reason | S3 or the next release; a "skipped" row in C4. |
| A4. button "Copy the link" | S1 | The link copied. |
| A5. button "Check your copy now" | always | C3's check lines. |
| A6. button "Show what each part runs" | always | C3's part rows. |
| A7. button "Show what running costs" | always | C3's work rows. |

---

## ties: "Your ties"

- **Address** `/app/ties`. **Who can see it** every member, own ties; the list is seen only by them and administrators.
- **Purpose** The member's own ties to people or organizations the team may look into, and how a case would disclose them.
- **Entry points** `settings` › "Yours" › "Your ties"; `account` › "Elsewhere in your settings". Wizard "Your ties".

Content
- C1. Heading "Your ties"; `.sub`.
- C2. Open fold `.summary` "Why you are asked, and who sees it · so readers can trust a case · only you and the administrators see this list": "Why you are asked" (`.why`) with 4 points (`.why.1`–`4`); "Who sees it" (`.who`) with `.who.1`–`3` and `.who.change`.
- C3. Section "Your ties" (`.list`): table "Kind", "Who", "A case would say"; each row "a case would say: “{says}”" or "a case would name me".
- C4. Section "Add a tie" (`.add`): choice "Kind": "Employer", "Relative", "A business I have an interest in", "Other"; field "Who" (`.whofield`); field "The tie, in your words" (`.note`, help `.note.help`); radios "If a case the team publishes concerns them, the case discloses this tie": "Naming me by my handle: “{handle}, who worked on this case, is {tie}.”", "Without naming me: “A member of the team who worked on this case is {tie}.”"; note `.either`; button A1.

| State | When | What shows |
|---|---|---|
| S1 Ties listed | ties declared | C1 to C4. |
| S2 None yet | none | C3: "Nothing is listed yet. Start with “Add this tie”: say who it is with, and how you want a case to name it." (`.first`). |

| Action | When | Leads to |
|---|---|---|
| A1. button "Add a tie" | always | The tie a row of C3. |
| A2. button "Remove a tie" | a tie's row | The row goes. |

| Form message | Condition | Message |
|---|---|---|
| V1. "Who", the tie | empty, A1 | "Name who the tie is with and describe it." (`.add.empty`) |

---

## notes: "Your notes"

- **Address** `/app/notes`. **Who can see it** every member, own notes; nobody else, administrators included.
- **Purpose** Private notes, kept, revised, deleted, or turned into an observation, a hunch or a question.
- **Entry points** `settings` › "Yours" › "Your notes"; `account` › "Elsewhere in your settings".

Content
- C1. Heading "Your notes"; "Only you can see these in your team." (`.private`); link "What this protects, and from whom" (`.protects.link`), showing `.protects` (3 sentences).
- C2. Field "New note" (`.new.field`); button A1.
- C3. Section "Kept" (`.kept.heading`): table "Note", "Kept"; each row's date with "only you", "revised {date}", or "turned into observation {id}" / "hunch {id}" / "question {id}" (`.turned.*`).
- C4. A row's panel: field "Your note" (`.revise.field`); buttons A2, A3; "Turn it into": "an observation", "a hunch", "a question"; field "The observation or question you made from it" (help `.turn.made.help`); for a hunch "For a hunch: the inquiry it belongs to", "For a hunch: what kind" ("a cause", "who someone is", "a relation", "a flow of money or things", "something else"), "For a hunch: what it is about"; button A4.
- C5. The first note kept while the team tells members what a court can reach: `.court` (3 sentences).
- C6. `AI` "Help me write this" under the note's field; its draft labelled "Draft · the assistant's, asked by {handle}" (`.draft.label`).

| State | When | What shows |
|---|---|---|
| S1 Notes kept | notes held | C1 to C4. |
| S2 None yet | none | C3: "You have kept no notes yet." (`.empty`). |
| S3 No AI account (the walk) | assistant unreachable | No C6. |

| Action | When | Leads to |
|---|---|---|
| A1. button "Write a note" | always | The note first in C3; C5 the first time. |
| A2. button "Revise your note" | row panel | "revised {date}". |
| A3. button "Delete your note" | row panel | The row goes. |
| A4. button "Turn a note into an observation, hunch or question" | row panel | "turned into … {id}"; the note stays private. |
| A5. `AI` button "Help me write this" | assistant reachable | A labelled draft in the field. |

| Form message | Condition | Message |
|---|---|---|
| V1. note | empty, A1/A2 | "Write the note first. Nothing was sent." (`.notext`) |
| V2. made id | empty, A4 | "Give the id of the observation or question you made. Nothing was sent." (`.turn.nomade`) |
| V3. hunch | no inquiry or subject, A4 | "A hunch names its inquiry and what it is about. Nothing was sent." (`.turn.incomplete`) |
| V4. hunch subject | not two records for a cause, identity or relation | "A cause, who someone is or a relation is about two records, from and to. Nothing was sent." (`.turn.pair`) |

---

## translations: "Translations"

- **Address** `/app/translations`; one language `/app/translations/<tag>`.
- **Who can see it** every member reads; a member granted a language translates it; an administrator grants, confirms and undoes.
- **Purpose** The words members see, in the team's languages.
- **Entry points** `settings` › "The team's" › "Translations". Wizard "Translate the interface".

Content
- C1. Heading "Translations".
- C2. Section "Your team's languages" (`.languages.heading`): each language a link; "Choose a language to see its words." (`.choose`).
- C3. Section "Who may translate {language}" (`.who`): granted members, "granted by {name}, {date}". Administrator: section "Who may translate" (`.grant.heading`): field "The member to grant {language} to (their id)", checkbox "Take the grant away instead", button A2.
- C4. Section "The words" (`.words.heading`): "Shown: {shown} · Awaiting a second check: {awaiting} · Not translated: {missing}" (`.counts`); table "English", "State", "Translation"; mark "protected"; states "not translated", "shown", "awaiting a second check"; "its English changed since"; "kept by {by}"; a local name "name kept; explanation translated".
- C5. A word's panel: field "Your translation" (help "Type the translation, keeping every {name} part as it is."); buttons A3, A4, A5.
- C6. Without the assistant: note `.typed.note` (2 sentences); with it, `.drafts.note` (3 sentences).
- C7. Notes `.marked.note` and `.localnames.note`.
- C8. `AI` Assistant reachable: words can be picked; button "Ask the assistant to draft the {n} missing" (`.draft.missing`); section "The assistant's drafts" (`.drafts`), each "Machine work · a draft, asked by {handle}"; administrator on an awaiting protected word: button "Read it back into English" (`.reading.ask`), its answer "Machine work · read back into English, asked by {handle}".

| State | When | What shows |
|---|---|---|
| S1 In use | a language besides English, chosen | C1 to C7. |
| S2 Only English | no other language | "Your team uses no language but English yet." (`.languages.none`); nothing else. |
| S3 No AI account (the walk) | assistant unreachable | No C8; C6 shows `.typed.note`. |

| Action | When | Leads to |
|---|---|---|
| A1. a language in C2 | S1 | `/app/translations/<tag>`. |
| A2. button "Give a member the grant for a language" | administrator | The member listed in C3 (or removed). |
| A3. button "Adopt a translation" | granted member | The word "shown", or "awaiting a second check" for a changed protected word. |
| A4. button "Confirm a protected word" | another granted speaker or an administrator | The word "shown". |
| A5. button "Undo a change" | administrator | The word as before. |
| A6. `AI` button "Ask the assistant to draft" (drawn with `.draft.missing`) | assistant reachable, words picked | Drafts listed, shown to no member until adopted. |

| Form message | Condition | Message |
|---|---|---|
| V1. member id | empty, A2 | "Name the member first. Nothing was sent." (`.grant.nomember`) |
| V2. translation | empty, no draft chosen, A3 | "Type a translation or choose a draft first. Nothing was sent." (`.text.none`) |
| V3. words | none picked, A6 | "Pick the words to draft first. Nothing was sent." (`.pick`) |

---

## wizards: "Wizards"

- **Address** `/app/wizards`. **Who can see it** every member; a team's own wizards are listed to their projects' owners and to administrators.
- **Purpose** The team's wizard library: Civicsmith's own, and the team's drafts, submitted and offered wizards.
- **Entry points** `settings` › "The team's" › "Wizards".

Content
- C1. Heading "Wizards".
- C2. Choice "Which wizards" (`.state.field`): "Offered to members", "Drafts", "Submitted for approval", "Withdrawn", "Retired", "Broken: no longer matching the screens", "Open proposals"; "Showing: {state}".
- C3. Table "Wizard", "Whose", "Based on", "Approved by", "Finished" (`.col.*`): "Civicsmith's", "This team's", "This team's, team-wide"; "Required"; "finished by {n}"; "Not a copy", "based on Civicsmith's “{name}”", "Based on a wizard you cannot see"; "Not approved yet"; version states "Draft", "Submitted", "Approved", "Updated by a newer version", "Withdrawn"; "version {n}"; `.broken`; "Retired: {reason}"; "Civicsmith's original changed since: see what changed".
- C4. A wizard's panel: button "See its steps", section "Its steps" ("On {screen}", "Why: {why}", "Side trip: {name}", `.steps.draft.*`). A Civicsmith wizard: `.civicsmith.only` and button "Copy a wizard to change it". A copy whose original changed: "What changed in {name}", "Your copy's steps", "The original's newer steps", button "Bring the change across"; approved: `.changes.newdraft`, button "Start a new draft of it".
- C5. Button A1.
- C6. Fold "Writing your own wizards" (`.own.fold`): `.own.says` (2 sentences); "Record a new wizard" (`.record.head`): `.record.intro` (2 sentences); fields "For which project", "Its name", "Why"; button A3. A draft's panel: "Change this draft" with "Step {n}: what the member does", "Step {n}: why", "Step {n}: its place in the list", "Remove step {n}", button "Save the changes"; buttons "Make it team-wide", "Withdraw this version", "Retire the wizard"; and A5 to A8. An open proposal: "Proposed: {why}", buttons "Draft a wizard from these steps", "Adopt these steps into a draft", field "Into which of your drafts".
- C7. Note `.copy.note` (3 sentences).

| State | When | What shows |
|---|---|---|
| S1 Offered to members | default | C1 to C7. |
| S2 Another state | chosen in C2 | That state's table; "Showing: {state}". |
| S3 Nothing to show | none in the state, or none visible | "No wizards to show here. Your team's wizards are listed to the owners of their projects and to administrators." (`.empty`). |

| Action | When | Leads to |
|---|---|---|
| A1. button "See the library" | always | S1. |
| A2. a choice in "Which wizards" | always | S2, read at once. |
| A3. button "Record a new wizard" (`wizarddraft`) | a project chosen | The guide in the dock records on the real screens; each act pressed is a step. |
| A4. button "Copy a wizard to change it" (`wizarddraft`) | a wizard's panel | A draft "based on Civicsmith's “{name}”" under "Drafts". |
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

---

## Differences seen in the code

Paths under `bio-plane/src/`. The design above stands; each line is where the code draws otherwise.

- `settings`: "How full your team's record is" is drawn on `group`, not on Settings (`screens-settings/group.mjs:254`; `screens-settings/settings.mjs:24-29`).
- `settings`: "For every member" also lists "Your team's own rules", and "Watched addresses" and "Leads" to those who may use them (`screens-settings/settings.mjs:29`).
- `members`: "More for administrators" links Your team, Places and offices and Recovery codes, not Places and offices and Security (`screens-settings/members.mjs:173`).
- `members`: a removal under way (S3) is drawn inside "What removing an administrator takes", not as its own view (`screens-settings/members.mjs:274-290`).
- `group-identity`: with the assistant reachable, the three questions and `.ask.intro` are drawn, not the explanation `.ask.what` (`screens-settings/identity.mjs:59-60`).
- `security`: no hour grid, totals, where from, "When you are told" or "What you can do" are drawn (`screens-settings/security.mjs`: no `heat.*`, `where.*`, `told.*`, `cando` key used).
- `connect`: "Check the connection" and its fold are not drawn (`screens-settings/connect.mjs:13-14`).
- `bias`: the four views are drawn as one page of four parts; the earlier-lens work is at `/app/bias/<run>` (`screens-settings/bias.mjs:1-8`).
- `recovery`: no section "If you lose your codes too" (`screens-settings/recovery.mjs`: no `lost.*` key used).
- `ties`: `.who.change` and the fold's summary `.summary` are not drawn (`screens-investigate/ties.mjs`: neither key used).
- `account`: the mockup draws one section "Password and signing key" (`screen.account.passwordkey.heading`) with the three buttons; the code draws "Your password" and "Your signing key" as two sections, both design word rows, which C7 and C8 follow (`screens-settings/account.mjs:98`, `:123`).
- `teamai`, `security`, `group`, `places`, `updates`: served to every member with a sentence saying whose screen it is, not the `unavailable` screen (`screens-settings/teamai.mjs:37`, `security.mjs:51`, `group.mjs:67`, `places.mjs:44`, `updates.mjs:34`).

## Changes

- 22 Nov 2026: written.
