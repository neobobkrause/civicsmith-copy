Length: 476 lines. Last section: "Changes".

# Screens: Getting started

Page `getting-started` of the Screens document (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

Before and at the door: Civicsmith's website, the installer and updating, the team's page, the walk-through, setting up, joining, and a forgotten password. What binds every screen (frames, refusals, weights, accessibility) is on the page "Every screen". Words are quoted with their key in `words.json`; a `{name}` is filled in by the screen. None of these screens offers the assistant, so none has a state for it being unreachable; `setup` part 5 only chooses whether members may use it.

The website and the installer are separate programs from the team's Civicsmith: a walk serves them from `site/` and `newgroup/`. The installer's Cloudflare steps reach a real account only in a deployed copy; the walker's local arm stands in a fake account.

## The screens on this page

| id | heading | address | built? |
|---|---|---|---|
| `site` | "Hold your government to its own word" | civicsmith.org `/`, `/start`, `/groups` | built (`site/`) |
| `install` | "Create your Civicsmith team" | installer `/`, `/callback` | built (`newgroup/`); S5, S6 and the region not built |
| `update` | "Update your team's Civicsmith" | installer `/update?version=<V>` | built (`newgroup/`) |
| `front` | the team's name | `/`, `/app/front` | built |
| `tour` | "How we work, step by step" | `/tour`, `/app/tour`, `/app/tour/2` … `/6` | built |
| `reset` | "Choose a new password" | `/app/reset#reset=<link>` | built |
| `forgot` | "Forgot your password" | `/app/forgot` | built |
| `setup` | "Set up your team's Civicsmith" | `/app/setup#boot=<one-time password>` | built |
| `join` | "You're invited to {group}" | `/app/join#invite=<invitation>`, `/app/join#join=<link>` | built |

---

## site: "Hold your government to its own word"

**Address.** civicsmith.org: `/` (the front page), `/start` (Start a team), `/groups` (Teams at work). Any other path: S5.
**Frame.** setup (Civicsmith's own site: no account, no sign-in, no script).
**Who can see it.** Anyone.
**Purpose.** Says what Civicsmith is, shows a team's published work and the listed teams, and leads a team that has decided to its installer.
**Entry points.** The address; the installer's link "What you need, on civicsmith.org" (`install` A2).

**Content (every page)**
- C1. The wordmark "Civicsmith" and "civicsmith.org".
- C2. A navigation landmark "civicsmith.org" with three links: "What Civicsmith is" (`screen.site.nav.home`), "Start a team" (`screen.site.nav.start`), "Teams at work" (`screen.site.nav.groups`); the current page's link is marked current.
- C3. Tab title "civicsmith.org" (`screen.site.name`) on the front page.

**States**

| State | When | What shows (exact) |
|---|---|---|
| S1 The front page | `/` | Heading "Hold your government to its own word" (`screen.site.hold`), then `screen.site.line1` and `screen.site.line2` (two sentences: what Civicsmith is, who uses it). Buttons A1, A2. Sections, each a heading level 2: "How a team uses it" (`screen.site.uses.head`), five numbered steps `screen.site.uses.gather`, `.ask` (with "Did the city collect the rent its lease requires?", `screen.site.uses.ask.example`), `.weigh`, `.finding`, `.publish`; "What a team gets" (`screen.site.gets.head`), four items `screen.site.gets.copy`, `.check`, `.help`, `.free`; "What Civicsmith does not do" (`screen.site.not.head`), three items `screen.site.not.side`, `.legal`, `.unsigned`; "One team's work" (`screen.site.onecase.head`), one case "{case}, Edition {edition}" (`screen.site.onecase.title`) with "{group}, {place} · signed by {signer} · {date}" (`screen.site.onecase.meta`) and `screen.site.onecase.open`; "Already a member of a team?" (`screen.site.member.head`) with `screen.site.member.where`; "Questions" (`screen.site.questions.head`) with "Write to the people who make Civicsmith: {address}." (`screen.site.questions.write`), or, until an address is set, "The address to write to is published here before the site opens." (`screen.site.questions.unset`). |
| S2 Start a team | `/start` | Heading "Start a team's Civicsmith" (`screen.site.start`); lede `screen.site.start.lede`. Sections: "Is it right for your team?" (`screen.site.fit.head`) `screen.site.fit.what`; "What you need" (`screen.site.need.head`): `screen.site.need.cloudflare`, `.time`, `.nothing`, and "No Cloudflare account yet? The installer walks you through opening one, step by step." (`screen.site.start.noaccount`); "Decide first: who holds the Cloudflare account" (`screen.site.hold.head`) `screen.site.hold.what`; "What happens, step by step" (`screen.site.steps.head`), six numbered steps `screen.site.steps.name` (or `.name.noplace` when no place is ready), `.permission`, `.install`, `.claim`, `.setup`, `.invite`; "What it costs" (`screen.site.costs.head`) `screen.site.costs.what`. Then A4 and A5. |
| S3 Teams at work | `/groups`, at least one team listed | Heading "Teams at work" (`screen.site.nav.groups`); lede `screen.site.groups.lede`. One row per listed team: its name and place, its line, and "1 published case" (`screen.site.groups.case.one`), "{cases} published cases" (`.case.many`), or with editions "1 published case, in {editions} editions, the latest {date}" (`.cases.one`, `.cases.many`); A6 on each. Then `screen.site.groups.listing`, the line `site.groups.rule`, and a closed disclosure "The listing rule" (`site.groups.rule.head`) holding the rule. |
| S4 Teams at work, none listed | `/groups`, no team listed | As S3 without rows: "No team is listed yet. A team appears here once its administrators choose, in their own team's Civicsmith, to list it and what it has published." (`screen.site.groups.none`). |
| S5 No such page | any other path | Heading "There is no such page on civicsmith.org." (`screen.site.notfound`); A5. HTTP status 404. |

**Actions**

| Control | When offered | Leads to |
|---|---|---|
| A1. link "Start a team's Civicsmith" (`screen.site.start`) | S1 | S2 |
| A2. link "See what teams have published" (`screen.site.seegroups`) | S1 | S3 or S4 |
| A3. link, the case's title | S1 | that case's `published` page, at its team's address |
| A4. link "Create your team" (`screen.site.create`) | S2 | `install` S3, at the installer's address |
| A5. link "Back to the front page" (`screen.site.back`) | S2, S5 | S1 |
| A6. link "Visit" (`screen.site.groups.visit`) | S3, each row | that team's `front` |
| nav links (C2) | always | S1, S2, S3/S4 |

---

## install: "Create your Civicsmith team"

**Address.** The installer: `/` (S1 to S10), Cloudflare's own permission page (outside), then `/callback` (S11 to S18). A stage of the guide is kept in the address as `#guide-<n>`.
**Frame.** setup (the installer's own page).
**Who can see it.** Anyone; it creates something only in a Cloudflare account its holder allows.
**Purpose.** Creates a team's Civicsmith in a Cloudflare account the team controls, and hands its founder the one-time password.
**Entry points.** `site` A4; the address. `update` and `install` link each other ("the update page", `installer.page.updatelink.link`).

**Content (every stage)**
- C1. The wordmark "Civicsmith". Tab title "Create your Civicsmith team" (`screen.install.name`).
- C2. "Questions people ask" (`installer.guide.faq`): six closed disclosures (why the team's own Cloudflare account; what it costs and how to stop; what Civicsmith can see and how to remove it; whether the card is shared; already using Cloudflare; getting stuck).
- C3. On the first page: "Already running your team's Civicsmith and looking for the current release? That is the update page." (`installer.page.updatelink`), and the manual-path note `installer.manual.note`.

**States** (in the order a founder meets them)

| State | When | What shows (exact) |
|---|---|---|
| S1 Do you already have a Cloudflare account? | `/` opened | Heading "Do you already have a Cloudflare account?" (`installer.guide.ask.title`); `installer.guide.ask.sub`; A1, A2. |
| S2 The first page | after A1, or the guide's last step | Heading "Create your Civicsmith team" (`screen.install.name`); "Two choices here, then Cloudflare. What your team needs first is on civicsmith.org." (`screen.install.sub`); A3. Section "Your team's short name" (`screen.install.short.heading`): `screen.install.names`; field "Short name" (`installer.shortname.label`), help `installer.shortname.hint`. Section "Your team's places" (`installer.places.heading`): a choice of the places the installer holds, the last "None of these: we enter due dates and offices ourselves" (`screen.install.places.none`), help `screen.install.places.help`. Section "Where your team's record is kept" (`screen.install.region.head`): "Near you: {region}" (`screen.install.region.near`), `screen.install.region.why`, and the option "Our team must keep its record in a particular region" (`screen.install.region.legal`) opening field "Keep the record in" (`screen.install.region.field`, ten regions `screen.install.region.*`) — `not built`. A4. |
| S3 The first page, civicsmith.org not online | as S2, while the site is not published | As S2, with "What you need" in place of A3: `screen.install.need.cloudflare`, "About twenty minutes at a computer." (no word row), "No Claude account: the assistant is optional." (`screen.install.need.claude`). |
| S4 The short name is permanent | A4 pressed with a short name | A full dialog: heading "“{name}” is permanent" (`installer.permanent.heading`); `screen.install.permanent`; A5, A6. |
| S5 Check my account: lines not ready | A12 | `not built`. Heading "Check my account" (`screen.install.check.title`); `screen.install.check.sub`; one row per line, each "Ready" (`screen.install.check.ready`) or "Not ready yet" (`.notready`) with its words: "Workers Paid", "Containers", "Room under your account's limits", "The short name", "Payment card" (`screen.install.check.*.name`, `.ok`, `.fix`); "Install now opens when every line is ready." (`screen.install.check.closed`); `screen.install.check.creates`; A13. |
| S6 Check my account: every line ready | A12, all ready | `not built`. As S5, every row "Ready", "Every line is ready." (`screen.install.check.allready`); A13, A14. |
| S7 to S10 The guide, steps 1 to 4 | A2, then each "next step" | "Step {n} of {total}" (`installer.guide.step`, total 4); heading `installer.guide.<id>.title`: "Open a Cloudflare account and confirm its email" (account), "Choose Workers Paid and add a payment method" (plan), "Turn on R2 storage" (storage), "Sign in to Cloudflare and choose Allow" (signin); then `.why`, `.do`, `.cost`; step 4 adds `installer.guide.allow.asks` and `.allow.never`, the others `installer.guide.checknote`; then `installer.guide.resume`; A7, A8. |
| S11 Let this installer into your Cloudflare account | A5 | Heading "Let this installer into your Cloudflare account" (`screen.install.cf.title`); `screen.install.cf.sub` with the short name chosen. Section "What Cloudflare will ask you to allow" (`screen.install.cf.asks`): `screen.install.cf.programs`, `.plan`, `.containers`, `.join`, `.logs`. Section "Whoever can sign in to this Cloudflare account controls your team's Civicsmith" (`screen.install.hold.head`): `screen.install.hold.what`. A9, A10. |
| S12 Choose your team's Cloudflare account | back from Cloudflare, the sign-in reaching several accounts | Heading "Choose your team's Cloudflare account" (`installer.ready.account.head`); one choice per account; nothing has been created. |
| S13 Choose your account's address on Cloudflare | the account has no workers.dev address | Heading "Choose your account's address on Cloudflare" (`installer.ready.address.head`); the offered name (`installer.address.offer`); A15. |
| S14 Setting up your team's Civicsmith | after Cloudflare's Allow | Heading "Setting up your team's Civicsmith" (`screen.install.progress.title`); "In the Cloudflare account “{account}”. This takes a few minutes; leave this page open." (`screen.install.progress.sub`). One row per step, each with "Now", "Done" or "Not done" (`installer.state.go`, `.ok`, `.no`): `screen.install.progress.single`, `.plan`, `.storage`, `.verified`, `.placing`, `.scanner`, `.address`, `.assistant`, `.answers`. While Cloudflare does not answer: `screen.install.progress.retrying`. |
| S15 A step that stopped it | a step fails | As S14, the step in progress named, then one sentence of the stop and what to do, e.g. "Stopped: this account is on Cloudflare's free plan." (`screen.install.stopped.plan`) and `screen.install.stopped.plan.do`; "This is rare: the check before installing should have caught it." (`screen.install.refused.rare`); `screen.install.stopped.others`. Other stops: `screen.install.stopped.*`, "Stopped: R2 isn't turned on in your Cloudflare account. …" (`installer.ready.storage.off`). A stop before setup has begun creates nothing. A11. |
| S16 This account already holds a Civicsmith | the account holds one | Heading "This account already holds a Civicsmith" (`screen.install.exists.title`); `screen.install.exists.sub`. "What is already here" (`.exists.here.heading`): "{team}'s Civicsmith, at {address}" (`.exists.whose`), `.exists.release`, `.exists.holds`, `.exists.ask`. "What would you like to do?" (`.exists.choose.heading`), three choices each with its line: "Update it" (`.exists.update.what`), "Install alongside it" (`.exists.alongside.what`), "Remove it, then install" (`.exists.remove.what`); A16, A17, A18. Nothing was created or changed. |
| S17 Remove the Civicsmith already here? | A18 | Heading "Remove the Civicsmith already here?" (`screen.install.remove.title`); "Read what would be deleted. Nothing has been deleted yet." (`.remove.sub`). "What would be deleted, for good" (`.remove.lost.heading`): `.remove.lost.records`, `.members`, `.published`, `.address`; `.remove.keep`; field "To confirm, type its short name" (`.remove.type.label`), help `.remove.type.help`; A19. |
| S18 Your team's Civicsmith is ready | every step done | Heading "Your team's Civicsmith is ready" (`installer.success.title.ready`); `screen.install.ready.sub`; rows `screen.install.ready.answers`, `.scanner`, `.nolog`, `.assistant`; `screen.install.ready.note`. Section "Your one-time password: save it now" (`screen.install.otp.head`): `screen.install.otp.what`; field "One-time password" (`installer.success.otp`), help `screen.install.otp.help`, with A20; field "Your address" (`installer.success.address`), help `screen.install.address.help`; a closed disclosure "A probe key, for a monitoring service (most teams never need it)" (`screen.install.probe.summary`) with "Probe key" (`installer.success.probe`), `screen.install.probe.help`, "Copy the probe key" (`screen.install.probe.copy`). A21. |

**Actions**

| Control | When offered | Leads to |
|---|---|---|
| A1. button "Yes, I have one" (`installer.guide.ask.yes`) | S1 | S2 |
| A2. button "No, or I'm not sure it's ready" (`installer.guide.ask.no`) | S1 | S7 |
| A3. link "What you need, on civicsmith.org" (`screen.install.need.link`) | S2 | `site` S2 |
| A4. button "Continue" (`installer.action.continue`), weight "Irreversible" | S2, S3 | S4; with no short name, nothing |
| A5. button "Continue with this short name" (`installer.permanent.continue`), "Irreversible" | S4 | S11 |
| A6. button "Choose another name" (`installer.permanent.cancel`) | S4 | S2, nothing sent |
| A7. button "I've done this: next step" (`installer.guide.next`) | S7 to S10 | the next step; after step 4, S2 |
| A8. button "Back" (`installer.guide.back`) | S7 to S10 | the step before, or S1 |
| A9. button "Continue to Cloudflare" (`act.bootstrap.label.install`) | S11 | Cloudflare's own permission page; after Allow, S12, S13 or S14 |
| A10. button "Back" (`installer.action.back`) | S11 | S2 |
| A11. button "Start again" (no word row) | S15 | S2 |
| A12. button "Check my account" (`act.owed_installcheck.label.install`) | S2 | S5 or S6 — `not built` |
| A13. button "Check again" (`screen.install.check.again`) | S5, S6 | S5 or S6 — `not built` |
| A14. button "Install now" (`screen.install.check.now`) | S6 | S11 — `not built` |
| A15. button "Use the address you chose for the account" (`act.owed_installaddress.label.install`) | S13 | S14 |
| A16. button "Update it" (`act.owed_installupdate.label.install`) | S16 | `update` for that Civicsmith |
| A17. button "Install alongside it" (`act.owed_installalongside.label.install`) | S16 | S14, a second Civicsmith under its own short name |
| A18. button "See what removing it would delete" (`act.owed_installremove.label.install`) | S16 | S17 |
| A19. button "Delete it for good, then install" (`act.owed_installremoveconfirm.label.install`), "Irreversible" | S17, once the short name is typed | removes it, then S14 |
| A20. button "Copy" (`installer.success.copy`) | S18 | the one-time password copied; the page stays |
| A21. link "Continue to your team's Civicsmith: become its first administrator" (`screen.install.continue`) | S18 | `setup` S1 at the new address, the one-time password filled in |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. "Short name" | already taken in the account | "The short name {name} is already taken, so nothing was created." (`screen.install.stopped.nametaken`) and "{free} is free: use it, or type another." (`.nametaken.do`) |
| V2. "To confirm, type its short name" | does not match | A19 stays closed (no word row) |

---

## update: "Update your team's Civicsmith"

**Address.** The installer's `/update?version=<V>`, opened from `updates` (Settings › Updates).
**Frame.** setup (the installer's own page).
**Who can see it.** Anyone; it changes something only for whoever holds the team's Cloudflare account and allows it.
**Purpose.** Updates the team's Civicsmith to the signed release chosen in Settings › Updates, and no other, keeping records, members and settings.
**Entry points.** `updates` "Update"; `install` S16 A16; `install`'s link "the update page".

**Content**
- C1. The wordmark "Civicsmith". Tab title "Update your team's Civicsmith" (`installer.update.page.title`).

**States**

| State | When | What shows (exact) |
|---|---|---|
| S1 The update page | opened with a version | Heading "Update your team's Civicsmith" (`screen.update.name`); "For whoever holds your team's Cloudflare account. An update keeps every record, member and setting; it changes only Civicsmith's own programs." (`screen.update.sub`). Rows: "Your team's Civicsmith runs release {version}" (`installer.update.running`); "This update: release {version}, {date}, the release chosen in your team's Settings › Updates" (`installer.update.chosen`, or `.chosen.nodate`) with "this page installs that release and no other" (`installer.update.only`); "Signed by Civicsmith; the signature and the release notes checked" (`installer.update.checked`). Note `screen.update.note`. Field "The name your team's Civicsmith was installed under" (`installer.update.which.label`), hint `installer.update.which.hint`. A1. |
| S2 Updating | after Cloudflare's Allow | Heading "Updating your team's Civicsmith" (`installer.update.progress.title`); `installer.update.progress.says`; rows `installer.update.progress.verified`, `.read`, `.placing`, `.answers`, each "Now", "Done" or "Not done". |
| S3 A step that stopped it | a step fails | As S2, then e.g. "Stopped: Cloudflare refused the upload. Your team's Civicsmith runs release {version} as before; nothing changed. …" (`installer.update.stopped`); other stops `installer.update.stopped.*`; A2. |
| S4 Updated | every step done | Heading "Your team's Civicsmith is updated" (`installer.update.done.title`); "It runs release {to}; it ran {from}. Every record, member and setting is as it was." (`installer.update.done.says`); rows `installer.update.done.answers`, `.kept`; note `installer.update.done.note`; A3. |
| S5 No release chosen | opened without a version | Heading "No release was chosen." (`installer.update.norelease`); `installer.update.norelease.lede`, `.how`; link "Back to your team's Civicsmith, Settings › Updates" (`installer.update.norelease.back`). |

**Actions**

| Control | When offered | Leads to |
|---|---|---|
| A1. button "Continue to Cloudflare to update" (`act.bootstrap.label.update`) | S1 | Cloudflare's permission page, then S2 |
| A2. button "Try again" (`installer.update.tryagain`) | S3 | S1 |
| A3. link "Back to your team's Civicsmith" (`installer.update.back`) | S4 | the team's Civicsmith, `home` |

---

## front: the team's name

**Address.** `/` without a session (with one, `/` opens `home`); `/app/front`.
**Frame.** public.
**Who can see it.** Anyone. A part the team keeps from the public is not drawn.
**Purpose.** The team's own page: who it is, what it has published, how to hand it material and how it works, with members' sign-in beside it.
**Entry points.** The team's address; any `/app/...` address opened without a session (it opens after sign-in); signing out; `tour`, `reset`, `forgot`, `join`, `setup` links "Sign in" or "Back to your team's page".

**Content**
- C1. The team's logo, or its initials, beside a heading level 1: the team's name, or "Your team" (`screen.entry.group`) while it has none.
- C2. Under the name, the team's public focus and purpose, as the team wrote them.
- C3. Section "What we have published" (`screen.front.published`): one row per published case, its title as a link (or "A published case", `screen.front.untitled`) and "Edition {edition} · {date} · signed by {signer}" (`screen.front.edition`, or `.edition.nosigner`); then link "All our published cases" (`screen.front.allpublished`). With nothing published, no section.
- C4. Section "Have something for us?" (`screen.front.doorbell`): `screen.front.doorbell.what`; A3.
- C5. Section "How we work" (`screen.front.how`): `screen.front.how.what`; A4.
- C6. Section "Members" (`screen.front.members`), the sign-in panel (beside C3 to C5 on a desktop, below them on a phone): field "Your handle" (`screen.front.handle`), help `signin.handle.help`; field "Password" (`screen.entry.password`); choice "This device is" (`screen.front.device`): "My own: keep me signed in (it locks after 30 minutes away; you sign in again after 12 hours)" (`session.keep`, chosen), "Shared or public: sign me out after 15 minutes away" (`session.shared`); A1, A2; "Invited? Open the link you were sent: it brings you here to join." (`screen.front.invited`).
- C7. At the foot: "{group} uses Civicsmith." (`screen.entry.uses`).
- C8. Tab title "{team's name} · {team}" (`page.title.public`).

**States**

| State | When | What shows (exact) |
|---|---|---|
| S1 To a visitor | no session record | C1 to C7. |
| S2 After a refused sign-in | A1 refused | S1, beside A1: "That handle and password don't match. Check both and try again; after several tries, sign-in pauses for a while to keep others from guessing." (`refusal.SIGN_IN_REFUSED`); the handle kept, the password cleared. |
| S3 While sign-in is paused | too many refused tries | S1, beside A1: "Sign-in is paused for a while after too many tries. This keeps others from guessing passwords; it isn't a judgment on you. Wait a while, then try again. The limit: {stated}." (`refusal.SIGN_IN_PAUSED`). |
| S4 Just after signing out | after "Sign out" | S1, the panel opening with "You are signed out on this device. Your work is saved in your team's Civicsmith, not here." (`session.signedout`). |
| S5 After a sign-in ended for being idle | a shared device after 15 minutes | S1, the panel opening with `session.ended`; the handle filled in. |
| S6 Locked, on a device kept signed in | an own device locked, the page opened again | C1, then section "Welcome back, {handle}" (`screen.front.welcomeback`): "Locked after 30 minutes away. Enter your password to go on where you were; nothing was lost." (`session.locked`); field "Password" (`screen.entry.password`); A5; "Not {handle}?" (`screen.front.notyou`) with A6; then C7. C3 to C6 are not drawn. |

**Actions**

| Control | When offered | Leads to |
|---|---|---|
| A1. button "Sign in" (`act.login.label.front`) | S1 to S5 | `home`, or the address kept from before sign-in; a founder with no handle goes to `setup` S3 |
| A2. link "Forgot your password?" (`screen.front.forgot`) | S1 to S5 | `forgot` |
| A3. link "Hand material to the team" (`screen.front.doorbell.go`) | S1 to S5 | `doorbell` |
| A4. link "See how it works, step by step" (`screen.front.how.go`) | S1 to S5 | `tour` step 1 |
| A5. button "Unlock" (`act.unlock.label.front`) | S6 | the page kept, as it was, else `home` |
| A6. button "Sign in as someone else" (`screen.front.other`) | S6 | S4 |
| A7. a case's title; "All our published cases" | S1 to S5, C3 | `published` for that case |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. handle or password | either empty on A1 | "Type your handle and your password first. Nothing was sent." (`screen.front.incomplete`) |
| V2. "Password" (S6) | empty on A5 | "Type your password first. Nothing was sent." (`screen.front.nopassword`) |
| V3. "Password" (S6) | wrong on A5 | `refusal.SIGN_IN_REFUSED`; the field cleared |

---

## tour: "How we work, step by step"

**Address.** `/tour`, `/app/tour` (step 1), `/app/tour/2` … `/app/tour/6`.
**Frame.** public.
**Who can see it.** Anyone, with no account. Nothing is read or recorded.
**Purpose.** How the team works, in six short steps.
**Entry points.** `front` A4; the address.

**Content**
- C1. Heading level 1 "How we work, step by step" (`screen.tour.name`).
- C2. "Step {n} of {total} · how we work" (`screen.tour.step`, total 6).
- C3. The step's title as a heading level 2 and its body: `screen.tour.step<n>.title`, `screen.tour.step<n>.body`.
- C4. "No account is needed and nothing you do here is recorded. Members see the same walk-through from Home." (`screen.tour.nothing`).

**States**

| State | When | What shows (exact) |
|---|---|---|
| S1 Step 1 | `/tour`, `/app/tour` | "What we look into" (`screen.tour.step1.title`); A2, A3. No A1. |
| S2 Step 2 | `/app/tour/2` | "Every finding shows its source"; A1, A2, A3. |
| S3 Step 3 | `/app/tour/3` | "How strong the evidence is"; A1, A2, A3. |
| S4 Step 4 | `/app/tour/4` | "What we publish, and who stands behind it"; A1, A2, A3. |
| S5 Step 5 | `/app/tour/5` | "Have something for us?"; A1, A2, A3, and A5. |
| S6 Step 6 | `/app/tour/6` | "Taking part"; A1 and A4. No A2. |

**Actions**

| Control | When offered | Leads to |
|---|---|---|
| A1. link "Back" (`screen.tour.back`) | S2 to S6 | the step before |
| A2. link "Next" (`screen.tour.next`) | S1 to S5 | the next step |
| A3. link "Stop here" (`screen.tour.stop`) | S1 to S5 | `front` |
| A4. link "Back to our page" (`screen.tour.end`) | S6 | `front` |
| A5. link "Have something for us?" (`screen.tour.doorbell`) | S5 | `doorbell` |

---

## reset: "Choose a new password"

**Address.** `/app/reset#reset=<link>`. The link is taken from the address on load and removed from it.
**Frame.** public.
**Who can see it.** Whoever opens a reset link an administrator made on `members`.
**Purpose.** A member chooses a new password from an administrator's one-time reset link, keeping their handle and work.
**Entry points.** The reset link.

**Content**
- C1. Heading level 1 "Choose a new password" (`screen.reset.name`), except S3.

**States**

| State | When | What shows (exact) |
|---|---|---|
| S1 The reset link opened | a live link | "For {handle} · it works once, until {date}" (`screen.reset.for`); field "A new password" (`screen.entry.newpassword`), help "At least 12 characters. A short sentence you can remember works well." (`screen.entry.twelve`); field "Type it again" (`screen.entry.again`); A1; note `screen.reset.keeps` (the handle and work kept, every other sign-in ended, the administrator can't see the password, recovery codes still work). |
| S2 The new password set | A1 accepted | "For {handle}" (`screen.reset.forhandle`); "Your new password is set. The reset link is spent, and every other sign-in of yours has ended. Sign in with your new password." (`screen.reset.done`); A2. |
| S3 A link that no longer works | used, expired, withdrawn, or no link | Heading "This link no longer works" (`screen.reset.dead`); "A reset link works once, for seven days" (`screen.reset.dead.sub`); `screen.reset.dead.what`; A3. No field. |

**Actions**

| Control | When offered | Leads to |
|---|---|---|
| A1. button "Set my new password" (`act.passwordreset.label.reset`) | S1 | S2 |
| A2. link "Sign in" (`screen.entry.signin`) | S2 | `front` |
| A3. link "Back to your team's page" (`screen.entry.backtofront`) | S3 | `front` |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. the two passwords | differ | "The two passwords don't match. Type the same password twice. Nothing was sent." (`screen.entry.differ`) |
| V2. "A new password" | under 12 characters | "A password needs at least 12 characters. Nothing was sent." (`screen.entry.short`) |

---

## forgot: "Forgot your password"

**Address.** `/app/forgot`.
**Frame.** public.
**Who can see it.** Anyone.
**Purpose.** How to get back in without email: one of the member's recovery codes, or an administrator's one-time reset link.
**Entry points.** `front` A2.

**Content**
- C1. Heading level 1 "Forgot your password" (`screen.forgot.name`); "Civicsmith sends no email, so getting back in goes through your team, not a mailbox." (`screen.forgot.lede`).
- C2. Section "Use one of your recovery codes" (`screen.forgot.codes`): field "Your handle" (`screen.front.handle`), help `forgot.handle.help`; field "One of your recovery codes" (`screen.forgot.code`), help `screen.forgot.code.help`; field "A new password" (`screen.entry.newpassword`), help `screen.entry.twelve`; field "Type it again" (`screen.entry.again`); A1.
- C3. Section "No codes to hand? Ask an administrator for a reset link" (`screen.forgot.admin`): `screen.forgot.admin.what`.
- C4. Section "If no administrator can get in" (`screen.forgot.noadmin.heading`): `screen.forgot.noadmin.what`.

**States**

| State | When | What shows (exact) |
|---|---|---|
| S1 The two ways back in | opened | C1 to C4. |
| S2 A new password set with a recovery code | A1 accepted | C1; "Your new password is set. That recovery code is spent; you have {remaining} left. Every other sign-in of yours has ended. Sign in with your new password." (`screen.forgot.done`), or, the last code spent, "That was your last recovery code. Once you're in, get ten new ones in Settings › Recovery codes, so you have a way back in next time." (`screen.forgot.done.last`); A2; C3, C4. C2 not drawn. |
| S3 A recovery code that didn't work | A1 refused | S1, beside A1: "That didn't work: the handle, the code or both aren't right, or the code was already used. Check them and try again. Nothing was changed." (`refusal.RECOVERY_REFUSED`); the code field cleared. |

**Actions**

| Control | When offered | Leads to |
|---|---|---|
| A1. button "Set a new password with a recovery code" (`act.recover.label.forgot`) | S1, S3 | S2 |
| A2. link "Sign in" (`screen.entry.signin`) | S2 | `front` |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. handle or code | empty | "Type your handle and one of your codes first. Nothing was sent." (`screen.forgot.incomplete`) |
| V2. the two passwords | differ | `screen.entry.differ` |
| V3. "A new password" | under 12 characters | `screen.entry.short` |
| V4. any | too many tries | `refusal.SIGN_IN_PAUSED` |

---

## setup: "Set up your team's Civicsmith"

**Address.** `/app/setup#boot=<one-time password>` (from `install` A21; the old `/#boot=` is forwarded here); `/app/setup`.
**Frame.** setup.
**Who can see it.** Before the claim, anyone holding the one-time password. After it, the founder; any other member sees S5.
**Purpose.** The founder claims the team's Civicsmith with the one-time password, then names the team and sets its places, offices, assistant, privacy notice, security tools, second administrator and hosting account, each part skippable.
**Entry points.** `install` A21; `front` A1 for a founder with no handle (S3).

**Content (S1, S2)**
- C1. The wordmark "Civicsmith" (`shell.mark`) and the team's short name (before the claim) or its name (after).
- C2. Heading level 1 "Set up your team's Civicsmith" (`screen.setup.name`).
- C3. Numbered parts that open and close, each with its number, title, one line of what it is for, and its state: "Needed first", "Done", "Optional", "Kept out", "Skipped" (`screen.setup.state.needed`, `.done`, `.optional`, `.off`, `.skipped`; "Skipped" explained by `.state.skipped.help`). Parts 2 to 8 each carry A3.
  1. "Make it yours" (`screen.setup.claim`), "So that only you can run it. About two minutes." (`screen.setup.part.claim.why`).
  2. "Your team" (`screen.setup.part.group`), `screen.setup.part.group.why`: field "Your team's name" (`screen.setup.name.field`), help `screen.setup.name.help`, with A4; "Add your logo (optional)" (`screen.setup.logo.add`); choice "Does your team have a website of its own?" (`screen.setup.site.q`): "No, or not yet" (`.site.no`), "Yes" (`.site.yes`); "Yes" opens field "Its address" (`screen.setup.domain`), help `screen.setup.domain.help`, with A5 and the closed disclosure of the file for the website.
  3. "Where your team works" (`screen.setup.places`), `screen.setup.part.places.why`: `screen.setup.places.intro`; "You chose {place} when you installed. Change it if you need to." (`screen.setup.places.chosen`); choice "Your place" (`screen.setup.places.choose`) with "Somewhere else" (`screen.setup.place.other`), help `screen.setup.places.help`; "Somewhere else" opens field "Where is your team?" (`screen.setup.place.wanted`) with A7; "Languages your members read" (`screen.setup.languages`); A6. Then "Your team's time zone" (`screen.setup.zone`), `screen.setup.zone.help`, fields "How you checked it" (`screen.group.timezone.how`) and "Where you checked it" (`screen.group.timezone.source`), A8.
  4. "The officials you deal with" (`screen.setup.offices`), `screen.setup.part.offices.why`: with a known place, `screen.setup.offices.what` and the offices listed, each "held by {name}" (`screen.setup.office.heldby`) and "From {office}'s roster" (`screen.setup.office.roster`), A9; with none, `screen.setup.offices.none` or `screen.setup.places.none`; fields "An office your team deals with" (`screen.setup.office.field`), "What your team deals with this office about" (`screen.setup.office.note`), A10.
  5. "The AI assistant" (`screen.setup.assistant`), `screen.setup.part.assistant.why`: `screen.setup.assistant.what`; choice "Should your team use the assistant?" (`screen.setup.ai.q`): "Yes, members may use it" (`.ai.yes`, help `.ai.yes.help`), "No, keep our material away from AI" (`screen.setup.keepaway`, help `.ai.no.help`). "No" opens field "Tell your members why" (`screen.setup.keepaway.why`), help `.keepaway.help`, with A11, and hides the rest. "Yes" opens choice "Who pays for it?" (`screen.setup.pay.q`): "Each member, with their own Claude account" (`.pay.own`, help `.assistant.own`), "Your team, with one API key for members who have none" (`.pay.group`, help `.assistant.paid`); the second opens field "Your team's Anthropic API key" (`screen.setup.key`), help `.key.help`, A12, A13, `screen.setup.key.told`, field "The most each member may use per day" (`screen.setup.limit`), help `.limit.help`, A14.
  6. "Privacy and the law" (`screen.setup.court`), `screen.setup.part.court.why`: `screen.setup.people.what`; `screen.setup.court.what` (explained by `screen.setup.court.matters`); choice "Should members be told about this?" (`screen.setup.court.legend`): "Yes, when they join, and the first time they save something not public" (`.court.tell`), "No, just keep the explanation one tap away" (`.court.dont`), neither chosen; A15.
  7. "Security" (`screen.setup.security`), `screen.setup.part.security.why`: `screen.setup.security.scanner`; `screen.setup.security.what`; for each tool offered, its fields, the checkbox "I have read how this tool handles our files, and agree" (`screen.setup.security.keep`) and A16.
  8. "A second administrator" (`screen.setup.admins`), `screen.setup.part.admins.why`: `screen.setup.admins.what`; fields "A short id for them" (`screen.setup.admins.id`, help `.admins.id.help`) and "Who they are, as the team knows them" (`.admins.cover`); A17. Then "The hosting account" (`screen.setup.hosting`): field "Who holds the hosting account" (`.hosting.field`), help `.hosting.help`; field "A note (optional)" (`.hosting.note`); A18.
- C4. Section "You're ready" (`screen.setup.finished`): "**Your team's Civicsmith is set up.** Anything you left is waiting in Settings. Next, invite your first members." (`screen.setup.finished.title`, `.finished.what`); A19.

**States**

| State | When | What shows (exact) |
|---|---|---|
| S1 A new team, before its founder claims it | not claimed | C1, C2; "Welcome. Civicsmith is installed …" (`screen.setup.lede`); part 1 open: `screen.setup.claim.intro`; field "One-time password" (`screen.setup.otp`), help `screen.setup.otp.help` (explained by `.otp.tip`), filled from the address; field "Your handle" (`screen.setup.handle`), help `screen.setup.handle.help` (explained by `.handle.tip`); field "Your password" (`screen.setup.own`), help `.own.help`; field "Type it again" (`screen.entry.again`), help `.again.help`; A1. Then "Then, when you like, seven more parts. Each starts with a safe choice, and none has to be done today." (`screen.setup.coming`) and parts 2 to 8 shown closed, not openable. With no one-time password set: "Your team's Civicsmith has no one-time password set, so it can't be claimed yet. Whoever holds the hosting account sets one." (`screen.setup.unarmed`), no field. |
| S2 Just after claiming | A1 accepted | C1, C2; `screen.setup.after`; part 1 "Done": "Claimed. {group} is yours, and you're signed in as {handle} on this device." (`screen.setup.claimed`), `screen.setup.codes.intro`, "Shown once. Each works one time." (`setup.codes.once`), the ten codes, buttons "Copy them" (`setup.codes.copy`) and "Save them as a file" (`setup.codes.save`); parts 2 to 8 openable (C3); C4. A part saved shows its "now" line, e.g. "Saved. Your team is now called {name}." (`screen.setup.name.now`). |
| S3 A founder who claimed before choosing a handle | founder signed in with no handle | Heading "Choose your handle" (`founder.handle.title`); `founder.handle.says`; field "Your handle" (`screen.setup.handle`); A20, A21; `founder.handle.later.help`. After A20: "From now on you sign in as {handle}; admin no longer works." (`founder.handle.done`) and A22. |
| S4 Already claimed | the one-time password used again | Heading "Already claimed" (`setup.claimed.heading`); `setup.claimed.sub`; the refused mark with `refusal.ALREADY_CLAIMED`; A23. |
| S5 A member, or another administrator, opening setup | signed in, not the founder | Heading "Your team is set up" (`setup.member.heading`); `setup.member.sub`; A22. |
| S6 Claimed, not signed in | A1 accepted, the sign-in after it refused | Heading C2; "Claimed. Sign in on your team's page with your handle, {handle}, and the password you just chose." (`screen.setup.claimed.nosignin`); A23. |

**Actions** (registry labels; where the screen draws its own words they are given)

| Control | When offered | Leads to |
|---|---|---|
| A1. button "Claim it and become its administrator" (`screen.setup.claim.button`; registry `act.claim.label.setup` "Claim with the one-time password") | S1 | S2, signed in as the founder |
| A2. button "Show my recovery codes" (`act.recoverycodesissue.label.setup`) | S2, codes not yet shown | the ten codes, once |
| A3. "Skip for now" (`setup.skip`), explained by `setup.skip_does` | each part 2 to 8 | the part marked "Skipped"; nothing sent |
| A4. button "Name the team" (`act.groupnameset.label.setup`) | part 2 | the name saved; "Saved. Your team is now called {name}." |
| A5. button "Verify the web address" (`act.groupdomainset.label.setup`) | part 2, "Yes" | "Verified: {domain}" (`screen.setup.domain.verified`), or the check's refusal |
| A6. button "Choose places and languages" (`act.profilesset.label.setup`) | part 3 | places and languages saved |
| A7. button "Name a place not yet listed" (`act.placewanted.label.setup`) | part 3, "Somewhere else" | "The place you named: {name}" (`screen.setup.place.wanted.now`) |
| A8. button "Save the time zone" (`act.factconfirm.label.setup`) | part 3 | the zone saved, marked "Done" |
| A9. button "Review offices and seats" (`act.officesseed.label.setup`) | part 4, a known place | the offices recorded |
| A10. button "Add an office yourself" (`act.entitycreate.label.setup`) | part 4 | "Added: {label}" (`screen.setup.office.added`) |
| A11. button "Keep the team's material away from AI, with a reason" (`act.aikeepaway.label.setup`), weight "Asks for a reason" | part 5, "No" | "Your team's material is kept away from AI." (`screen.setup.keepaway.on`) with the reason; part 5 "Kept out" |
| A12. button "Hold the team's API key" (`act.groupkeyset.label.setup`) | part 5, team pays | "The team's key is held and {state}." (`screen.setup.key.held`) |
| A13. button "Switch it on" / "Switch it off" (`screen.setup.key.switchon`, `.switchoff`; registry `act.groupkeyswitch.label.setup`) | part 5, key held | the key on or off |
| A14. button "Set each member's daily use of the team's key" (`act.ailimitset.label.setup`) | part 5, team pays | "The daily limit is set." (`screen.setup.limit.set`) |
| A15. button "Choose whether members are told what a court can reach" (`act.courtnoticeset.label.setup`) | part 6 | "Members are told when they join." or "The explanation is kept one tap away." (`screen.setup.court.now.tell`, `.now.dont`) |
| A16. button "Connect a tool" (`screen.setup.security.add`; registry `act.securitytooladd.label.setup`) | part 7 | "The test passed: {tool} is on." or "{tool} was added and stays off: its test did not pass." (`screen.setup.security.passed`, `.failed`) |
| A17. button "Invite a second administrator" (`setup.admin.invite`; registry `act.memberadd.label.setup`), explained by `setup.admin.invite_does` | part 8 | the link shown once with `screen.setup.admins.shown` |
| A18. button "Record who holds the hosting account" (`act.hostingaccessset.label.setup`) | part 8 | "Recorded: {holders}" (`screen.setup.hosting.now`) |
| A19. link "Open your team's Civicsmith" (`screen.setup.finished.go`) | S2 | `home` |
| A20. button "Choose this handle" (`founder.handle.choose`; registry `act.owed_founderhandleset.label.setup`) | S3 | S3's done line |
| A21. link "Later" (`founder.handle.later`) | S3 | `home`; S3 again at the next sign-in |
| A22. link "Go to Home" (`setup.member.home`) | S3 done, S5 | `home` |
| A23. link "Sign in" (`screen.entry.signin`) | S4, S6 | `front` |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. "One-time password" | empty | "Type the one-time password first. Nothing was sent." (`screen.setup.nootp`) |
| V2. "Your handle" | empty | `refusal.NO_HANDLE` |
| V3. the two passwords | differ | `screen.entry.differ` |
| V4. "Your password" | under 12 characters | `screen.entry.short` |
| V5. "Your team's name" | empty | "Type the team's name first. Nothing was sent." (`screen.setup.name.empty`) |
| V6. "Its address" | empty | `screen.setup.domain.empty` |
| V7. "Where is your team?" | empty | `screen.setup.place.empty` |
| V8. "An office your team deals with" | empty | `screen.setup.office.empty` |
| V9. "Tell your members why" | empty | `screen.setup.keepaway.noreason` |
| V10. "Your team's Anthropic API key" | empty | `screen.setup.key.nokey` |
| V11. "The most each member may use per day" | not an amount | "Type an amount in dollars, such as 5 or 2.50. Nothing was sent." (`screen.setup.limit.bad`) |
| V12. part 6 choice | none chosen | "Choose one first. Nothing was sent." (`screen.setup.court.pick`) |
| V13. part 7 | no tool chosen; a field missing | `screen.setup.security.nopick`; `screen.setup.security.missing` |
| V14. part 8 fields | either empty | `screen.setup.admins.incomplete`; hosting: `screen.setup.hosting.empty` |

---

## join: "You're invited to {group}"

**Address.** `/app/join#invite=<invitation>` or `/app/join#join=<join link>` (the old `/#invite=` and `/#join=` are forwarded here; the fragment is removed from the address on load).
**Frame.** setup.
**Who can see it.** Whoever opens an invitation or the team's join link.
**Purpose.** A new member reads the invitation and joins: language, handle, password.
**Entry points.** An invitation link made on `members`, or `setup` part 8; the team's join link.

**Content (S1)**
- C1. Heading level 1 "You're invited to {group}" (`screen.join.invited`); "{name} invited you to contribute. This link works once and expires on {date}." (`screen.join.invited.by`); where named, "You were invited as {cover}." (`screen.join.invited.as`).
- C2. Choice "Your language" (`screen.join.language`), each language in its own name; help `screen.join.language.help`.
- C3. Field "Your handle" (`screen.join.handle`), help `screen.join.handle.help`; "Your handle can't be changed: it names your work for good, and no one else can ever take it." (`handle.fixed`); A1.
- C4. Under the handle, as it is typed (status message): "{handle} is free in {group}" (`handle.free`), "{handle} is already taken in {group}. Try another, such as {suggestion}." (`handle.taken`), or "A handle uses only lowercase letters, digits and hyphens." (`handle.characters`).
- C5. Field "Password" (`screen.entry.password`), help `screen.entry.twelve`; field "Type it again" (`screen.entry.again`), help `screen.join.again.help`.
- C6. A2, A3; note `screen.join.codes.after`.
- C7. "Already a member?" (`screen.join.member`) with A4.

**States**

| State | When | What shows (exact) |
|---|---|---|
| S1 A handle that is free | an invitation, a free handle typed | C1 to C7; C4 "{handle} is free in {group}". |
| S2 A handle already taken | the handle typed is taken | C1 to C7; C4 `handle.taken`. |
| S3 A handle with characters it can't have | e.g. capitals or spaces | C1 to C7; C4 `handle.characters`. |
| S4 The team's join link | `#join=` | Heading "Join {group}" (`screen.join.link`); `screen.join.link.what`; field "The name the team will know you by" (`screen.join.cover`), help `screen.join.cover.help`; A5; C7. Then S1. |
| S5 A link that no longer works | used, expired, withdrawn, or no link | Heading "This link no longer works" (`screen.join.dead`); `screen.join.dead.what`; C7. No form. When the join link is at its daily cap: an open disclosure "On a busy day, the team's join link says this instead" (`join.cap.says`) holding `refusal.JOIN_LINK_DAILY_CAP`. |
| S6 Joined | A2 accepted | Heading "Your invitation" (`screen.join.name`); "You have joined, signed in as {handle} on this device." (`screen.join.joined`); section "Your recovery codes: save them now" (`screen.entry.codes.heading`): `screen.entry.codes.what`, the ten codes ("Your ten recovery codes", `screen.entry.codes.list`), buttons "Save them as a file" (`screen.entry.codes.save`), "Copy them" (`screen.entry.codes.copy`); A6. Not signed in after joining: `screen.join.joined.nosignin` and link "Sign in" (`screen.entry.signin`) to `front`. |

**Actions**

| Control | When offered | Leads to |
|---|---|---|
| A1. button "See whether a handle is free" (`act.handlecheck.label.join`) | S1 to S3 | C4 answered; from then on the handle is checked as it is typed |
| A2. button "Join with a handle and password" (`act.enroll.label.join`) | S1 | S6, signed in on this device, the language chosen kept |
| A3. button "Read the invitation again" (`screen.join.invite.reread`; registry `act.invitelook.label.join`) | S1 to S3 | the invitation read again; S1 |
| A4. link "Sign in" (`screen.join.member.go`) | S1 to S5 | `front` |
| A5. button "Join through the team's join link" (`act.joinlinkinvite.label.join`) | S4 | S1 for that person |
| A6. link "Go to your team's home" (`screen.join.home`) | S6 | `home`, with the welcome wizard's guide open |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. "Your handle" | empty | "Choose a handle first. Nothing was sent." (`screen.join.handle.empty`) |
| V2. "Your handle" | taken on A2 | "That handle is already taken in your team. Choose another. Nothing was changed." (`screen.join.handle.taken`) |
| V3. "Your handle" | bad characters on A2 | `handle.characters` |
| V4. the two passwords | differ | `screen.entry.differ` |
| V5. "Password" | under 12 characters | `screen.entry.short` |
| V6. "The name the team will know you by" | empty | "Say what the team should call you first. Nothing was sent." (`screen.join.cover.empty`) |
| V7. "Your handle" | many checks in a short time | "Too many handles checked in a short time. Try again in {minutes} minutes." (`handle.refused.paused`) |

---

## Differences seen in the code

- `front` draws "Not a member yet? …" (`screen.front.notmember`) where the design draws "Invited? Open the link you were sent: it brings you here to join." (`screen.front.invited`) (`bio-plane/src/screens-entry/front.mjs:83`).
- `forgot` draws a section "If you cannot sign in" (`screen.forgot.help.heading`, `.help.s1`, `.help.s2`) in place of "If no administrator can get in" (`screen.forgot.noadmin.*`) (`bio-plane/src/screens-entry/forgot.mjs:29-32`).
- The public and setup frames draw no path; the design draws one ("Lakeshore Tenants › Forgot your password" and the like) (`bio-plane/src/interface-shell/browser.mjs:1364-1367`).
- `install` opens on the guide's question (S1), before the first page (S2); the design's first page is S2 with the guide beside it (`newgroup/src/ui.mjs:274`; `newgroup/src/guide.mjs:61`).
- `install` draws no "Check my account" (S5, S6, A12 to A14) and no record region (S2) (`newgroup/src/ui.mjs:270-305`).
- `install` S2's places choice is headed "Places this installer holds" (`installer.places.legend`) where the design draws "The places whose rules apply" (`newgroup/src/ui.mjs:101`).
- `setup` A1 is drawn "Claim it and become its administrator" (`screen.setup.claim.button`); the registry's label is "Claim with the one-time password" (`bio-plane/src/screens-entry/setup.mjs:166`).
- `setup` part 8 asks a short id and who the administrator is before inviting; the design draws the button alone (`bio-plane/src/screens-entry/setup.mjs:373-375`).
- `join`'s design button reads "Join {group}" and the join link's "Continue"; the code draws the registry labels "Join with a handle and password" and "Join through the team's join link" (`bio-plane/src/screens-entry/join.mjs:76`, `:52`).

## Changes

- 22 Nov 2026: written.
