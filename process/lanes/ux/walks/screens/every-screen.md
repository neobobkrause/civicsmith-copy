Length: N lines. Last section: "Changes".

# Screens: Every screen

Page `every-screen` of the Screens document (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

What binds every screen is said here once and not repeated on the group pages. A walking session reads this page beside the pages of its areas. Words are quoted with their key in `words.json` (the product's `setup-words`). A `{name}` in a quotation is filled in by the screen.

## The screens on this page

| id | heading | address | built? |
|---|---|---|---|
| `unavailable` | "Nothing is here", "You can't open this" or "Your team's Civicsmith can't be reached" (one per state) | any address that leads nowhere | built (drawn by the frame) |
| `more` | "More" | `/app/more` | built (drawn by the frame) |

## 1. Rules every screen keeps

Each line is a rule a walker can check on any screen. The ruling it comes from is named in brackets.

1. The product never nags. A reversible or reasoned act runs without "are you sure"; nothing is preselected in a set or a choice (DEC-69).
2. What is not known is shown, never hidden or guessed: "Undetermined" always carries its "because…" line, and "Withheld", "Unrated", "Nobody looked" and "Refused" each have their own look. None is drawn as an error (DEC-86).
3. Friction matches an act's weight. A reversible act runs on the press, a reasoned act opens a reason field in place, an act that ends something or is signed opens a full dialog, and an irreversible act goes through its own ceremony or full dialog (DEC-87; section 6).
4. An act whose effect leaves the team's Civicsmith says so at the act, with the outward mark (DEC-88).
5. Every empty, loading, failed or waiting state says so in words: "Nothing here" (`state.empty`), "Still loading" (`state.loading`), "Could not read this, because {reason}" (`state.failed`) (DEC-98).
6. Every screen meets WCAG 2.2 AA, and no state is told by colour alone (DEC-99; section 8).
7. A phone does reversible and reasoned acts. A signed or irreversible act is held for a larger screen (DEC-122, DEC-181; section 6).
8. A capability the member lacks is absent, not greyed. Without an AI account the assistant is absent, not greyed (DEC-139; section 5).
9. The frames, the rail, the phone's tabs and Home's doors are as section 3 and section 4 say (DEC-139).
10. Every screen in the working frame shows its path under the masthead, from its rail place to its own name, the last step being the current page (DEC-154).
11. Every word a screen shows comes from the word table. A protected word (warnings before outward, signed or irreversible acts, weights, who-can-see notices) changes only after a second check (DEC-157, DEC-179).
12. Every mark, control and act explains itself on hover, focus or tap; nothing is ever hidden (DEC-160, DEC-162, DEC-174, DEC-175).
13. A screen may draw a refusal it received; it never computes one itself (section 7).
14. The way in is passwords, handles and recovery codes. Civicsmith sends no email and no outside message to a member, ever (DEC-201, DEC-202, DEC-219).
15. Buttons answer the press: working while the request is out, done after, refused with the reason beside the act. Sounds are off by default (DEC-280).
16. Every text people read says "team", never "group", and "your team's Civicsmith", never "copy" (DEC-281).
17. Only acts heavier than Reversible show the weight mark (dots and the weight's name); a button without dots does something you can undo (DEC-295).
18. The alpha is walked without the assistant: every journey's path without it is walked first (DEC-405).

## 2. The frames

The frame is drawn by the shell around the screen. A screen's page names its frame.

| Frame | Screens | What it draws |
|---|---|---|
| working | every screen not named below | The masthead (section 3.3), the band, the rail (desktop) or the tabs (phone), the path, the screen, and the assistant dock or the wizard guide when one is open. Needs a session: without one the shell shows `front` and keeps the address, opening it after sign-in. |
| setup | `site`, `install`, `update`, `setup`, `join` | A plain page: no rail, tabs, masthead, member menu or dock. Opens with or without a session. |
| public | `front`, `tour`, `reset`, `forgot`, `doorbell` | A plain page as the setup frame, drawn without a session. No weight mark is drawn on it. Tab title "{page} · {team}" (`page.title.public`). |
| published | `published`, `review-outside`, `docket-public` | A plain page drawn without a session, headed by the team's name and ended by a foot: "{short name} · signed by an owner of the project · {fingerprint}" and the credit "Made with Civicsmith" (no word row). No weight mark. |
| dock | `assistant`, `aimoments` | The panel beside a working screen (section 5). Never a page of its own. |
| imported | `imported` | The working frame, with the band "Another team's case: {group} · Edition {edition} · read-only · {recreated} of {findings} findings recreated" (`screen.imported.band`). |

The band under the masthead in the working frame reads "**Working** · not public · seen by your team's members" (`mark.path.working.name`, `shell.band.working`); its explanation is `mark.band.means`. A review copy's band reads "{n} people outside the team can read this until {date}" (`screen.review-copy.band`).

Bands across the top of every frame:
- On a test instance: "**Test Civicsmith** This is a test Civicsmith. Parts of its assistant haven't yet passed Civicsmith's tests, and each answer they give says so." (`instance.test.band`, `instance.test.notice`). A walk's local copy is a test instance and shows it.
- When the live program is newer than the page: "**A newer version is ready** Your team's Civicsmith has been updated since this page opened. Reload when you are ready: nothing reloads by itself." (`shell.update.title`, `shell.update.says`) with button "Reload" (`shell.reload`). Nothing reloads until it is pressed.

The browser tab of a working screen is titled "{screen} · {team} · Civicsmith" (`page.title`), the screen by its `screen.<id>.name`.

## 3. The rail, the phone's tabs and the masthead

### 3.1 The rail (desktop, wider than 760 px)

A navigation landmark named "Sections" (`shell.sections`). The current place carries `aria-current="page"`.

| Link | Key | Leads to | Explanation |
|---|---|---|---|
| "Home" | `rail.home.name` | `home`, `/app` | `rail.home.holds` |
| "Queue", with the count of items waiting when above zero | `rail.queue.name` | `queue`, `/app/queue` | `rail.queue.holds` |
| "Find" | `rail.find.name` | `finder`, `/app/finder` | `rail.find.holds` |
| "Add" | `rail.add.name` | `capture`, `/app/capture` | `rail.add.holds` |
| "Projects" | `rail.projects.name` | `projects`, `/app/projects` | `rail.projects.holds` |
| "People" | `rail.people.name` | `people`, `/app/people` | `rail.people.holds` |
| "Settings" | `rail.settings.name` | `settings`, `/app/settings` | `rail.settings.holds` |

The rail's edge is a separator "Width of the sections list" (`shell.width`): dragging or the arrow keys change the width from 64 to 320 px, Home resets it, and it is kept on this device only (`shell.width.holds`). At 64 px the rail shows icons only, each keeping its name as its accessible name.

### 3.2 The phone's tabs (760 px wide or less)

The rail is replaced by tabs at the foot, a navigation landmark named "Sections".

| Tab | Key | Leads to |
|---|---|---|
| "Home" | `rail.home.name` | `home` |
| "Queue" | `rail.queue.name` | `queue` |
| "Add" | `rail.add.name` | `capture` |
| "Find" | `rail.find.name` | `finder` |
| "More" | `tab.more.name` | `more` (section 10); current also on any screen of Projects, People or Settings |

### 3.3 The masthead (working frame)

In order:
1. The plumb bob mark, image named "Civicsmith" (`shell.mark`), explained by `shell.mark.means`.
2. The team's name as a link to `group-identity`; "Your team" (`shell.group.unnamed`) while it has none. Never the short name.
3. Link "Search" (`shell.search`) to `finder`; an icon only on a phone.
4. Button "Explanations: prompt" (`shell.level.button.prompt`) or "Explanations: on a pause" (`shell.level.button.pause`): switches how quickly explanations open; Alt+Shift+I does the same (`shell.level.holds`).
5. Button "Assistant" (`shell.assistant`), only while the assistant is reachable (section 5).
6. Link "{n} to do" (`shell.todo`) to `queue`, desktop only, never at zero; its explanation is `shell.queue.waiting`.
7. The member's initial, a button named "You: {handle}" (`shell.you`), opening the shell menu.

### 3.4 The shell menu

A menu named "Your menu" (`shell.menu.name`), opened by the initial:
- "{team} · signed in as {handle}" (`shell.menu.who`).
- Link "Your account" (`shell.menu.account`) to `account`.
- Button "Sign out" (`shell.menu.signout`), explained by `shell.menu.signout_does`: ends the session on this device and opens `front` in its "just after signing out" state (section 4).
- Group "Appearance" (`shell.appearance`): "Follow my device", "Light", "Dark" (`shell.appearance.device`, `.light`, `.dark`), one checked; the screens change at once on this device.

### 3.5 Home's area doors

Home's four areas lead on: Investigation to `dash-project`, Action to `dash-action`, Members to `members`, Administration to `settings` (shown on the page `daily-work`).

### 3.6 The path

A navigation landmark "Where you are" (`shell.path`) at the top of every working screen: each earlier step a link back (explained "Back to {place}.", `shell.crumb.back`), "›" between, the screen's own name last and current. The setup, public and published frames draw no path.

## 4. Signing in, staying signed in, the idle lock and signing out

Sign-in is on `front` (page `getting-started`). There the member says what the device is:
- "My own: keep me signed in (it locks after 30 minutes away; you sign in again after 12 hours)" (`session.keep`), chosen by default.
- "Shared or public: sign me out after 15 minutes away" (`session.shared`).

What follows, by device:

| When | What shows |
|---|---|
| Own device, 30 minutes without the member's input | A modal dialog over the screen, heading "Locked" (`shell.lock.title`), "Locked after 30 minutes away. Enter your password to go on where you were; nothing was lost." (`session.locked`), field "Your password" (`shell.password`) with the focus in it, button "Unlock" (`shell.lock.unlock`), button "Not {handle}? Sign in as someone else" (`shell.lock.other`). |
| "Unlock" with the right password | The dialog closes; the same screen, as it was. |
| "Unlock" with a wrong password | The dialog stays; beside the field the refused mark and "That handle and password don't match. Check both and try again; after several tries, sign-in pauses for a while to keep others from guessing." (`refusal.SIGN_IN_REFUSED`). |
| "Not {handle}? Sign in as someone else" | Signs out; `front` in its signed-out state. |
| A page opened later on a locked device | `front` in its locked state: "Welcome back, {handle}" (`screen.front.welcomeback`). |
| Shared device, 15 minutes without input | Signed out; `front` shows "You were signed out after a while away, so nobody else at this device can use your sign-in. Sign in again to go back to the page you were on." (`session.ended`). After sign-in, the page the member was on opens. |
| Own device, 12 hours after sign-in | Signed out; sign in again on `front`. |
| "Sign out" in the shell menu | `front` shows "You are signed out on this device. Your work is saved in your team's Civicsmith, not here." (`session.signedout`). Every open tab of the site follows. |

Password asked again: before signing or publishing a case, changing administrators or connecting Claude, a modal dialog asks it: heading "Enter your password again" (`session.reauth.head`), "For this, enter your password again: signing or publishing a case, changing administrators and connecting Claude always ask." (`session.reauth`), field "Your password", buttons "Go on" (`session.reauth.go`) and "Cancel" (`shell.cancel`). A wrong password: "That password isn't right. Nothing was sent; try again." (`session.reauth.wrong`). "Cancel" sends nothing and keeps what was written.

"Sign out on this device" and "Sign out everywhere" are acts on `account` (page `team-and-account`).

## 5. The assistant dock, and its absence

The assistant panel (`assistant`, frame `dock`) opens beside a working screen, a complementary region named "Assistant" with a close button "Close the assistant" (`shell.assistant.close`). Its content is on the page `projects-and-questions`. Only one panel shows at a time: while a wizard runs, its guide ("Wizard", `shell.guide`) takes the place.

**The assistant is reachable** only when the team has the assistant installed and on, and the member holds an AI account (their own, a project's, or the team's key that is switched on). Then the masthead shows "Assistant".

**Without an AI account (the state every internal walk sees):**
- The masthead has no "Assistant" button; nothing stands in its place.
- No dock is drawn beside any screen; no greyed or disabled control stands for it.
- A screen that offers assistant work draws its path without it, and says why where its page says so.
- Every step marked `AI` on a screen or journey page is recorded not walked.

If a run is asked for and cannot start, the panel says why in words, never blank, for example "The assistant isn't installed in your team's Civicsmith yet, so this run can't start. Nothing was sent. Whoever installed your team's Civicsmith can add it; everything else works without it." (`dock.withheld.AGENT_WORKER_UNBOUND`). The other reasons are `dock.withheld.*`.

## 6. How an act is weighed and confirmed

Every act is a button whose words are its label (`act.<op>.label.<screen>`); its explanation is `act.<op>.does`. An act heavier than Reversible shows dots and its weight's name after the label, and its explanation adds the weight's meaning:

| Weight | Name on the button (key) | Dots | Meaning (key) | What the press does |
|---|---|---|---|---|
| Reversible | none drawn (`weight.reversible.name` "Reversible") | none | `weight.reversible.means` | Runs at once; the button shows working, then done. |
| Reasoned | "Asks for a reason" (`weight.reasoned.name`) | 2 | `weight.reasoned.means` | Opens a reason field beside the act (below). |
| Terminal | "Ends something" (`weight.terminal.name`) | 3 | `weight.terminal.means` | Opens the confirm dialog (below). |
| Signed | "You sign this" (`weight.signed.name`) | 4 | `weight.signed.means` | Opens the confirm dialog, then the signing dialog. |
| Irreversible | "Irreversible" (`weight.irreversible.name`) | 5 | `weight.irreversible.means` | Through its ceremony, or a full dialog that says it can never be undone. |

The dots are explained once: "The dots show how much an act weighs, from two to five. A button without dots does something you can undo." (`weight.dots.means`).

An outward act carries the outward icon, and its explanation adds "Outward: this leaves your team's Civicsmith. Someone outside will see it." (`mark.outward.means`).

The reason field, in place beside the act: field "Your reason" (`shell.reason`) with help "It is kept with the act, under your name." (`shell.reason.help`), buttons "Send with this reason" (`shell.reason.send`) and "Cancel" (`shell.cancel`). Sent empty: "Say why first: this act is sent only with your reason." (`shell.reason.needed`), and nothing is sent. Cancel closes it and sends nothing.

The confirm dialog, beside the act: a dialog named by the act's label, the act's own explanation (what ends), then "Done in your name, {handle}." (`shell.dialog.signs`) or, for a signed act, "Signed with your key, in your name, {handle}." (`shell.dialog.signed`), then buttons "Confirm" (`shell.confirm`) and "Cancel".

The signing dialog (modal): heading "What your key signs, exactly" (`shell.signer.exactly`), a numbered list of what is signed, the line `signing.ceremony.device`, buttons "Sign with my key" (`shell.signer.sign`) and "Don't sign" (`shell.signer.decline`). With no key in the browser it also offers "Use a key file you already have" (`shell.signer.load`).

At phone width a signed or irreversible act is not a button: its label, its explanation, and "Finish this on a larger screen: it is signed, or cannot be undone." (`shell.phone.larger`).

After the press: the button is marked busy and the page announces "Working…" (`shell.working`); after success it shows done for about two seconds, and an act that ends, signs, is irreversible or outward stays disabled until the screen is read again.

## 7. How a refusal is shown

A refusal is drawn in place, beside the act that asked or in the part whose read failed, as the refused mark (icon and words, an alert) and one sentence. It is never a pop-up and never a bare code.

Which words:
1. The screen's own words for that code, where its page names them.
2. Otherwise the shared row `refusal.<CODE>` (2,605 rows). Examples:
   - `refusal.SIGN_IN_REFUSED`: "That handle and password don't match. Check both and try again; after several tries, sign-in pauses for a while to keep others from guessing."
   - `refusal.PASSWORD_TOO_SHORT`: "A password needs at least 12 characters. A short sentence you can remember works well. Nothing was changed."
   - `refusal.NOT_A_PARTICIPANT`: "You hold no place in this project, and this is an act one of its participants takes. Nothing was changed. An owner of the project can invite you to it."
   - `refusal.LAST_ADMIN`: "You are the only administrator of this team, so you cannot step down: the team would be left with nobody to run it. Nothing was changed. Add another administrator first, then resign."
3. A code with no row: "Civicsmith has no explanation of this refusal in its words yet, so its code is shown as the act gave it." (`refusal.uncatalogued`) followed by the code. This is the only place a code is shown.
4. No answer at all, or a server fault without a code: "This could not be read. Try again in a moment." (`shell.unread`).

Where the answer carries a trace, "Reference: {ref}" (`refusal.reference`, eight characters) follows the words. A refusal says what was not done ("Nothing was changed", "Nothing was sent", "Nothing was written"). What the member typed stays in the fields, except a password field, which is cleared. A screen's own check before sending (an empty required field) is drawn the same way, beside the act, for example "Fill in {field} first. Nothing was sent." (`shell.field.needed`).

A screen the member cannot act on, but may read, says "You can read this {noun} and cannot act on it. What each member may do is set under {members}." (`shell.readonly`).

## 8. Accessibility a walker can see

On every screen, at 1280 px and at 390 px wide:
- **Title.** The browser tab names the screen (section 2).
- **Headings.** One heading level 1 names what is shown; sections are headings level 2. The frame's landmarks are named: "Sections" (rail, tabs), "Where you are" (path), "Your menu".
- **Labels.** Every field has a visible label tied to it, and its help is tied to it as its description. Every icon-only control has an accessible name containing its visible word (at the phone width the masthead's words are hidden but kept as names). Personal fields carry autocomplete purposes (handle `username`, passwords `current-password` or `new-password`).
- **Keyboard and focus.** Every act works by keyboard; every control shows a focus ring; a dialog puts the focus in its first field and holds it until closed; explanations open on focus and tap as on hover; sticky bars never cover the focused control.
- **Not by colour alone.** Every mark carries a word or an icon: weights their name and dots, refusals the refused icon and words, grades their letter, the queue's kinds "To do", "Noticed", "Status". Text contrast is at least 4.5 to 1 and lines and marks at least 3 to 1, in light and dark.
- **Targets.** Controls are at least 24 px square (the design draws 40 to 44 px).
- **Phone width.** At 390 px wide nothing is cut off and the page does not scroll sideways; the tabs replace the rail; rows of a table read as cards, each value labelled with its column's name.
- **Status messages.** "Working…", a refusal and a lock are announced to a screen reader (live region, alert or dialog).
- **Language.** The page's language is set; English stands in, word by word, where a translation is missing, never a blank.

## 9. Where the Roadmap's categories live

The rail (section 3) stands as built. The seven navigation categories of the Roadmap (`docs/architecture/BIO_Complete_Roadmap_v5.md`, "Seven categories") live here today:

| Category | Rail place | Screens |
|---|---|---|
| Context (the reference library, with provenance) | Find, Add | `finder` (browse what the team holds), `document`, `held`, `archive`, `open-file` |
| Search (retrieval the member starts) | Find | `finder` (search), `answers` (Ask), `find-in` |
| New Developments (alerts, deadlines, changes) | Queue, Home | `queue` (its kinds To do, Noticed, Status), `due-date`, `home` (what can't wait) |
| Monitoring (watching sources) | Add | `watching`; `registers` (not built) |
| Communications (what goes to and comes from outside) | Queue, Projects | `inbox`, `doorbell`, `about-knocker`, `start-send`, `review-copy`, `imported`, `docket`; no screen holds forum threads |
| Projects (the workspace) | Projects | `projects`, `project`, `dash-project`, `question`, `plan`, `case-editor`, and the record's screens on the page `the-record` |
| Settings (the team's profile and members) | Settings | `settings` and the screens on the page `team-and-account`; the Roadmap's "Notifications" has no screen (Civicsmith sends no email) |

## 10. Screen `unavailable`: "Can't open this"

**Address.** Any `/app/<id>` whose id names no screen, or whose subject does not exist or is malformed; any path outside `/`, `/app`, `/doorbell` and `/tour` (S4). The address stays as typed.
**Frame.** working (S1 to S3); public (S4).
**Who can see it.** Any signed-in member. Without a session, an address under `/app` shows `front` instead and opens the address after sign-in; S4 needs no session.
**Purpose.** Says plainly that an address leads nowhere, that something is not the member's to see, or that the team's Civicsmith can't be reached.
**Entry points.** A mistyped or old address; a link to something deleted or hidden; any screen whose read is refused as not visible to the member; any screen while the team's Civicsmith does not answer.

**Content**
- C1. Path "Can't open this" (`screen.unavailable.name`), the current page.
- C2. Heading level 1: the state's title (S1 to S4 below). No heading says "Can't open this" except S4.
- C3. One sentence under the heading, the state's words.
- C4. The browser tab: "Can't open this · {team} · Civicsmith".
- C5. The rail, tabs and masthead as on every working screen; no rail place is current.

**States**

| State | When | What shows (exact) |
|---|---|---|
| S1 An address that leads nowhere | No such screen, or no such subject | Heading "Nothing is here" (`shell.unavailable.nothing.title`); "This address doesn't lead to anything in your team's Civicsmith. It may have been typed wrong, or the link is old." (`shell.unavailable.nothing.says`); A1 and A2. |
| S2 Something you may not see | The read is refused because the member may not see it (for example a hidden project) | Heading "You can't open this" (`shell.unavailable.notyours.title`); "It exists, or it may not: either way it isn't something you can see. A hidden project shows only to its own members; ask its owner if you think you should be in it." (`shell.unavailable.notyours.says`); A1. |
| S3 Your team's Civicsmith out of reach | No answer, or a server fault, on the session's check | Heading "Your team's Civicsmith can't be reached" (`shell.unavailable.unreachable.title`); as an alert, "Your device is offline, or your team's Civicsmith isn't answering. Nothing you did is lost: what you saved is kept there, and what you were typing is still on this page." (`shell.unavailable.unreachable.says`); note "It tries again by itself every 30 seconds. If it stays out of reach for long, tell whoever holds your team's Cloudflare account." (`screen.unavailable.unreachable.note`). No link. |
| S4 An address outside the team's pages | Any path outside `/`, `/app`, `/doorbell`, `/tour` | Public frame (no rail, no masthead). Heading "Can't open this" (`screen.unavailable.name`); "Nothing is here. This address doesn't lead to any page of this Civicsmith." (`unavailable.public`); A3. HTTP status 404. |

**Actions**

| Control | When offered | Leads to |
|---|---|---|
| A1. link "Go to Home" (`shell.unavailable.home`) | S1, S2 | `home` |
| A2. link "Search" (`shell.search`) | S1 | `finder` |
| A3. link "Go to the front page" (`unavailable.public.go`) | S4 | `front` at `/` (Home with a live session) |
| (none) | S3 | The screen is tried again every 30 seconds; when the team's Civicsmith answers, the screen asked for is drawn in place, with what was typed kept. |

## 11. Screen `more`: "More"

**Address.** `/app/more`.
**Frame.** working.
**Who can see it.** Every signed-in member. Made for the phone; it opens at any width.
**Purpose.** On a phone, the rail's places the tabs do not hold, each with what it holds.
**Entry points.** The phone's tab "More" (`tab.more.name`); the address.

**Content**
- C1. Path "More" (`shell.more`), the current page.
- C2. Heading level 1 "More" (`shell.more`; the screen's name `screen.more.name`).
- C3. Under it: "The places the tabs do not hold." (`screen.more.sub`).
- C4. Three rows, each the place's icon and name as a link, with its line beneath:
  - "Projects" (`rail.projects.name`), "Your team's investigations, their questions, plans and cases." (`rail.projects.line`).
  - "People" (`rail.people.name`), "The people and organizations the record follows. Your own team's members are under Settings." (`rail.people.line`).
  - "Settings" (`rail.settings.name`), "Your own account, assistant, ties, notes and recovery codes; for administrators, the team's settings as well." (`rail.settings.line`).
- C5. The tab "More" is current.

**States.** One: it reads nothing and is the same for every member.

**Actions**

| Control | When offered | Leads to |
|---|---|---|
| A1. link "Projects" | always | `projects` |
| A2. link "People" | always | `people` |
| A3. link "Settings" | always | `settings` |

## Differences seen in the code

- The published frame draws only the screen: no team head, no signature foot, no "Made with Civicsmith" (`bio-plane/src/interface-shell/browser.mjs:1364-1367`).
- An outward act of Reversible weight runs on the press with no full dialog; only its icon and explanation say it is outward (`bio-plane/src/interface-shell/browser.mjs:2132`).
- `unavailable` S1 draws no "Search" link; it draws a link back to the screen's rail place by the place's name, or "Go to Home" when there is none (`bio-plane/src/interface-shell/browser.mjs:1189-1191`).
- `unavailable` S3 does not draw the note `screen.unavailable.unreachable.note` (`bio-plane/src/interface-shell/browser.mjs:1192-1194`).
- `unavailable`'s path shows the state's title ("Nothing is here", or the rail place then the title), not "Can't open this" (`bio-plane/src/interface-shell/browser.mjs:1148-1152`).
- The shell menu's sign-out explanation is `shell.menu.signout_does` ("…goes to the sign-in page"), while `shell.signout.does` says "…returns to your team's page"; both rows exist (`bio-plane/src/interface-shell/browser.mjs:1308`).
- The registry gives `imported` its own frame; the shell draws it as the working frame, the band drawn by the screen as a note (`bio-plane/src/interface-shell/index.mjs:115-121`; `bio-plane/src/screens-publish/imported.mjs:37`).

## Changes

- 22 Nov 2026: written.
