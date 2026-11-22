Length: <N> lines. Last section: "Changes".

# Screens: The team and your account

Page `team-and-account` of the Screens document (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

The team, its members and its settings; a member's own account, ties, notes and recovery codes. What binds every screen (the frame, the rail, the assistant dock, refusals, accessibility, `unavailable`) is on the page "Every screen" and is not repeated here. Every screen on this page is in the working frame, opened from the rail's place Settings (`settings`), and needs a session; without one the shell shows `front` and keeps the address to return to.

Every screen's heading is its `screen.<id>.name` word, with its `screen.<id>.purpose` word as the heading's explanation. A button's words are `act.<op>.label.<id>` unless another key is named. The test data is the index's (team "Lakeshore Tenants", administrator Rosa, members Mai, Dev, Ana, Teo); names in the states below are examples of that data.

**The walk has no AI account.** On every screen here the assistant dock is absent, not greyed, and each control marked `AI` below is absent too: not drawn, not disabled.

## The screens on this page

| id | heading | address | built? |
|---|---|---|---|
| `group-identity` | "Who your team is" | `/app/group-identity` | built |
| `members` | "Members" | `/app/members`, a member `/app/members/<handle>` | built |
| `security` | "Security" | `/app/security` | built, in part |
| `account` | "Your account" | `/app/account` | built |
| `connect` | "The assistant" | `/app/connect` | built; superseded in the first beta by page `ai` |
| `teamai` | "The team's assistant" | `/app/teamai` | built; superseded in the first beta by page `ai` |
| `bias` | "Declared bias" | `/app/bias`, a work `/app/bias/<run>` | built |
| `places` | "Places and offices" | `/app/places` | built |
| `recovery` | "Recovery codes" | `/app/recovery` | built |
| `group` | "Your team" | `/app/group` | built |
| `settings` | "Settings" | `/app/settings` | built |
| `updates` | "Updates" | `/app/updates` | built |
| `ties` | "Your ties" | `/app/ties` | built |
| `notes` | "Your notes" | `/app/notes` | built |
| `translations` | "Translations" | `/app/translations`, a language `/app/translations/<tag>` | built |
| `wizards` | "Wizards" | `/app/wizards` | built |

---

## group-identity: "Who your team is"

- **Address.** `/app/group-identity`. **Frame.** working.
- **Who can see it.** Every member reads it. Only an administrator sees the form "Change it" and its acts.
- **Purpose.** Say what kind of team this is, what it focuses on, why it exists, and who sees that.
- **Entry points.** `settings`, section "The team's", link "Who your team is". The wizard "Say who your team is" starts here.

**Content**
- C1. Above the heading, one of: note "Your team's short name was recorded when Civicsmith was installed." (`screen.group-identity.seed.recorded`), or "Your team's short name is not recorded yet. Run the installer again: it asks for it once and records it." (`screen.group-identity.seed.unrecorded`). No field or act for the short name.
- C2. Heading "Who your team is" (`screen.group-identity.name`).
- C3. Line "About {name}." (`screen.group-identity.group`), with the team's display name.
- C4. Once the team has said who it is: section "Who your team is" (`screen.group-identity.now.heading`) with "What kind of team:" (`screen.group-identity.kinds`) and the kinds chosen; "What you focus on" (`screen.group-identity.focus.field`) and its text; "Why the team exists, in your own words" (`screen.group-identity.purpose.field`) and its text; then "Only members see this." (`screen.group-identity.visibility.members`) or "Members and the public see this." (`screen.group-identity.visibility.public`).
- C5. To an administrator, section "Change it" (`screen.group-identity.edit.heading`):
  - checkboxes "What kind of team" (`screen.group-identity.kinds.field`): "a professional group", "an issue group", "a community group", "a team for many things", "something else" (`screen.group-identity.kind.professional`, `.issue`, `.community`, `.catch-all`, `.other`);
  - field "Describe your kind of team, in a few words" (`screen.group-identity.other.field`), help `screen.group-identity.other.help` (examples; "it locks nothing");
  - field "What you focus on"; field "Why the team exists, in your own words";
  - radios "Who sees all of this" (`screen.group-identity.visibility.field`): "Members only" (`.visibility.choice.members`), "Also our public page and the network directory" (`.visibility.choice.public`);
  - button "Save who your team is, and who sees it".
- C6. `AI` While the assistant is reachable, under the form: explanation `screen.group-identity.ask.intro` (1 sentence: the assistant drafts from your answers; nothing is saved until you save it), fields "What does your team do?", "Who is in it, and who does it work for?", "Why did it start?" (`screen.group-identity.ask.q.what`, `.who`, `.why`), and button "Ask the assistant to help write it". A field it filled is labelled "Draft · the assistant's, asked by {handle}" (`screen.group-identity.draft.label`).

**States**

| State | When | What shows |
|---|---|---|
| S1 Short name recorded | The installer recorded the short name | C1's first note. |
| S2 Short name not recorded | An older installation | C1's second note, as a gap. |
| S3 Not said yet | No description saved | No section "Who your team is" (C4). A member who does not administer sees only C1 to C3. |
| S4 Assistant unreachable | No AI account (the walk) | C6 is absent; the rest as S1 or S2. |

**Actions**

| Control | When offered | Leads to |
|---|---|---|
| A1. button "Save who your team is, and who sees it" (`act.groupdescriptionset.label.group-identity`) | administrator | Same screen; C4 shows what was saved; any draft label goes. |
| A2. `AI` button "Ask the assistant to help write it" (`act.groupdescriptiondraft.label.group-identity`) | administrator, assistant reachable | Same screen; the focus and purpose fields fill, each labelled as C6. Nothing is saved. |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. the whole form | no kind ticked and every field empty, on A1 | the shell's "field needed" message naming "What you focus on" (`shell.field.needed`) |
| V2. the three questions | all empty, on A2 | "Answer at least one question first. Nothing was sent." (`screen.group-identity.ask.none`) |

---

## members: "Members"

- **Address.** `/app/members`; one member, with their row's panel open, `/app/members/<handle>`. **Frame.** working.
- **Who can see it.** Every member reads the roster. Only an administrator sees invitations, joining through the website, signing keys, the administrators' acts and the removal rule.
- **Purpose.** Everyone in the team and what each may do; administrators invite members and change what they may do.
- **Entry points.** `settings`, section "The team's", link "Members"; a member's name anywhere it is a reference opens `/app/members/<handle>`; `security`'s "What you can do" link "Members". The wizard "Invite a member" starts here.

**Content**
- C1. Heading "Members" (`screen.members.name`); line "Active members: {members} · Administrators: {administrators}" (`screen.members.count`).
- C2. The roster, one row per member, columns "Handle", "Cover", "Role", "May do", "Status", "Expertise" (`screen.members.col.handle`, `.col.cover`, `.col.role`, `.col.caps`, `.col.status`, `.col.expertise`). A member's view shows the member, "May do" and "Expertise" columns. Roles "administrator", "member" (`screen.members.role.admin`, `.role.member`). May do, by capability: "add and revise work", "sign and publish cases", "start projects", "look after the team's Civicsmith" (`screen.members.cap.contribute`, `.cap.publish`, `.cap.create_projects`, `.cap.administer`); for an administrator "all of it, as every administrator may" (`screen.members.cap.all`). Status: "invited", "proposed as an administrator, awaiting endorsement", "active", "inactive", "status not recorded" (`screen.members.status.*`). Expertise: "declared: {label}", "confirmed: {label}", or "No expertise declared." (`screen.members.expertise.*`).
- C3. The founder's row comes first. Before the founder chooses a handle it reads "The team's founder" (`member.founder.unnamed`); a member who has not joined reads "Not joined yet" (`screen.members.nohandle`).
- C4. To a member who does not administer, under the table: note "Administrators add members and change what each may do." (`screen.members.member.note`).
- C5. To an administrator while the team has one administrator: note "With one administrator, the team depends on that one person and the hosting account." (`screen.members.recovery.one`) (or "Your team has {administrators} administrators." `screen.members.recovery.many`), then "You hold recovery codes ({remaining} left)." or "You hold no recovery codes yet." (`screen.members.recovery.codes`, `.recovery.nocodes`), with link "Add a second administrator" (`screen.members.recovery.add`) and, with no codes, link "Get your recovery codes" (`screen.members.recovery.issue`).
- C6. To an administrator, each row's panel: an invited row's status "invitation not yet used", "invitation used", "invitation expired" or "invitation withdrawn" (`screen.members.invitation.*`); checkboxes "What {handle} may do" (`screen.members.caps.legend`); status sentence "Make {handle} inactive. Their past work stays in the record under their handle." or "Make {handle} active again." (`screen.members.status.to.revoked`, `.status.to.active`); for a proposed administrator "{handle} is proposed as an administrator. Your endorsement counts toward it." (`screen.members.endorse.what`); field "Why remove their administrator's powers? (every administrator will see this)" (`screen.members.remove.reason`). Fold "When confirming or withdrawing an expertise is refused" (`screen.members.expertise.refused.head`) holds three refusals (`screen.members.expertise.refused.admin`, `.refused.undeclared` + `.undeclared.next`, `.refused.state` + `.state.next`).
- C7. To an administrator, section "Invite a member" (`screen.members.invite.heading`): field "A short id for this invitation" (`screen.members.invite.id`), help `screen.members.invite.id.help`; field "The cover the team knows them by, not a legal name" (`screen.members.invite.cover`); checkboxes "What they may do" (`screen.members.invite.caps`); button "Create the invitation link" (`screen.members.invite.create`); note "Your team's Civicsmith sends no email. Copy the link and send it yourself. It works once and expires after seven days." (`screen.members.invite.noemail`). Ticking "look after the team's Civicsmith" draws the question "Propose {who} as an administrator?" (`screen.members.cap.administer.confirm.head`), explanation `screen.members.cap.administer.confirm` (5 sentences: what an administrator may do; every current administrator must agree), choices "Propose {who} as an administrator" and "Go back" (`.confirm.yes`, `.confirm.no`).
- C8. After an invitation is made: "The invitation for {handle}, shown this once. It works once and expires on {expires}." (`screen.members.invite.shown`) and the link. After a reset link is made: "The reset link for {handle}, shown this once. It works once and expires on {expires}." (`screen.members.reset.shown`) and "Your team's Civicsmith sends no email: give the link to them yourself, by a way you trust." (`screen.members.reset.noemail`).
- C9. To an administrator, section "Joining through your website" (`screen.members.website.heading`): explanation `screen.members.website.what` (2 sentences); fields "How many may join each day" (`screen.members.website.cap`) and "Days until it expires (1 to 30; seven if left empty)" (`screen.members.website.days`); buttons "Create a website key", "Turn on the reusable join link". After either: "The website key, shown this once. Put it in your website's settings." (`screen.members.website.keyshown`) or "The join link, shown this once. Anyone with it can ask to join." (`screen.members.website.linkshown`).
- C10. To an administrator, section "More for administrators" (`screen.members.more.heading`) with links "Places and offices" (`screen.places.name`) and "Security" (`screen.security.name`).
- C11. To an administrator, section "Signing keys" (`screen.members.keys.heading`): explanation `screen.members.a.signing.key.lets.a`, `.civicsmith.holds.only.the.public`, `.use.this.when.a.member`; one row per member: "key registered by {member}, {date}" (`screen.members.key.registered.by.rosa.3`) with button "Withdraw {handle}'s signing key" (`screen.members.signer.withdraw`); a withdrawn key "key withdrawn by {member}, {date}" · "it does not sign" (`screen.members.key.react.key.withdrawn.by.rosa.12`, `.key.react.it.does.not.sign`) with button "Reactivate {member}'s signing key" (`screen.members.key.react.reactivate.devs.signing.key`); or "no signing key yet" (`screen.members.no.signing.key.yet`). Then note `screen.members.key.react.withdraw.a.key.when.a` + `.key.react.a.key.a.member.withdrew`; choice "Whose key" (`screen.members.keys.whose`); field "Their public key" (`screen.members.keys.public`), help `screen.members.the.one.line.the.member` + `.it.is.the.public.half`; button "Register a key for this member"; note `screen.members.the.record.shows.that.you` + `.they.see.it.under.your`.
- C12. To an administrator, section "What removing an administrator takes" (`screen.members.what.removing.an.administrator.takes`): with one administrator, "With {n} administrator, no administrator can be removed by vote." + `screen.members.a.majority.that.leaves.out` + `.that.is.the.rule.holding`; fold "If more administrators can act than the roster lists" (`screen.members.founder.if.the.count.is.higher`, 3 sentences on the founder held through the hosting account); fold "How it changes with the number of administrators" (`screen.members.how.it.changes.with.the`) with a table "Administrators", "Votes it takes", "Who votes" (`screen.members.scale.head.*`) for 1 to 7, the team's row marked "(now)" (`screen.members.scale.now`), rows 1 and 2 "not removable" (`screen.members.scale.not_removable`), then the rule `screen.members.removal.takes.a.majority.of` + `.the.one.facing.removal.is` + `.a.lone.administrator.can.never`. Section help: `screen.members.the.team.s.own.rule.explain` + "Nothing here changes anything." (`screen.members.nothing.here.changes.anything.explain`).

**States**

| State | When | What shows |
|---|---|---|
| S1 As an administrator sees it | session administers | C1 to C3, C5 (while one administrator), C6 to C12. |
| S2 As a member sees it | session does not administer | C1, C2 as a table of member, "May do" and "Expertise", C4. No act. |
| S3 An administrator's removal under way | a removal has votes outstanding | Heading "Removing {member} as an administrator" (`screen.members.removing.teo.as.an.administrator`), "{n} administrators: {members}." (`screen.members.four.administrators.rosa.dev.ana`); section "What it takes" (`screen.members.removal.heading`): "This takes {n} of {total} administrators' votes." (`screen.members.this.takes.3.of.4`), "{member} is counted but doesn't vote, so the {n} who may vote must all agree." (`screen.members.teo.is.counted.but.doesn`); a row per administrator: "{member} · agreed" and its date, "{member} · hasn't voted yet" with "the removal waits for {member}", "{member} · faces removal" with "counted in the {n}, doesn't vote" (`screen.members.removal.agreed`, `.removal.notyet`, `.the.removal.waits.for.ana`, `.removal.faces`, `.counted.in.the.4.doesn`); "{n} of {total} have agreed so far." (`screen.members.2.of.3.have.agreed`); the scale fold as C12. |
| S4 Nobody else yet | the roster holds only the viewer | "Nobody is in the team yet but you." (`screen.members.empty`). |

**Actions**

| Control | When offered | Leads to |
|---|---|---|
| A1. button "Create the invitation link" (`screen.members.invite.create`, act `memberadd`) | administrator | Same screen; C8's invitation sentence and link; a row "invited" in C2. Beyond the second administrator, an administrator invitation is recorded as a proposal awaiting endorsement. |
| A2. button "Make a reset link for a member" (`act.owed_passwordresetlink.label.members`) | administrator, on a row's panel | Same screen; C8's reset sentences and link. |
| A3. button "Withdraw {handle}'s signing key" (act `signerset`) | administrator, on another member's held key | Same screen; that row reads "key withdrawn by …" with "Reactivate …". |
| A4. button "Reactivate {member}'s signing key" (act `signerset`) | administrator, on a withdrawn key of a current member | Same screen; the row reads "key registered …" again. |
| A5. button "Register a key for this member" (act `signeradd`) | administrator | Same screen; that member's row reads "key registered by {member}, {date}". |
| A6. button "Change what a member may do" (act `membercaps`) | administrator, on a row's panel | Same screen; the row's "May do" changes. |
| A7. button "Change a member's status" (act `memberset`) | administrator, on a row's panel | Same screen; the row's status reads "inactive" or "active". |
| A8. button "Endorse an administrator" (act `adminendorse`) | administrator, on a proposed administrator's row | Same screen; the row's status changes once every administrator has endorsed. |
| A9. button "Remove an administrator" (act `adminremove`); in S3 button "Agree: remove {member} as an administrator" (`screen.members.agree.remove.teo.as.administrator`) | administrator, with a reason | Same screen; S3 counts the vote. |
| A10. button "Confirm declared expertise" (act `expertiseconfirm`) | administrator, on a declared expertise | Same screen; the cell reads "confirmed: {label}". |
| A11. button "Withdraw an expertise" (`act.owed_expertisewithdraw.label.members`), help `screen.members.help.withdraw.what`, `.withdraw.again`, `.withdraw.record` | administrator, on a confirmed expertise | Same screen; the cell reads "No expertise declared." |
| A12. button "Withdraw an unused invitation" (act `invitewithdraw`) | administrator, on an unused invitation | Same screen; the row reads "invitation withdrawn". |
| A13. button "Create a website key" (act `websitekeycreate`) | administrator | Same screen; C9's key sentence and the key. |
| A14. button "Turn on the reusable join link" (act `joinlinkenable`) | administrator | Same screen; C9's link sentence and the link. |
| A15. links "Places and offices", "Security" (C10) | administrator | `places`, `security`. |
| A16. link "Get your recovery codes" (C5) | administrator without codes | `recovery`. |
| A17. a member's name | always | `/app/members/<handle>`, that row's panel open. |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. short id and cover | either empty, on A1 | "Give both a short id and the cover the team knows them by. Nothing was sent." (`screen.members.invite.incomplete`) |
| V2. "How many may join each day" | not a whole number of one or more, on A13 or A14 | "Say how many may join each day: a whole number, one or more. Nothing was sent." (`screen.members.website.nocap`) |
| V3. "Why remove their administrator's powers?" | empty or over 2,000 characters, on A9 | "Say why, in your own words, in at most 2,000 characters. Nothing was sent." (`screen.members.remove.noreason`) |

---

## security: "Security"

- **Address.** `/app/security`. **Frame.** working.
- **Who can see it.** Administrators. A member who does not administer sees the heading and only "Security is set by your team's administrators. Administrators: {admins}. Ask one of them about anything here." (`screen.security.admins`).
- **Purpose.** How hard the team's Civicsmith is being tried over a period, by kind and by hour, against its own usual; counts only.
- **Entry points.** `settings`, section "The team's", link "Security"; `members`, "More for administrators"; a security notice in an administrator's `queue` opens this screen at that period.

**Content**
- C1. Heading "Security" (`screen.security.name`); line "How hard your team's Civicsmith is being tried, against its usual. Only administrators see this." (`screen.security.sub`).
- C2. The period: fields "From" and "To" (`screen.security.from`, `.to`) and button "Show the level for a period"; fold "Dates in the wrong order" (`screen.security.period.bad.summary`) holding V1's message.
- C3. Section "How hard your team's Civicsmith was tried" (`screen.security.level.heading`): the level mark "Ordinary.", "Raised." or "High." (`screen.security.level.ordinary`, `.raised`, `.high`), its explanation `screen.security.risk.means.ordinary`; "From {from} to {to}." (`screen.security.period`); "{count} attempts, against {usual} usually." (`screen.security.total`).
- C4. Line "Files are checked. …" (`screen.security.files.on`, 3 sentences: the built-in scanner checks every file on arrival and weekly; a file not fetched by Civicsmith opens in the safe view until a deeper check passes).
- C5. Fold "The counts, by kind, hour and place" (`screen.security.counts.fold`):
  - section "By kind and by hour" (`screen.security.heat.heading`): a grid of 24 hours by kind, each square named in words (`screen.security.tip.hour_*`, `.tip.hour_usual`); key "at or below the usual", "up to {n} times the usual" (`screen.security.heat.usual`, `.heat.upto`); note `screen.security.heat.note`;
  - section "Totals for the period" (`screen.security.totals.heading`): table "Kind", "This period", "Usually" (`screen.security.col.kind`, `.col.count`, `.col.usual`), rows "Refused sign-ins", "Refused keys and links", "Requests over the limit", "Refused hand-overs", "Let through after a check" (`screen.security.kind.*`); note "Counts only. Nothing here says who tried, and nothing your team holds is shown." (`screen.security.totals.note`);
  - "Where from": bars by country, explained by `screen.security.where.what`; note `screen.security.where.note` (no address is kept; a member's own sign-ins are never placed).
- C6. Section "When you are told" (`screen.security.told.heading`): an example notice "sign-in refusals far above the usual and still going on, all refused so far" (`screen.security.notice.signin`) · "sent to administrators once, at {time}, when the level became high · not sent again while it lasted" (`screen.security.notice.sent`); note `screen.security.told.note`.
- C7. Section "What is installed" (`screen.security.parts.heading`): "File scanner", "Safe view" (`screen.security.part.scanner`, `.part.safeview`); "Files waiting to be scanned: {queued}. Files held: {held}." (`screen.security.queue`); button "Check for new signatures now".
- C8. Section "Your security tools" (`screen.security.tools.heading`): explanation `screen.security.tools.about`; table "Tool", "State", "Added", "What it does" (`screen.security.col.tool`, `.col.state`, `.col.added`, `.col.does`), states "added, not tested", "on", "off: its test failed", "off" (`screen.security.state.*`); or "Your team uses no security tool of its own." (`screen.security.tools.none`). Section "What happened to them" (`screen.security.events.heading`): events (`screen.security.event.*`) or "Nothing yet." (`screen.security.events.none`).
- C9. Fold "Add another checker (advanced)" (`screen.security.add.fold`) holding section "Tools you can add" (`screen.security.catalogue.heading`), or "No tool can be added just now." (`screen.security.catalogue.none`). Each tool's panel: "What it is sent", "Never sent", "Who receives it", "Where", "How long it keeps files", "How long it keeps results", "Whether it shares them" (`screen.security.h.*`); its config fields; where it keeps files, checkbox "I understand the vendor keeps the files it is sent" (`screen.security.keep`); for a tool on the organization's own servers, checkbox "Check every file, not only those a member asks about" (`screen.security.every`); buttons "Add a security tool", "Test a security tool", "Remove a security tool". Notes `screen.security.adding.private`, `screen.security.notoffered`, `screen.security.logsink`.
- C10. Section "What you can do" (`screen.security.cando.heading`): `screen.security.cando` (3 sentences), with "Your account" and "Members" as links.

**States**

| State | When | What shows |
|---|---|---|
| S1 A week with a hard try | the level was raised or high in the period | C3's mark "Raised." or "High."; "Someone tried hard to sign in on {when}. Every attempt was refused." (`screen.security.summary.signin`) and `screen.security.summary.detail` (3 sentences: how many times the usual, when it was high, nothing new was made). |
| S2 An ordinary week | around the usual | Mark "Ordinary."; "Nothing unusual. There is nothing for you to do." (`screen.security.ordinary.head`); "In the last {period} every kind of attempt stayed near your team's usual, and no new key, credential or administrator was made." (`screen.security.ordinary.line`). |
| S3 A member's view | session does not administer | Heading and `screen.security.admins` only. |
| S4 Scanner holds no signatures | the scan state answers none | C7 says so, with `screen.security.nosignatures.next`. |

**Actions**

| Control | When offered | Leads to |
|---|---|---|
| A1. button "Show the level for a period" (`act.securitymap.label.security`) | administrator | Same screen; C3 and C5 for the period chosen. |
| A2. button "Check for new signatures now" (`act.scanmirror.label.security`) | administrator | Same screen; "The scanner has been asked to check for new signatures. The result shows here once it has finished." (`screen.security.mirror.started`). |
| A3. button "Add a security tool" (`act.securitytooladd.label.security`) | administrator, in a tool's panel | Same screen; the tool's row in C8 "added, not tested"; an event in "What happened to them". |
| A4. button "Test a security tool" (`act.securitytooltest.label.security`) | administrator, on an added tool | Same screen; "The tool passed its test and is on." or "The tool stays off: {detail}" (`screen.security.tested.on`, `.tested.off`). |
| A5. button "Remove a security tool" (`act.securitytoolremove.label.security`) | administrator, on a tool held | Same screen; the row goes; an event "{tool} removed". |
| A6. links "Your account", "Members" (C10) | administrator | `account`, `members`. |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. "From", "To" | an end before the start, on A1 | "Choose a start and an end date, the start first. Nothing was read." (`screen.security.period.bad`) |
| V2. a tool's config field | empty, on A3 | "Fill in {field} first. Nothing was sent." (`screen.security.config.missing`) |

---

## account: "Your account"

- **Address.** `/app/account`. **Frame.** working.
- **Who can see it.** Every member, for their own account only.
- **Purpose.** The member's own settings: handle, password, signing key, language, cover name and expertise; signing out.
- **Entry points.** `settings`, section "Yours", link "Your account"; `security`'s "What you can do"; the shell's sign-out.

**Content**
- C1. Heading "Your account" (`screen.account.name`).
- C2. Section "Your handle" (`screen.account.handle.heading`): the handle, and "Your handle can't be changed: it names your work for good, and no one else can ever take it." (`handle.fixed`). No act changes it.
- C3. Section "Language and appearance" (`screen.account.language.heading`): "Your screens use {language}." or "Your screens follow your device's setting." (`screen.account.language.now`, `.language.device`); choice "Your language" (`screen.account.language.field`), help `screen.account.language.help`; choice "Appearance" (`shell.appearance`): "Follow my device", "Light", "Dark" (`shell.appearance.device`, `.light`, `.dark`); choice "Explanations" (`screen.account.level.field`), help `screen.account.explain.help`; choice "Sounds" (`screen.account.sounds`): "Off", "On" (`screen.account.sounds.off`, `.sounds.on`), help `screen.account.sounds.help`.
- C4. Section "Your cover name" (`screen.account.pairing.head`): "Your team knows you as {cover}, your cover, and your work shows your handle, {handle}." (`screen.account.pairing.says`), "Choose whether the two are published together." (`screen.account.pairing.choose`); radios "Who can see which cover goes with your handle" (`screen.account.pairing.legend`): `screen.account.pairing.private`, `screen.account.pairing.public`; button "Save my choice" (`screen.account.pairing.save`); note `screen.account.pairing.change` + `screen.account.pairing.undone`.
- C5. Section "What you know" (`screen.account.expertise.heading`): "You have declared no expertise.", "Declared: {label}" or "Confirmed by an administrator: {label}" (`screen.account.expertise.none`, `.declared`, `.confirmed`); field "Your expertise (optional)" (`screen.account.expertise.field`), help `screen.account.expertise.help`; button "Declare your expertise".
- C6. Section "Signing out" (`screen.account.signout.heading`): buttons "Sign out on this device", "Sign out everywhere"; note `screen.account.signout.note`.
- C7. Section "Your password" (`screen.account.password.heading`): fields "Your current password", "A new password" (help "At least 12 characters. A short sentence you can remember works well."), "Type it again" (`screen.account.password.current`, `.password.new`, `.password.help`, `.password.again`); button "Change your password".
- C8. Section "Your signing key" (`screen.account.key.heading`): "Key ending {key}, registered {date}" (`screen.account.key.held`), or for a key an administrator registered "registered for you by {member}, an administrator, on {date}." and "Only you can sign with it; revoke it here if it isn't yours." (`screen.account.registered.for.you.by.rosa`, `.only.you.can.sign.with`); or "You have no signing key registered." (`screen.account.key.none`). Button "Revoke your signing key" on a held key.
- C9. With no key: section "Make your signing key" (`screen.account.key.make.heading`): `screen.account.key.help` (3 sentences); checkbox `signing.ceremony.keepkey`; field "A passphrase for the key file (optional)" (`screen.account.key.passphrase`), help `screen.account.key.passphrase.help`; button "Register your signing key".
- C10. Section "Elsewhere in your settings" (`screen.account.elsewhere.heading`): links "The assistant", "Your ties", "Your notes", "Glossary" (`screen.connect.name`, `screen.ties.name`, `screen.notes.name`, `screen.glossary.name`).

**States**

| State | When | What shows |
|---|---|---|
| S1 The page as usual | always | C1 to C10. |
| S2 A newer version is live | the release served is newer than the page loaded | The update band, and note "Reloading brings in the newest version. It changes only the program in your browser, never your team's record." (`screen.account.update.note`). |
| S3 Making your signing key | just after A8 | Section "Your key is made" (`screen.account.key.made.heading`): "Key ending {key}, registered {date}", the public line, `screen.account.key.save` (1 sentence: save the file now; no one can recover it), buttons "Save the key file" and "Copy the public line" (`screen.account.key.savefile`, `.key.copyline`), and `screen.account.key.lost`. |
| S4 Key declined | the browser made no key | "No key was made, so nothing was registered." (`screen.account.key.declined`). |

**Actions**

| Control | When offered | Leads to |
|---|---|---|
| A1. button "Choose your language" (act `memberlanguageset`) | always | Same screen, redrawn in that language; C3's line names it. |
| A2. "Explanations" choice (act `infolevelset`, "Choose how much is explained") | always | Same screen; explanations open after the chosen pause. |
| A3. button "Save my choice" (act `memberpairingset`) | always | Same screen; the radio chosen stays ticked after a reload. |
| A4. button "Declare your expertise" (act `expertisedeclare`) | always | Same screen; C5 reads "Declared: {label}". |
| A5. button "Sign out on this device" (act `signout`) | always | `front`, signed out. |
| A6. button "Sign out everywhere" (act `signouteverywhere`) | always | `front`, signed out; every other session of the member ends. |
| A7. button "Change your password" (act `setpassword`) | always | Same screen; "Your password is changed. Every other session signed in as you has ended." (`screen.account.password.changed`). |
| A8. button "Register your signing key" (act `signerregisterown`) | no key held | S3. |
| A9. button "Revoke your signing key" (act `signerrevokeown`) | a key held | Same screen; C8 reads "You have no signing key registered." and C9 shows. |
| A10. links in C10 | always | `connect`, `ties`, `notes`, `glossary`. |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. "A new password", "Type it again" | not the same, on A7 | "The two new passwords are not the same. Type them again. Nothing was sent." (`screen.account.password.differ`) |
| V2. "Your expertise (optional)" | empty, on A4 | "Say what you know first. Nothing was sent." (`screen.account.expertise.nolabel`) |

---

## connect: "The assistant"

- **Address.** `/app/connect`. **Frame.** working.
- **Superseded.** This is the earlier "connect your Claude account" screen. In the first beta, the page `ai` takes its place for AI providers: a member's own AI is `aimine` ("Your AI"), and connecting an AI is `aiconnect` (DEC-420). This section describes `connect` as built.
- **Who can see it.** Every member, for their own account.
- **Purpose.** Whether and how the assistant serves the member: on the team's key, their own Claude account, or not at all; their limit and their use.
- **Entry points.** `settings`, section "Yours", link "The assistant"; `account`, "Elsewhere in your settings". The wizard "Connect your Claude account" starts here.

**Content**
- C1. Heading "The assistant" (`screen.connect.name`); line "Optional. Everything in your team's Civicsmith works without the assistant." (`screen.connect.optional`).
- C2. One card saying what serves the member: exactly one of S1 to S6's first lines.
- C3. Below it, parts that open and close, each with its heading and a line beneath (listed per state).
- C4. At the foot (every state but S6): fold "Which account pays, and when" (`screen.connect.whopays.summary`) holding `ai.whopays` (3 sentences: a project's account, else the member's own, else the team's key; a limit stops the act and says whose).

**States**

| State | When | What shows |
|---|---|---|
| S1 The team's key serves you; no account of your own | the team's key is on, the member has none | Card "The assistant serves you on the team's API key." (`screen.connect.group`) and "The team pays, up to {limit} for each member, a limit your administrators set." (`screen.connect.group.allowance`); meter "Today on the team's key, your share of it" (`screen.connect.meter.groupshare`); where a project has its own account "In {project}, the project's own account serves you instead." (`screen.connect.project.serves`). Parts: "Before your first question" · "Read once: what happens to what you ask." (`screen.connect.notice.heading`, `.part.notice.why`) with the mark "Outward · leaves your team's Civicsmith" (`screen.connect.outward`), `screen.connect.notice.group` and button "I have read this" (`screen.connect.read.button`); "Your daily allowance" · "Set by your administrators." (`screen.connect.part.allowance`, `.why`) with `screen.connect.grouplimits`, `screen.connect.group.allowance.reached`, "Suggestions: {suggestions}." (`screen.connect.grouplimits.suggestions`); "Your use" · "Only you see this." (`screen.connect.part.use`, `.why`); "Connect your own account (optional)" (`screen.connect.own.heading`) · `screen.connect.own.instead`, holding the connecting form of S5. |
| S2 You connected your own API key | the member holds an API key | Card `screen.connect.own.apikey` with mark "Connected" (`screen.connect.connected`); "Connected since {date}." (`screen.connect.own.since`). Parts: "What the assistant may do for you" · "Everyday help is on. Switch off anything you'd rather do yourself." (`screen.connect.part.uses`, `.why`) with switch groups "Everyday help" and "Without being asked" (`screen.connect.uses.everyday`, `.uses.unasked`), help `screen.connect.uses.unasked.help`; "A limit, if you want one" · "None set: only Anthropic's own spending limit on your key applies." (`screen.connect.part.limit`, `.limit.why.apikey`) with the limit form ("Per" "day"/"month", fold "More choices", `screen.connect.limit.*`) and `screen.connect.limit.binds`; "Your use" with table headed "Last 30 days" (`screen.connect.use.last30`), meter "Today on your own account" (`screen.connect.meter.own`), note `screen.connect.use.note`; "Disconnect" (`screen.connect.disconnect.heading`) · "If you disconnect it, the team's API key serves you instead." (`screen.connect.own.thengroup`) with button "Disconnect your API key" (`screen.connect.disconnect.button`). |
| S3 You signed in with your Claude subscription | the member's subscription is connected | Card `screen.connect.own.subscription` with mark "Connected"; "Anthropic accepts it until {date}." "Then you sign in again here." (`screen.connect.own.until`, `.own.until.again`). Parts as S2, with the limit line "None set: only your plan's own allowance applies." (`screen.connect.part.limit.why.subscription`), units tokens or calls only, use row "On your subscription" (`screen.connect.use.subscription`), and button "Disconnect your subscription" (`screen.connect.disconnect.subscription`). `not built`: button "Check the connection" (`screen.connect.check`), its help and fold "If the check stops" (`screen.connect.check.ifstops`). |
| S4 Your sign-in has expired | Anthropic stopped accepting it | Card "Your Claude sign-in has expired, on {date}." (`screen.connect.expired`) with mark "Expired" (`screen.connect.expired.state`), `screen.connect.expired.means`, `screen.connect.expired.next`, and button "Open Anthropic's sign-in page". |
| S5 The team doesn't pay; members bring their own | no team key on, no account of the member's | Card "The assistant isn't serving you yet. Your team doesn't pay for the assistant; if you want it, connect your own account below, or skip it." (`screen.connect.none`). Parts: "Before you connect" · "Read once: what connecting means." (`screen.connect.part.before`, `.why`) with the outward mark, `screen.connect.disclosure.own`, `screen.connect.disclosure.then` and button "I have read this"; then "Connect your own account (optional)": radios "How do you want to connect the assistant?" (`screen.connect.way.field`): "My Claude subscription (Pro or Max)" · "Billed to you by Anthropic, not your team.", "My own Claude API key" · "Anthropic bills you for each use.", "Not now" (`screen.connect.way.*`). Subscription: section "With your Claude subscription (Pro or Max)" (`screen.connect.signin.heading`), four numbered steps (`screen.connect.signin.step1` to `.step4`), button "Open Anthropic's sign-in page", field "The code from Anthropic's page" (`screen.connect.signin.code`), help `screen.connect.signin.help`, button "Connect with this code" (`screen.connect.signin.withcode`), folds "If you signed in a while ago, it asks for your password first" (`screen.connect.reauth.summary`) and the refusals, with `screen.connect.refusal.reference`. API key: section "With your own Claude API key" (`screen.connect.apikey.heading`), field "Your API key" (`screen.connect.apikey.field`), help `screen.connect.apikey.help`, button "Connect with this key" (`screen.connect.apikey.connect`). Not now: "Or skip it: everything in your team's Civicsmith works without the assistant, and you can connect later." (`screen.connect.skip`). |
| S6 The team keeps its material away from AI | an administrator turned it on | Card `screen.connect.keptaway` with the reason quoted, then `screen.connect.keptaway.ask`. No part, no act. If that setting could not be read: `screen.connect.keptaway.unread`. |
| S7 Sign-in state unreadable | the sign-in state read failed | `screen.connect.signin.statefailed`; never drawn as not connected. |
| S8 Without an AI account (the walk) | no team key and no member account | S5. The subscription way is offered only while the sign-in part is installed; otherwise the API key and "Not now" alone. |

**Actions**

| Control | When offered | Leads to |
|---|---|---|
| A1. button "I have read this" (`screen.connect.read.button`, act `groupkeynoticeseen`) | S1, until read | Same screen; the part closes as read. |
| A2. button "I have read this" (act `disclosureshown`) | S1's own-account part, S5, until read | Same screen; the ways to connect show. |
| A3. button "Open Anthropic's sign-in page" (`act.subscriptionsignin.label.connect`) | S4, S5's subscription way | Anthropic's sign-in page in a new tab; this screen stays. |
| A4. button "Connect with this code" (act `subscriptionsignin`) | S5's subscription way | S3. |
| A5. button "Go on" (`act.reauth.label.connect`) | a password asked again | Does the act asked for, once. |
| A6. button "Connect with this key" (act `accountreferenceset`) | S5's API-key way | S2. |
| A7. switches in "What the assistant may do for you" (act `accountusesset`) | S2, S3 | Same screen; the switch shows on or off. |
| A8. limit form's button (act `ailimitset`, "Set a limit on your account") | S2, S3 | Same screen; the limit is listed. |
| A9. button "Disconnect your API key" (act `accountreferenceremove`) | S2 | S1 or S5. |
| A10. button "Disconnect your subscription" (act `subscriptiondisconnect`) | S3 | S1 or S5. |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. "The code from Anthropic's page" | empty, on A4 | "Paste the code from Anthropic's page first. Nothing was sent." (`screen.connect.signin.nocode`) |
| V2. "Your API key" | empty, on A6 | "Paste your API key first. Nothing was sent." (`screen.connect.apikey.nokey`) |
| V3. the code | refused by the plane | the words of `screen.connect.refused.<CODE>`, one of: `RUNNER_NOT_CONFIGURED`, `RUNNER_NOT_STARTED`, `RUNNER_SILENT`, `AGENT_WORKER_SILENT`, `ATTEMPT_SUPERSEDED`, `NOT_THIS_MEMBER`, `BAD_CODE`, `BAD_REQUEST`, `SIGNIN_NOT_HELD`, `SIGNIN_TOKEN_REFUSED`, `SIGNOUT_FAILED`, `AI_KEPT_AWAY`, with the shell's reference |

---

## teamai: "The team's assistant"

- **Address.** `/app/teamai`. **Frame.** working.
- **Superseded.** In the first beta, "AI providers" (`aiproviders`, page `ai`) takes its place (DEC-420). This section describes `teamai` as built.
- **Who can see it.** Administrators. A member who does not administer sees the heading and only the purpose sentence `screen.teamai.purpose`.
- **Purpose.** The team's API key, what it pays for, its limits, its use summed over members, and keeping the team's material away from AI.
- **Entry points.** `settings`, section "The team's", link "The team's assistant".

**Content**
- C1. Heading "The team's assistant" (`screen.teamai.name`); line "The team's API key serves members who have no account of their own." (`screen.teamai.sub`).
- C2. A card: "The team's API key is held and on." (`screen.teamai.held`) with mark "On" (`screen.teamai.on`) and "{who} set it on {date}." (`screen.teamai.setby`); meter "This month on the team's key" (`ai.usage.meter.month_group`). With a key held and off: "Held · off · set by {by}, {date}" (`screen.members.key.heldoff`).
- C3. Part "What this account pays for" (`screen.panel.uses.heading`) · "Everyday help is {everyday}; exploring is {explore}." (`screen.teamai.uses.why`): each use with on or off and its switch; choice of exploring.
- C4. Part "Limits on this account" (`screen.panel.limits.heading`) · "{overall} overall; {each} for each member." or "None set." (`screen.teamai.limits.why`, `.limits.none`): a table of limits and one form.
- C5. Part "This month's use" (`screen.panel.usage.heading`) · "Summed over members; nobody is named." (`screen.teamai.use.why`).
- C6. Part "Keeping our material away from AI" (`screen.members.keepaway.heading`) · "Off. Members may use the team's key, a project's account or their own." or "On. {by} turned this on on {date}, and gave this reason:" (`screen.members.keepaway.off`, `.keepaway.on`); explanation `act.aikeepaway.does`; checkboxes "Keep our material away from AI" (`screen.members.keepaway.which`) with "For every use" or "Only for these uses" (`.keepaway.all`, `.keepaway.some`) and "The uses" (`.keepaway.uses`); field "Why (every member will see this)" (`.keepaway.reason`); buttons "Save" and, when on, "Turn it off" (`.keepaway.save`, `.keepaway.turnoff`).
- C7. Part "The key itself" (`screen.teamai.key`) · "Replace it, switch it off or remove it." (`screen.teamai.key.why`): field "The team's Anthropic API key" (`screen.members.key.field`); buttons "Replace the key" (`screen.members.key.replace`), "Switch it on" or "Switch it off" (`screen.members.key.switchon`, `.key.switchoff`), "Remove the key".
- C8. Part "Changes" (`screen.panel.changes.heading`) · "Every change, with who made it and when." (`screen.teamai.changes.why`).
- C9. Fold "Which account pays, and when" (`screen.connect.whopays.summary`) holding `ai.whopays`.

**States**

| State | When | What shows |
|---|---|---|
| S1 Key held and on | the usual state the design draws | C1 to C9. |
| S2 No key held (the walk) | no team key | Card "No key is held. Members bring their own account, or use your team's Civicsmith without the assistant." (`screen.members.key.none`); C7 offers the field and "Hold the team's API key"; no switch on or off, no "Remove the key". |
| S3 A member's view | session does not administer | Heading and `screen.teamai.purpose` only. |
| S4 Keep-away unreadable | that read failed | C6 reads "Whether the team keeps its material away from AI couldn't be read just now." (`screen.members.keepaway.unread`). |

**Actions**

| Control | When offered | Leads to |
|---|---|---|
| A1. button "Hold the team's API key" (`act.groupkeyset.label.teamai`); with a key held "Replace the key" | administrator | Same screen; C2 reads held; the key is never drawn again. |
| A2. button "Switch it on" / "Switch it off" (act `groupkeyswitch`) | a key held | Same screen; C2's mark changes. |
| A3. switches and "Set what the team's key pays for" (act `accountusesset`) | a key held | Same screen; the use reads on or off. |
| A4. limit form's button "Set a limit on the team's key" (act `ailimitset`) | a key held | Same screen; the limit row is listed; a change in C8. |
| A5. button "Remove the key" (`act.groupkeyremove.label.teamai`, "Remove the team's key") | a key held | S2. |
| A6. button "Save" (act `aikeepaway`, "Keep the team's material away from AI, with a reason") | administrator | Same screen; C6 reads "On. …" with the reason; `connect` shows its S6 to every member. |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. "The team's Anthropic API key" | empty, on A1 | "Paste the key first. Nothing was sent." (`screen.members.key.nokey`) |
| V2. "Why (every member will see this)" | empty or over 2,000 characters, on A6 | "Give your reason, in 1 to 2,000 characters. Nothing was sent." (`screen.members.keepaway.noreason`) |
| V3. "The uses" | "Only for these uses" with none ticked, on A6 | "Choose at least one use, or keep it for every use. Nothing was sent." (`screen.members.keepaway.nouses`) |
| V4. the limit form | an amount, unit or switch value refused | `ai.refused.limitinvalid`, `ai.refused.unitunavailable`, `ai.refused.switchvalue` |

---

## bias: "Declared bias"

- **Address.** `/app/bias`; a work made under an earlier lens, `/app/bias/<run>`. **Frame.** working.
- **Who can see it.** Every member reads and writes sets. An administrator adopts for the whole team; a project's owner adopts for that project.
- **Purpose.** The lens the team reads evidence through, stated so a reader can discount it; it never blocks work.
- **Entry points.** `settings`, section "For every member", link "Declared bias"; the `queue`, when a lens changes under work already made (S4).

**Content**
- C1. Heading "Declared bias" (`screen.bias.name`); line `screen.bias.the_lens_your_team_reads` + "It never blocks work." (`screen.bias.it_never_blocks_work`).
- C2. Choice "Whose lens" (`screen.bias.lens.label`): "The whole team" (`screen.bias.lens.team`) or a project; button "Show the lens in force".
- C3. Section "In force for {project}" (`screen.bias.in_force_for_the_coliseum`) or "In force for the whole team" (`screen.bias.head.team`), help `screen.bias.the_statements_in_force_for` + `.a_project_statement_can_replace`: each statement's kind ("Scrutiny", "Inference", "Pattern", `screen.bias.kind.*`), "about {subject}" (`screen.bias.row.about`), the statement, "Why: {reason}" (`screen.bias.row.why`), and "the team's, locked" or "this project's" (`screen.bias.row.team_locked`, `.row.project`). Then "Adopted" lines (`screen.bias.by_admin_for_the_team`, `.by_admin_for_the_team.team`, `.by_admin_for_the_team.project`); "What this set does not enforce" (`screen.bias.what_this_set_does_not`) and its text; "Lens" (`screen.bias.dt.lens`), its number, `screen.bias.the_same_lens_gives_the`.
- C4. Folds "When a project statement meets a locked one" (`screen.bias.when_a_project_statement_meets`; 2 sentences) and "When an adopted set is only offered" (`screen.bias.when_an_adopted_set_is`; 2 sentences); note `screen.bias.to_adopt_write_or_draft` + `.your_queue_tells_you_when`.

**States**

| State | When | What shows |
|---|---|---|
| S1 The lens in force (a project) | a project chosen and a lens adopted | C1 to C4 for the project: the team's statements, then the project's. |
| S2 Writing and adopting a set | the member writes a set | Heading "Write a set" (`screen.bias.head.write`), `screen.bias.a_set_is_a_list` + `.a_set_stays_a_draft`; fields "Name of the set" (`screen.bias.name_of_the_set`); radios "Kind of statement" (`screen.bias.kind.label`): `screen.bias.scrutiny_how_closely_we_read`, `.inference_what_we_do_not`, `.pattern_how_a_source_has` (help `.a_pattern_statement_must_cite`); "Who or what it is about" (`screen.bias.who_or_what_it_is`); "The statement" (`screen.bias.statement.label`, help `.say_how_you_read_it` + `.do_not_say_a_source`); "Why you read it this way" (`screen.bias.why_you_read_it_this`, help "Required for every statement."); "What it cites" (`screen.bias.cites.label`, help `.required_for_a_pattern_statement`); "What this set does not enforce" (help `.required_before_the_set_is` + `.readers_see_it_beside_the`); button "Save the set and offer it for adoption"; fold "When a set cannot be saved" (`screen.bias.when_a_set_cannot_be`). Section "Adopt it" (`screen.bias.head.adopt`), help `.adopting_puts_a_lens_in` + `.only_a_member_does_it`: radios "Adopt it for" (`screen.bias.adoptfor.label`): "The whole team (an administrator adopts)", "One project: {project} (its owners adopt)"; field "Why you adopt it" (help `.required_up_to_characters` + `.it_is_kept_with_the`); button "Adopt this set"; small print `.adopting_names_the_revision_in`, `.later_changes_to_the_set`, `.adopting_a_different_set_for`; fold "When you cannot adopt it" (`screen.bias.when_you_cannot_adopt_it`). `AI` button "Help me write this" under the statement fields. |
| S3 A set drafted from an outside policy | the member pastes a policy | Heading "Draft a set from an outside policy" (`screen.bias.draft_a_set_from_an`), `.paste_another_organizations_policy`, `.civicsmith_proposes_statements_from_it`, `.nothing_is_saved_offered_or`; fields "The policy, in its own words", "Where it comes from" (help `.kept_with_the_set_so`), "When you read it"; button "Propose statements from it". After it: section "Proposed statements" (`screen.bias.head.proposed`), each "Proposed, not yet yours." "Choose who it is about and write why."; "It read {read} of {of} sentences." and `.a_pattern_statement_is_never`; button "Start a set from these" (`screen.bias.start_a_set_from_these`); section "Left out" (`screen.bias.head.left_out`): "A bar" / "A verdict" (`screen.bias.dt.bar`, `.dt.verdict`) with why; note `.nothing_was_saved_offered_or` + `.starting_a_set_from_these`. |
| S4 Work made under an earlier lens | `/app/bias/<run>` | Heading "Work made under an earlier lens" (`screen.bias.work_made_under_an_earlier`), `.your_teams_lens_changed_after`, `.say_whether_the_change_bears`, `.it_is_disclosed_to_readers`; section "Waiting for your word" (`screen.bias.waiting_for_your_word`): the work, `screen.bias.earlier.made`, button "Show its record"; field "Your reason" (help `.required_up_to_characters2`, `.say_why_the_lens_change`, `.this_is_the_whole_of`); button "Settle it, with your reason"; `.this_cannot_be_undone_your`, `.the_assistant_cannot_settle_it`, `.if_you_would_rather_re`; fold "When it cannot be settled"; section "Settled" (`screen.bias.head.settled`): `screen.bias.earlier.settled`. |
| S5 No lens in force | nothing adopted for the choice | "No lens is in force for {project}." (`screen.bias.no_lens_is_in_force`), "A case published now says that your team declared none." (`screen.bias.a_case_published_now_says`); links "Write a set · …" and "Draft one from an outside policy · …" (`screen.bias.link.write`, `.link.draft`). |
| S6 The whole team's lens | "The whole team" chosen | C3 headed "In force for the whole team", the team's statements only. |
| S7 Assistant unreachable (the walk) | no AI account | As above, without "Help me write this". |

**Actions**

| Control | When offered | Leads to |
|---|---|---|
| A1. button "Show the lens in force" (`act.biasmanifest.label.bias`) | always | Same screen; S1, S5 or S6 for the choice. |
| A2. button "Save the set and offer it for adoption" (`act.promote.label.bias`); "Start a set from these" (act `promote`) | S2; S3 after proposals | Same screen; the set is listed as offered, adoptable. |
| A3. button "Adopt this set" (`act.biasadopt.label.bias`) | an offered set; administrator for the team, owner for a project | S1 or S6 showing the set in force. |
| A4. button "Propose statements from it" (`act.biasinhale.label.bias`) | S3 | Same screen; "Proposed statements" and "Left out". Nothing saved. |
| A5. button "Show its record" (`act.biasdebt.label.bias`) | S4 | Same screen; the work's record. |
| A6. button "Settle it, with your reason" (`act.biasdebtresolve.label.bias`) | S4, with a reason | Same screen; the work moves to "Settled". |
| A7. `AI` button "Help me write this" (`act.writinghelp.label.bias`) | assistant reachable | Same screen; a draft in the field, labelled. |
| A8. links "Write a set", "Draft one from an outside policy" | S5 | S2, S3. |

**Form messages** (refusals, each in a fold under its act)

| Field | Condition | Message |
|---|---|---|
| V1. a statement | says a source is false, calls a speaker a liar, or sets a bar, on A2 | `screen.bias.a_statement_in_it_says` + "Reword that statement to say how you read the source, and offer the set again." (`screen.bias.reword_that_statement_to_say`) |
| V2. a statement | no reason, or a pattern citing nothing, on A2 | "A statement has no reason, or a pattern statement cites nothing." + "Add what it asks for and offer the set again." (`screen.bias.a_statement_has_no_reason`, `.add_what_it_asks_for`) |
| V3. "Adopt it for" | the whole team, by a non-administrator, on A3 | "Only an administrator adopts a set for the whole team." "Ask one, or adopt it for a project you own." (`screen.bias.only_an_administrator_adopts_a`, `.ask_one_or_adopt_it`) |
| V4. "Adopt it for" | a project, by a non-owner | "Only an owner of a project adopts a set for it." "Ask one of its owners: {owners}." (`screen.bias.only_an_owner_of_a`, `.ask_one_of_its_owners`) |
| V5. the set | not offered yet, on A3 | "The set must be offered for adoption first." "Save it and offer it, then adopt it." (`screen.bias.the_set_must_be_offered`, `.save_it_and_offer_it`) |
| V6. "Your reason" | empty, on A6 | "You gave no reason." "Write why the change does not bear on this work, then settle it." (`screen.bias.you_gave_no_reason`, `.write_why_the_change_does`) |
| V7. the work | settled already or not visible, on A6 | `screen.bias.someone_settled_it_already_or` + "Open your queue to see what is left." (`screen.bias.open_your_queue_to_see`) |

---

## places: "Places and offices"

- **Address.** `/app/places`. **Frame.** working.
- **Who can see it.** Every member reads it; a member who does not administer sees "Administrators choose these; you can read them here." (`screen.places.admins`) under the heading, and no act but those on the team's own rules.
- **Purpose.** The places whose rules the team's Civicsmith follows, and the offices, seats and courts the team deals with.
- **Entry points.** `settings`, section "The team's", link "Places and offices"; `members`, "More for administrators".

**Content**
- C1. Heading "Places and offices" (`screen.places.name`); line `screen.places.sub`.
- C2. Section "The places whose rules apply" (`screen.places.profiles.heading`): "The places, read in this order" (`screen.places.profiles.field`), help `screen.places.profiles.help`; warning `screen.places.profiles.warning`; button "Choose the places whose rules apply". With none chosen: `screen.places.profiles.none`. Where places disagree: "The places chosen disagree on {n} facts; each is left unread rather than chosen between." (`screen.places.profiles.conflicts`).
- C3. Section "A place not listed yet" (`screen.places.wanted.heading`): "You named {name} on {date}." or "No place is named." (`screen.places.wanted.now`, `.wanted.none`); "{profile} is now held and may be the place you named." (`screen.places.wanted.match`); field "A place you want that isn't listed (optional)" (`screen.places.wanted.field`), help `screen.places.wanted.help`; button "Save the place you want".
- C4. Section "Where else to go" (`places.elsewhere.head`), help `places.elsewhere.help`: `places.elsewhere.says` (2 sentences); link "See the list" (`places.elsewhere.open`). With none listed: `places.elsewhere.none`.
- C5. Section "Offices and seats" (`screen.places.offices.heading`): each office with its holder, marked "from your places' rules" or "added by your team" (`screen.places.offices.seeded`, `.offices.bygroup`); an office a member named and no administrator confirmed carries its mark and button "Confirm this office"; confirmed: "This office is confirmed." (`screen.places.office.confirmed`). Note `screen.places.offices.note`. Or "No offices are held yet." (`screen.places.offices.none`). Buttons "Fill in the offices again", and under "Change the offices" (`screen.places.add.heading`) fields "The office's name" and "Who or what this office is" (`screen.places.add.label`, `.add.note`; help `.add.help`) with button "Add an office yourself".
- C6. Section "Courts" (`screen.places.courts`): each court, "from your place's rules" or "added by {name} on {date}" (`screen.places.court.seeded`, `.court.added`).
- C7. Section "Your team's own rules" (`screen.grouprules.name`): `screen.places.rules.note`; link "Your team's own rules".

**States**

| State | When | What shows |
|---|---|---|
| S1 A state with a profile | a held place is chosen | C1 to C7. |
| S2 A state with no profile | a place named and no profile held | Section "No profile for {state} yet" (`screen.places.noprofile.heading`): `screen.places.noprofile.says`, `.noprofile.offers`, `.noprofile.still` + `.noprofile.asks`; field "Tell us the place you want" (`screen.places.noprofile.want`), help `.noprofile.want.help`; button "Save the place you want"; then C7. No C4, C5, C6. |
| S3 A member's view | session does not administer | `screen.places.admins`; the sections read-only. |
| S4 Offices partly read | a later page of offices failed | "The rest of the offices couldn't be read just now." (`screen.places.offices.rest`). |

**Actions**

| Control | When offered | Leads to |
|---|---|---|
| A1. button "Choose the places whose rules apply" (`act.profilesset.label.places`) | administrator | Same screen; C2 lists the places chosen. |
| A2. button "Save the place you want" (`act.placewanted.label.places`) | administrator | Same screen; "You named {name} on {date}." |
| A3. button "Fill in the offices again" (`act.officesseed.label.places`) | administrator | Same screen; "Filled in: {seeded} new, {already} already held, {unseeded} that couldn't be." (`screen.places.seeded`). |
| A4. button "Add an office yourself" (`act.entitycreate.label.places`) | administrator | Same screen; the office listed "added by your team". Adding a court: "Added the court: {name}." (`screen.places.court.done`). |
| A5. button "Confirm this office" (`act.officeconfirm.label.places`) | administrator, on an office a member named | Same screen; "This office is confirmed." |
| A6. link "See the list" | a profile active | `elsewhere`. |
| A7. link "Your team's own rules" | always | `grouprules`. |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. "The office's name", "Who or what this office is" | either empty, on A4 | "Give both the office's name and what it is. Nothing was sent." (`screen.places.add.incomplete`) |

---

## recovery: "Recovery codes"

- **Address.** `/app/recovery`. **Frame.** working.
- **Who can see it.** Every member, for their own codes.
- **Purpose.** The member's own one-time recovery codes: how many are left, and getting new ones.
- **Entry points.** `settings`, section "Yours", link "Recovery codes"; `members`, link "Get your recovery codes" (C5 there).

**Content**
- C1. Heading "Recovery codes" (`screen.recovery.name`); line `screen.recovery.sub` (3 sentences: a code sets a new password; each works once; every member has their own).
- C2. Section "Your codes" (`screen.recovery.held.heading`): "You hold recovery codes: {remaining} of {total} unused, issued {date}." (`screen.recovery.held`), or "Every code issued on {date} is used." (`screen.recovery.spent`), or "You hold no recovery codes yet." (`screen.recovery.none`); then `screen.recovery.onlyyou` (3 sentences: shown once, to you alone; cannot be shown again; get new ones if not kept).
- C3. Section "New codes" (`screen.recovery.issue.heading`): `screen.recovery.spends` (2 sentences: new codes spend every earlier unused one; shown once); button "Get new recovery codes".
- C4. Section "If you lose your codes too" (`screen.recovery.lost.heading`): `screen.recovery.lost.what` (2 sentences: a reset link from an administrator; a second administrator is worth having).

**States**

| State | When | What shows |
|---|---|---|
| S1 Codes held | the member holds codes | C1 to C4, C2 with the count. |
| S2 New codes just issued | after A1 | "Save these now: they are shown only this once. Keep them somewhere only you can reach, apart from your password. Civicsmith keeps only a fingerprint of each, so it can never show them again." (`screen.recovery.shown`) and the ten codes. After leaving the screen they are not shown again. |
| S3 None held | no codes issued, or all used | C2 reads `screen.recovery.none` or `screen.recovery.spent`. |

**Actions**

| Control | When offered | Leads to |
|---|---|---|
| A1. button "Get new recovery codes" (`act.recoverycodesissue.label.recovery`) | always | S2; C2 then reads "{total} of {total} unused" after a reload. |

---

## group: "Your team"

- **Address.** `/app/group`. **Frame.** working.
- **Who can see it.** Every member reads it; a member who does not administer sees "These are your team's settings. Administrators change them; you can read them here." (`screen.group.admins`) and no act.
- **Purpose.** The settings chosen at setup, changeable here: name and logo, website, languages, time zone, the court notice, the hosting account's holder, a copy of the record, what the team has at stake, the team's bar.
- **Entry points.** `settings`, section "The team's", link "Your team".

**Content**
- C1. Heading "Your team" (`screen.group.name`); line "Administrators only. The settings chosen at setup, all changeable here." (`screen.group.sub`).
- C2. Section "Name and logo" (`screen.group.name.heading`): "Your team is called {name}." or `screen.group.name.none`; field "The team's name" (`screen.group.name.field`), help `screen.group.name.help`; button "Save the name"; fold "Saving the same name" (`screen.group.name.same.summary`). "Your team has a logo." or "Your team has no logo; its name is shown alone." (`screen.group.logo.set`, `.logo.none`); field "A new logo" (`screen.group.logo.field`), help "A PNG or JPEG image, at most 200 KB." (`screen.group.logo.help`); button "Change the logo".
- C3. Section "Website" (`screen.group.domain.heading`): "{domain}, verified on {date}.", "{domain}, not verified yet." or "No website is recorded." (`screen.group.domain.verified`, `.unverified`, `.none`); the last check's verdict (`screen.group.domain.verdict.absent`, `.mismatched`, `.undetermined`) and "Checked {date} at {time}." (`screen.group.domain.checked`); field "Your team's web address" (`screen.group.domain.field`), help `screen.group.domain.help`; button "Verify the website".
- C4. Section "Languages" (`screen.group.languages.heading`): "Your members use: {languages}." or `screen.group.languages.none`; checkboxes "The languages" (`screen.group.languages.field`), help "Tick from 1 to 20 languages your members use."; button "Save the languages".
- C5. Section "Time zone" (`screen.group.timezone`): "{zone}, from {profile}" or "{zone}, corrected by your team" (`screen.group.timezone.governs.profile`, `.governs.local`); a choice of zone, help `screen.group.timezone.help`; fields "How you checked it" and "Where you checked it" (`screen.group.timezone.how`, `.timezone.source`), each help beginning "Required."; button "Correct the time zone"; folds "When two places give different zones" (`screen.group.timezone.two.summary`, holding `screen.group.timezone.two`) and "When your team's time zone isn't set" (`screen.group.timezone.none.summary`, holding "No time zone is held yet. Choose one below.").
- C6. Section "The court notice" (`screen.group.court.heading`): `screen.group.court.says`; "Members are told what a court order could reach." or "Members are not told what a court order could reach." (`screen.group.court.tell`, `.court.dont`); checkbox "Show members the notice, before their first note and in their settings" (`screen.group.court.show`); button "Show the court notice".
- C7. Section "The hosting account" (`screen.group.hosting.heading`): `screen.group.hosting.says`; "Recorded by {by} on {date}:" (or `.hosting.now.setup`, `.hosting.now.system`, `.hosting.now.date`) and the holder, or "Nobody has recorded who holds the hosting account." (`screen.group.hosting.none`); fields "Who holds it", "A note (optional)" (`screen.group.hosting.field`, `.hosting.note`); button "Record who holds the hosting account".
- C8. Section "A copy of your team's record" (`screen.group.export.head`): `screen.group.export.says`; field "Why you are taking it (optional)" (`screen.group.export.note.label`), help `.export.note.help` + "Anything past 280 characters is cut."; button "Take a copy of the record"; "Taking a copy cannot be undone." + `screen.group.export.undone.why`; fold "When taking a copy is refused" (`screen.group.export.refused.head`): "Only the founder can take a copy." "Ask the founder to take it."; button "Show the list of copies"; the list, newest first, each with date, counts and words, and "Up to 200 are shown; if more exist, the list says so." (`screen.group.export.log.cap`).
- C9. Section "What the team has at stake" (`stake.group.title`): field "The team's statement" (`stake.group.label`), help `stake.group.help`; button "Save the statement" (`act.declaredstakeset.label.group`).
- C10. Section "The team's bar" (`screen.group.bar.heading`): "Capture at least {capture}, connection at least {connection}, set on {date}:" or "Your team has set no bar." (`screen.group.bar.now`, `.bar.none`); choices "Capture" and "Connection" (`screen.group.bar.capture`, `.bar.connection`) each with "No bar" (`.bar.unset`); field "Why (every member will see this)" (`screen.group.bar.reason`); button "Set the team's bar".
- C11. `AI` button "Help me write this" under the statement of C9, while the assistant is reachable.

**States.** One. The screen has no view the design switches between; each section shows its value or its "none" line as listed. Without an AI account (the walk), C11 is absent. A member who does not administer sees `screen.group.admins` and the values, with no field or act.

**Actions**

| Control | When offered | Leads to |
|---|---|---|
| A1. button "Save the name" (`act.groupnameset.label.group`) | administrator | Same screen; "Saved. Your team is now called {name}." (`screen.group.name.saved`); the same name: "That's already your team's name, so nothing changed." (`screen.group.name.same`). |
| A2. button "Change the logo" (`act.grouplogoset.label.group`) | administrator | Same screen; "Your team has a logo."; the logo in the frame. |
| A3. button "Verify the website" (`act.groupdomainset.label.group`) | administrator | Same screen; C3's line and verdict. |
| A4. button "Save the languages" (`act.grouplanguagesset.label.group`) | administrator | Same screen; "Your members use: {languages}." |
| A5. button "Correct the time zone" (`act.factconfirm.label.group`) | administrator | Same screen; "Your team's time zone is now {zone}." (`screen.group.timezone.saved`). |
| A6. button "Show the court notice" (`act.courtnoticeset.label.group`) | administrator | Same screen; C6's line changes. |
| A7. button "Record who holds the hosting account" (`act.hostingaccessset.label.group`) | administrator | Same screen; "Recorded by {by} on {date}:" and the holder. |
| A8. button "Take a copy of the record" (`act.export.label.group`) | administrator; refused to all but the founder | The copy is saved; a row is added to the list. |
| A9. button "Show the list of copies" (`act.exportlog.label.group`) | administrator | Same screen; the list. |
| A10. button "Save the statement" (`act.declaredstakeset.label.group`) | administrator | Same screen; the statement with who set it and when. |
| A11. button "Set the team's bar" (`act.strengthbarset.label.group`) | administrator, with a reason | Same screen; C10's line. |
| A12. `AI` button "Help me write this" (`act.writinghelp.label.group`) | assistant reachable | Same screen; a labelled draft in the statement field. |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. "The team's name" | empty, on A1 | "Give the name first. Nothing was sent." (`screen.group.name.empty`) |
| V2. "A new logo" | no file / not PNG or JPEG / over 200 KB, on A2 | "Choose the image first. Nothing was sent." / "That isn't a PNG or JPEG image. Nothing was sent." / "That image is larger than 200 KB. Nothing was sent." (`screen.group.logo.nofile`, `.logo.type`, `.logo.size`) |
| V3. "Your team's web address" | empty, on A3 | "Give the web address first. Nothing was sent." (`screen.group.domain.empty`) |
| V4. "The languages" | none or over 20 ticked, on A4 | "Tick from 1 to 20 languages. Nothing was sent." (`screen.group.languages.count`) |
| V5. "Who holds it" | empty, on A7 | "Say who holds it first. Nothing was sent." (`screen.group.hosting.empty`) |
| V6. "Capture", "Connection" | neither chosen, on A11 | "Choose a grade for capture, connection or both. Nothing was sent." (`screen.group.bar.nograde`) |
| V7. "Why (every member will see this)" | empty or over 2,000 characters, on A11 | "Say why, in 1 to 2,000 characters. Nothing was sent." (`screen.group.bar.noreason`) |

---

## settings: "Settings"

- **Address.** `/app/settings`; the rail's place Settings. **Frame.** working.
- **Who can see it.** Every member; the section "The team's" only to an administrator.
- **Purpose.** Every setting in one list: the member's own first, then the team's.
- **Entry points.** The rail's (or, on a phone, More's) place Settings; Home's area block Administration.

**Content**
- C1. Heading "Settings" (`screen.settings.name`); line "Your own settings first; then the team's, which only administrators change." (`screen.settings.sub`).
- C2. Section "Yours" (`screen.settings.yours`): links, each its screen's name with its purpose beneath: "Your account", "The assistant", "Your ties", "Your notes", "Recovery codes".
- C3. To an administrator, section "How full your team's record is" (`screen.settings.storage.head`): "{used} of {limit} ({pct}%)" (`screen.settings.storage.used`) and `screen.settings.storage.what`; from 70%, `screen.settings.storage.warn70`; fold "When it passes 90%, or its size isn't known" (`screen.settings.storage.more`) holding `screen.settings.storage.warn90` and `screen.settings.storage.unknown`; note `screen.settings.storage.factors`.
- C4. To an administrator, section "The team's" (`screen.settings.groups`): links "Your team", "Who your team is", "Members", "The team's assistant", "Places and offices", "Security", "Updates", "Translations", "Wizards", each with its purpose.
- C5. Section "For every member" (`screen.settings.everyone`): link "Declared bias" with its purpose.

**States**

| State | When | What shows |
|---|---|---|
| S1 An administrator's | session administers | C1 to C5. |
| S2 A member's | session does not administer | C1, C2, C5. No C3, no C4. |

**Actions**

| Control | When offered | Leads to |
|---|---|---|
| A1. each link in C2, C4, C5 | as its section | That screen: `account`, `connect`, `ties`, `notes`, `recovery`; `group`, `group-identity`, `members`, `teamai`, `places`, `security`, `updates`, `translations`, `wizards`; `bias`. |

---

## updates: "Updates"

- **Address.** `/app/updates`. **Frame.** working.
- **Who can see it.** Administrators; it is listed in `settings` only to them. A member who opens the address sees the heading and only "Only your team's administrators install updates. Administrators: {admins}. If something needs updating, ask one of them." (`screen.updates.admins`).
- **Purpose.** The release the team's Civicsmith runs, the release ready to install and what changes in it, and the choice: Update, Not now, or Skip this version.
- **Entry points.** `settings`, section "The team's", link "Updates"; a new-release item in an administrator's `queue`. The wizard "Update your team's Civicsmith" starts here.

**Content**
- C1. Heading "Updates" (`screen.updates.name`); line `updates.says` (2 sentences: checked once a day; nothing installed until an administrator chooses).
- C2. Section "Running now" (`updates.running.head`), help `screen.updates.tip.running`: "Release {version} · installed {date}, allowed by {who}" (`updates.running.release`; or `.release_setup`, `.release_noactor`); "Last check for a new release: {when}" · "once a day; the check sends nothing about your team" (`updates.running.checked`, `.checked_note`).
- C3. Section "How your copy is doing" (`screen.updates.health.head`), help `screen.updates.health.help`: button "Check your copy now"; after it, lines "The team's record answers", "A test file was written and read back", "Captured pages are not set up on this copy" (`screen.updates.health.store`, `.file.test`, `.captures.off`); note `screen.updates.health.check.note` + `.check.next`; fold "When the check finds a problem" (`screen.updates.health.refused.head`). Button "Show what each part runs"; after it, a row per part ("The assistant's worker", "Reading PDFs", "Reading text in images", "Reading spreadsheets", "The file scanner", "The assistant's runner", `screen.updates.health.part.*`) with "release {version}" and "answering", "did not answer within 4 seconds", "not connected to your copy" or "answers under another name"; note `.parts.note` + `.parts.next`; fold "Other things a part can show" (`.part.other`). Button "Show what running costs"; after it, "Heaviest so far: {peak} {unit}", "average {mean} {unit}", "measured over {samples} requests" (`.runtime.heaviest`, `.runtime.average`, `.runtime.samples`); note `.runtime.note`.
- C4. Section "Earlier releases" (`updates.earlier.head`), help `screen.updates.tip.history`: "Release {version} · installed {date}, allowed by {who}" or "Release {version} · skipped {date} by {who}: “{reason}”" (`updates.earlier.installed`, `.earlier.skipped`).

**States**

| State | When | What shows |
|---|---|---|
| S1 A release ready; an administrator who does not hold the Cloudflare account | a release ready | Section "Ready to install" (`updates.ready.head`): "Release {version} · {date}" (`updates.ready.release`), for a security fix the mark "Security fix" (`updates.ready.security`, explained by `.security_says`), "signed by Civicsmith · signature checked" (`updates.ready.signed`); notes "For members", "For administrators", "What an administrator must do" (`updates.notes.*`) and `updates.notes.plain`. Then "Pass it to whoever holds your Cloudflare account" (`updates.handoff.head`): `updates.handoff.says`, the link, `updates.handoff.for`, button "Copy the link" (`updates.handoff.copy`); button "Not now"; fold "Skip this version" (`updates.act.skip`): `updates.skip.says`, field "Why skip it? (every administrator will see this)" (`updates.skip.why`), button "Skip this version, with this reason" (`updates.act.skip_with_reason`). |
| S2 The same, seen by the holder | the administrator holds the Cloudflare account | As S1, with buttons "Update" (help `updates.act.update_does`) and "Not now" (help `updates.act.later_does`) in place of the hand-off. |
| S3 Nothing ready | the newest release runs | "Ready to install" holds "Nothing to install. Your team's Civicsmith runs the newest release. When a new one is out, it appears here and in every administrator's queue." (`updates.none`). |
| S4 A member's view | session does not administer | Heading and `screen.updates.admins` only. |

**Actions**

| Control | When offered | Leads to |
|---|---|---|
| A1. button "Update" (`updates.act.update`; registry `act.owed_updatestart.label.updates`) | S2 | The installer's update page (`update`), set to that release, in a new tab. |
| A2. button "Not now" (`updates.act.later`) | S1, S2 | Same screen; the release is put aside for every administrator. |
| A3. button "Skip this version, with this reason" (`updates.act.skip_with_reason`) | S1, S2, with a reason | Same screen; S3 or the next release; a "skipped" row in C4. |
| A4. button "Copy the link" (`updates.handoff.copy`) | S1 | The link is copied; the screen does not change. |
| A5. button "Check your copy now" (`act.selftest.label.updates`) | always | Same screen; C3's check lines. |
| A6. button "Show what each part runs" (`act.bootstrap.label.updates`) | always | Same screen; C3's part rows. |
| A7. button "Show what running costs" (`act.runtime.label.updates`) | always | Same screen; C3's work rows. |

---

## ties: "Your ties"

- **Address.** `/app/ties`. **Frame.** working.
- **Who can see it.** Every member, for their own ties. The list is seen only by the member and the administrators.
- **Purpose.** The member's own ties to people or organizations the team may look into, and how a case would disclose them.
- **Entry points.** `settings`, section "Yours", link "Your ties"; `account`, "Elsewhere in your settings". The wizard "Your ties" starts here.

**Content**
- C1. Heading "Your ties" (`screen.ties.name`); line `screen.ties.sub`.
- C2. An open fold "Why you are asked, and who sees it · so readers can trust a case · only you and the administrators see this list" (`screen.ties.summary`): "Why you are asked" (`screen.ties.why`) with four points (`screen.ties.why.1` to `.why.4`); "Who sees it" (`screen.ties.who`) with points `screen.ties.who.1` to `.who.3` and `screen.ties.who.change`.
- C3. Section "Your ties" (`screen.ties.list`): table "Kind", "Who", "A case would say" (`screen.ties.col.kind`, `.col.who`, `.col.disclosed`); each row "a case would say: “{says}”" or "a case would name me" (`screen.ties.row.says`, `.row.named`).
- C4. Section "Add a tie" (`screen.ties.add`): choice "Kind" (`screen.ties.kind`): "Employer", "Relative", "A business I have an interest in", "Other" (`screen.ties.kind.*`); field "Who" (`screen.ties.whofield`); field "The tie, in your words" (`screen.ties.note`), help `screen.ties.note.help`; radios "If a case the team publishes concerns them, the case discloses this tie" (`screen.ties.says`): "Naming me by my handle: “{handle}, who worked on this case, is {tie}.”" and "Without naming me: “A member of the team who worked on this case is {tie}.”" (`screen.ties.says.name.choice`, `.says.group.choice`); note `screen.ties.either`; button "Add a tie".

**States**

| State | When | What shows |
|---|---|---|
| S1 Ties listed | the member has declared ties | C1 to C4. |
| S2 None yet | no tie declared | C3 holds "Nothing is listed yet. Start with “Add this tie”: say who it is with, and how you want a case to name it." (`screen.ties.first`). |

**Actions**

| Control | When offered | Leads to |
|---|---|---|
| A1. button "Add a tie" (`act.declaretie.label.ties`) | always | Same screen; the tie is a row of C3. |
| A2. button "Remove a tie" (`act.withdrawtie.label.ties`) | on a tie's row | Same screen; the row goes. |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. "Who", "The tie, in your words" | empty, on A1 | "Name who the tie is with and describe it." (`screen.ties.add.empty`) |

---

## notes: "Your notes"

- **Address.** `/app/notes`. **Frame.** working.
- **Who can see it.** Every member, for their own notes; nobody else in the team, administrators included.
- **Purpose.** A member's private notes, kept, revised, deleted, or turned into an observation, a hunch or a question.
- **Entry points.** `settings`, section "Yours", link "Your notes"; `account`, "Elsewhere in your settings".

**Content**
- C1. Heading "Your notes" (`screen.notes.name`); line "Only you can see these in your team." (`screen.notes.private`) and link "What this protects, and from whom" (`screen.notes.protects.link`), which shows `screen.notes.protects` (3 sentences).
- C2. Field "New note" (`screen.notes.new.field`); button "Write a note".
- C3. Section "Kept" (`screen.notes.kept.heading`): table "Note", "Kept" (`screen.notes.col.note`, `.col.when`); each row's date with "only you" (`screen.notes.onlyyou`), "revised {date}" (`screen.notes.revised`), or "turned into observation {id}", "turned into hunch {id}", "turned into question {id}" (`screen.notes.turned.*`).
- C4. A row's panel: field "Your note" (`screen.notes.revise.field`), buttons "Revise your note" and "Delete your note"; "Turn it into" (`screen.notes.turn.into`): "an observation", "a hunch", "a question" (`screen.notes.turn.observation`, `.turn.hunch`, `.turn.question`); field "The observation or question you made from it" (`screen.notes.turn.made`, help `.turn.made.help`); for a hunch, "For a hunch: the inquiry it belongs to" (`.turn.inquiry`, help `.turn.inquiry.help`), "For a hunch: what kind" (`.turn.kind`: "a cause", "who someone is", "a relation", "a flow of money or things", "something else"), "For a hunch: what it is about" (`.turn.about`, help `.turn.about.help`); button "Turn a note into an observation, hunch or question".
- C5. The first time a member keeps a note while the team tells members what a court can reach: `screen.notes.court` (3 sentences).
- C6. `AI` button "Help me write this" under the note's field, while the assistant is reachable; a draft it writes is labelled "Draft · the assistant's, asked by {handle}" (`screen.notes.draft.label`).

**States**

| State | When | What shows |
|---|---|---|
| S1 Notes kept | the member has notes | C1 to C4. |
| S2 None yet | no note kept | C3 holds "You have kept no notes yet." (`screen.notes.empty`). |
| S3 Assistant unreachable (the walk) | no AI account | C6 absent. |

**Actions**

| Control | When offered | Leads to |
|---|---|---|
| A1. button "Write a note" (`act.notewrite.label.notes`) | always | Same screen; the note is the first row of C3; C5 the first time. |
| A2. button "Revise your note" (`act.noterevise.label.notes`) | a row's panel | Same screen; the row reads "revised {date}". |
| A3. button "Delete your note" (`act.notedelete.label.notes`) | a row's panel | Same screen; the row goes. |
| A4. button "Turn a note into an observation, hunch or question" (`act.noteturn.label.notes`) | a row's panel | Same screen; the row reads "turned into … {id}"; the note stays private. |
| A5. `AI` button "Help me write this" (`act.writinghelp.label.notes`) | assistant reachable | Same screen; a labelled draft in the field. |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. "New note", "Your note" | empty, on A1 or A2 | "Write the note first. Nothing was sent." (`screen.notes.notext`) |
| V2. "The observation or question you made from it" | empty, on A4 for an observation or question | "Give the id of the observation or question you made. Nothing was sent." (`screen.notes.turn.nomade`) |
| V3. the hunch fields | no inquiry or nothing it is about, on A4 | "A hunch names its inquiry and what it is about. Nothing was sent." (`screen.notes.turn.incomplete`) |
| V4. "For a hunch: what it is about" | not two records for a cause, who someone is or a relation | "A cause, who someone is or a relation is about two records, from and to. Nothing was sent." (`screen.notes.turn.pair`) |

---

## translations: "Translations"

- **Address.** `/app/translations`; one language, `/app/translations/<tag>`. **Frame.** working.
- **Who can see it.** Every member reads it. A member given the grant for a language translates it; an administrator grants, confirms and undoes.
- **Purpose.** The words members see, in the team's languages: translated by granted members, drafted by the assistant where it can, protected words checked twice.
- **Entry points.** `settings`, section "The team's", link "Translations". The wizard "Translate the interface" starts here.

**Content**
- C1. Heading "Translations" (`screen.translations.name`).
- C2. Section "Your team's languages" (`screen.translations.languages.heading`): the team's languages, each a link to its words; "Choose a language to see its words." (`screen.translations.choose`).
- C3. Section "Who may translate {language}" (`screen.translations.who`): each granted member with "granted by {name}, {date}" (`screen.translations.grantedby`); to an administrator, section "Who may translate" (`screen.translations.grant.heading`): field "The member to grant {language} to (their id)" (`screen.translations.grant.member`), checkbox "Take the grant away instead" (`screen.translations.grant.revoke`), button "Give a member the grant for a language".
- C4. Section "The words" (`screen.translations.words.heading`): "Shown: {shown} · Awaiting a second check: {awaiting} · Not translated: {missing}" (`screen.translations.counts`); table "English", "State", "Translation" (`screen.translations.col.en`, `.col.state`, `.col.text`); marks "protected" (`screen.translations.protected`); states "not translated", "shown", "awaiting a second check" (`screen.translations.state.*`); "its English changed since" (`screen.translations.changed`); "kept by {by}" (`screen.translations.adopted`); a local name "name kept; explanation translated" (`screen.translations.localname`).
- C5. A word's panel: field "Your translation" (`screen.translations.text.field`), help "Type the translation, keeping every {name} part as it is." (`screen.translations.text.help`); buttons "Adopt a translation", "Confirm a protected word" (an awaiting protected word, by another granted speaker or an administrator), "Undo a change" (an administrator).
- C6. Note, without the assistant: `screen.translations.typed.note` (2 sentences). With it: `screen.translations.drafts.note` (3 sentences).
- C7. Notes `screen.translations.marked.note` (marked wrong by members) and `screen.translations.localnames.note` (local names).
- C8. `AI` While the assistant is reachable: the words can be picked; button "Ask the assistant to draft the {n} missing" (`screen.translations.draft.missing`); section "The assistant's drafts" (`screen.translations.drafts`), each labelled "Machine work · a draft, asked by {handle}" (`screen.translations.draft.label`), the field help then `screen.translations.text.help.draft`; to an administrator on an awaiting protected word, button "Read it back into English" (`screen.translations.reading.ask`), its answer labelled `screen.translations.reading.label`.

**States**

| State | When | What shows |
|---|---|---|
| S1 The screen in use | the team has a language besides English, one chosen | C1 to C7. |
| S2 A team that uses only English | no other language | "Your team uses no language but English yet." (`screen.translations.languages.none`); no C3 to C7. |
| S3 Assistant unreachable (the walk) | no AI account | C8 absent; C6 shows `screen.translations.typed.note`. |

**Actions**

| Control | When offered | Leads to |
|---|---|---|
| A1. a language in C2 | S1 | `/app/translations/<tag>`, its words. |
| A2. button "Give a member the grant for a language" (`act.translationgrant.label.translations`) | administrator | Same screen; the member listed in C3 (or removed, with "Take the grant away instead"). |
| A3. button "Adopt a translation" (`act.translationadopt.label.translations`) | a granted member, on a word | Same screen; the word "shown", or "awaiting a second check" for a protected word changed. |
| A4. button "Confirm a protected word" (`act.translationconfirm.label.translations`) | another granted speaker or an administrator, on an awaiting protected word | Same screen; the word "shown". |
| A5. button "Undo a change" (`act.translationrevert.label.translations`) | administrator | Same screen; the word as it was before. |
| A6. `AI` button "Ask the assistant to draft" (`act.translationdraft.label.translations`; drawn as C8's words) | assistant reachable, words picked | Same screen; drafts listed, shown to no member until adopted. |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. "The member to grant {language} to (their id)" | empty, on A2 | "Name the member first. Nothing was sent." (`screen.translations.grant.nomember`) |
| V2. "Your translation" | empty and no draft chosen, on A3 | "Type a translation or choose a draft first. Nothing was sent." (`screen.translations.text.none`) |
| V3. the word list | nothing picked, on A6 | "Pick the words to draft first. Nothing was sent." (`screen.translations.pick`) |

---

## wizards: "Wizards"

- **Address.** `/app/wizards`. **Frame.** working.
- **Who can see it.** Every member. A team's own wizards are listed to the owners of their projects and to administrators.
- **Purpose.** The team's wizard library: Civicsmith's own, and the team's drafts, submitted and offered wizards.
- **Entry points.** `settings`, section "The team's", link "Wizards".

**Content**
- C1. Heading "Wizards" (`screen.wizards.name`).
- C2. Choice "Which wizards" (`screen.wizards.state.field`): "Offered to members", "Drafts", "Submitted for approval", "Withdrawn", "Retired", "Broken: no longer matching the screens", "Open proposals" (`screen.wizards.state.*`); "Showing: {state}" (`screen.wizards.showing`).
- C3. The library: table "Wizard", "Whose", "Based on", "Approved by", "Finished" (`screen.wizards.col.*`). Whose: "Civicsmith's", "This team's", "This team's, team-wide" (`screen.wizards.whose.*`); "Required" (`screen.wizards.required`); "finished by {n}" (`screen.wizards.finished`); based on: "Not a copy", "based on Civicsmith's “{name}”", "Based on a wizard you cannot see" (`screen.wizards.nobase`, `.basedon`, `.basehidden`); "Not approved yet" (`screen.wizards.notapproved`); version states "Draft", "Submitted", "Approved", "Updated by a newer version", "Withdrawn" (`screen.wizards.vstate.*`); "version {n}"; a broken wizard `screen.wizards.broken`; a retired one "Retired: {reason}"; a copy whose original changed "Civicsmith's original changed since: see what changed" (`screen.wizards.originalchanged`).
- C4. A wizard's panel: button "See its steps" (`screen.wizards.act.steps`), section "Its steps" (`screen.wizards.steps.head`): "On {screen}", "Why: {why}", "Side trip: {name}", and what a step places (`screen.wizards.steps.where`, `.steps.why`, `.steps.via`, `.steps.draft.*`). For a Civicsmith wizard, `screen.wizards.civicsmith.only` and button "Copy a wizard to change it" (`screen.wizards.act.copy`). For a copy whose original changed: section "What changed in {name}" (`screen.wizards.changes.head`), "Your copy's steps", "The original's newer steps", button "Bring the change across" (`screen.wizards.act.adoptbase`), or for an approved copy `screen.wizards.changes.newdraft` and button "Start a new draft of it" (`screen.wizards.act.newdraft`).
- C5. Button "See the library".
- C6. Fold "Writing your own wizards" (`screen.wizards.own.fold`): `screen.wizards.own.says` (2 sentences); section "Record a new wizard" (`screen.wizards.record.head`): `screen.wizards.record.intro` (2 sentences); fields "For which project" (`screen.wizards.project.field`), "Its name" (`screen.wizards.name.field`), "Why" (`screen.wizards.reason.field`); button "Record a new wizard". A draft's panel: section "Change this draft" (`screen.wizards.edit.head`) with "Step {n}: what the member does", "Step {n}: why", "Step {n}: its place in the list", "Remove step {n}" (`screen.wizards.edit.*`), button "Save the changes" (`screen.wizards.act.save`); buttons "Revise a draft", "Submit for approval", "Approve", "Make it team-wide" (`screen.wizards.act.widen`), "Withdraw this version" (`screen.wizards.act.withdraw`), "Retire the wizard" (`screen.wizards.act.retire`). An open proposal: "Proposed: {why}" (`screen.wizards.proposal.by`), buttons "Draft a wizard from these steps" and "Adopt these steps into a draft" (`screen.wizards.act.fromproposal`, `.act.adopt`) with "Into which of your drafts" (`screen.wizards.draftfor.field`).
- C7. Note `screen.wizards.copy.note` (3 sentences: a copy is the team's own draft; the original stays offered; editors are told when it changes).

**States**

| State | When | What shows |
|---|---|---|
| S1 Offered to members | the default | C1 to C7 for the wizards offered. |
| S2 Another state chosen | a choice in C2 | The table for that state; "Showing: {state}". |
| S3 Nothing to show | no wizard in the state, or none visible | "No wizards to show here. Your team's wizards are listed to the owners of their projects and to administrators." (`screen.wizards.empty`). |

**Actions**

| Control | When offered | Leads to |
|---|---|---|
| A1. button "See the library" (`act.wizards.label.wizards`) | always | Same screen; S1. |
| A2. a choice in "Which wizards" | always | Same screen; S2, read at once. |
| A3. button "Record a new wizard" (`act.wizarddraft.label.wizards`) | a member who may write wizards, project chosen | The guide in the dock starts recording on the real screens; each act pressed is a step. |
| A4. button "Copy a wizard to change it" (act `wizarddraft`) | a Civicsmith wizard, or a team wizard | Same screen; a draft "based on Civicsmith's “{name}”" in "Drafts". |
| A5. button "Revise a draft" / "Save the changes" (act `wizardrevise`) | a draft | Same screen; the draft's steps changed. |
| A6. button "Submit for approval" (act `wizardsubmit`) | a draft | Same screen; version state "Submitted". |
| A7. button "Approve" (act `wizardapprove`) | a submitted version, its approver | Same screen; "Approved", offered to members. |
| A8. button "Retire" / "Retire the wizard" (act `wizardretire`) | a team wizard | Same screen; "Retired: {reason}". |
| A9. buttons "Bring the change across", "Start a new draft of it" | a copy whose original changed | Same screen; the copy's draft takes the newer steps. |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. "For which project" | none chosen, on A3 | "Choose the project first. Nothing was sent." (`screen.wizards.project.none`) |
| V2. "Why" | empty where a reason is asked | "Say why. Nothing was sent." (`screen.wizards.reason.needed`) |
| V3. "Into which of your drafts" | the member has no draft | "You have no draft to adopt these steps into. Nothing was sent." (`screen.wizards.draftfor.none`) |
| V4. the draft's steps | every step removed, on A5 | "A wizard needs at least one step. Nothing was sent." (`screen.wizards.edit.nosteps`) |
| V5. a step | refused by a check | "Step {step}: {words}" (`screen.wizards.refusal.step`) |

---

## Differences seen in the code

The design above is the authority; these are where the built code draws something else (`bio-plane/src/`).

- `settings`: the record's size (C3) is drawn on `group`, not on Settings (`screens-settings/group.mjs:254`; `screens-settings/settings.mjs:24-29` has no such section).
- `settings`: "For every member" also lists "Your team's own rules", and "Watched addresses" and "Leads" to those who may use them (`screens-settings/settings.mjs:29`).
- `members`: "More for administrators" links Your team, Places and offices and Recovery codes, not Places and offices and Security (`screens-settings/members.mjs:173`).
- `members`: a removal under way (S3) is drawn inside "What removing an administrator takes", not as its own view headed "Removing {member} as an administrator" (`screens-settings/members.mjs:274-290`).
- `group-identity`: with the assistant reachable the code draws the three questions and `ask.intro`, not the explanation `ask.what` (`screens-settings/identity.mjs:59-60`).
- `security`: no hour grid, totals table, "Where from", "When you are told" or "What you can do" are drawn; only the level, files line, parts, tools and catalogue (`screens-settings/security.mjs`, no use of `heat.*`, `where.*`, `told.*`, `cando`).
- `connect`: "Check the connection" and its fold are not drawn (`screens-settings/connect.mjs:13-14`).
- `bias`: the lens, the writing form, the outside-policy form and adoption are one page with four parts, not views of one page; the earlier-lens work is at `/app/bias/<run>` (`screens-settings/bias.mjs:1-8`).
- `recovery`: no section "If you lose your codes too" (`screens-settings/recovery.mjs`, no use of `lost.*`).
- `ties`: the line `screen.ties.who.change` and the fold's summary words `screen.ties.summary` are not drawn (`screens-investigate/ties.mjs`, no use of either key).
- `account`: the mockup draws one section "Password and signing key" (`screen.account.passwordkey.heading`) holding the key and the buttons "Change your password", "Register your signing key", "Revoke your signing key"; the code draws "Your password" and "Your signing key" as two sections (`screens-settings/account.mjs:98`, `:123`). Both headings are design word rows; C7 and C8 above follow the two.
- `teamai`, `security`, `group`, `places`, `updates`: the code serves them to every member and draws a sentence saying whose screen it is, not the `unavailable` screen (`screens-settings/teamai.mjs:37`, `security.mjs:51`, `group.mjs:67`, `places.mjs:44`, `updates.mjs:34`).

## Changes

- 22 Nov 2026: written.
