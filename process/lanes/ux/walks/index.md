Length: 106 lines. Last section: "6. Changes".

# civicsmith: the walks' documents — index

The Screens document and the journeys, against which the walks measure the product (Process4 design part 3, section 3; build text 3, section 2). Kept by the UX lane; its design decisions rank 5 on `process/ranking.md`, below the mission, principles, standards and requirements, which it never overrides. During a tranche these pages change only to correct an error a walk has shown, as ARCH passes it to the lane, and each change is named in the account after the round.

Written 22 Nov 2026 by civicsmith ux lane #1 from the earlier material in `docs/development/ux-substrate/` (the screen registry, the mockups, the word table and the three journey lists), reconciled in the lane's research (`process/lanes/ux/research/02-earlier-screens-and-journeys.md`). That folder is now history: where it and these pages differ, these pages are the Screens document and the journeys.

## 1. How the pages are kept

- **One page for each group of screens, one page for each journey, and this index** (build text 3, section 2). A group's name is its page's name. Every page stays under the single-text maximum (60,000 bytes); a walking session reads the pages of its areas in full, plus the page "Every screen", and nothing else.
- **Areas.** For the internal walk an area is a screen group page, or one screen on it, named `screen <page> / <screen>`. For the external walk an area is one journey page.
- **Names that do not change.** A screen is named by its registry id (for example `question`), which is also its address: `/app/<id>`, with Home at `/app` and the team's page `front` at `/` (research 03, section 9). A screen's parts are numbered on its page: content lines `C1…`, states `S1…`, actions `A1…`, form messages `V1…`. A journey is named `J01`…`J35`; its steps are numbered and never renumbered (a removed step's number is not reused).
- **What a step header follows** (build text 3, section 3): `follows: screen <page> / <screen> / <part>` for an internal step, for example `follows: screen daily-work / queue / S2`; `follows: journey j19-the-daily-queue / step 3` for an external one.
- **Words.** The exact words a screen shows are quoted on its screen page only, from the interface word table (`words.json`, built into the product's `setup-words`), each with its key. A journey page names the screen part it expects, and does not repeat the words.
- **Marks on a screen or a step.** `not built`: designed, with no code yet; a walk records it as a flaw only once a module's requirement names it as met. `AI`: needs a connected AI account; until the owner connects one, such a step or journey is recorded not walked (build text 3, section 5; the owner's decision A, 20 Nov 2026). `waiting <question>`: the design is not settled; the step is walked as written and a difference is an observation, not a flaw.

## 2. The rules every page keeps

1. Every line states one thing that can be seen: on the screen, after an act, or after a reload. No "works", "correct", "properly" or "nice".
2. Controls are named by their role and their words (`button "Vouch for it"`), never by colour, position or code.
3. Every screen lists its states, or says why it has only one.
4. Every action names where it leads, by screen id, or what changes on the same screen.
5. Every journey has one goal, its actors, what must be so before it starts, numbered steps with numbered expected results, the end state checked after a reload, and the ways it can turn aside.
6. A journey that changes data starts from what earlier journeys made on the same copy (its "Follows" line), never from a hidden seed. The test data in section 5 is used by every journey.
7. A step that uses AI never expects exact words. It states what must be present in any proper result, what must never be present, and what a member without the assistant sees instead (build text 3, section 5; the owner's decision of 20 Nov 2026). Every journey with an AI step also gives its path without the assistant, which is walked first: the alpha ships without the assistant (DEC-405), and the assistant is "absent, not greyed" (DEC-139).
8. What binds every screen is said once, on the page "Every screen", and not repeated.

## 3. The Screens document: eleven pages, 91 screens

| Page | What its screens are for | Screens |
|---|---|---|
| [every-screen](screens/every-screen.md) | The frames, the rail and the phone's tabs, the assistant dock, signing out and the lock, how a refusal is shown, accessibility, and the two screens the frame draws itself | `unavailable`, `more` |
| [getting-started](screens/getting-started.md) | Before and at the door: the website, the installer and updating, the team's page, the tour, setting up, joining, a forgotten password | `site`, `install`, `update`, `front`, `tour`, `reset`, `forgot`, `setup`, `join` |
| [team-and-account](screens/team-and-account.md) | The team, its members and its settings; a member's own account, ties, notes and recovery | `group-identity`, `members`, `security`, `account`, `connect`, `teamai`, `bias`, `places`, `recovery`, `group`, `settings`, `updates`, `ties`, `notes`, `translations`, `wizards` |
| [daily-work](screens/daily-work.md) | Home, the queue, finding and adding material | `home`, `projects`, `theme`, `dash-action`, `dash-project`, `elsewhere`, `queue`, `finder`, `capture`, `held`, `archive`, `open-file`, `find-in` |
| [reading-a-document](screens/reading-a-document.md) | One captured document, and two documents in tension | `document`, `contradiction` |
| [projects-and-questions](screens/projects-and-questions.md) | A project, its objective, its questions, asking, and the assistant panel | `project`, `objective`, `projectai`, `question`, `answers`, `assistant` |
| [the-record](screens/the-record.md) | What the record follows: people, time, money, calculations, connections, proceedings, dates, standards, and help | `people`, `person`, `timeline`, `money`, `calculation`, `help-records`, `help`, `explore`, `proceeding`, `due-date`, `standard` |
| [deciding-and-acting](screens/deciding-and-acting.md) | Matters, plans and actions: records requests, starting and sending, holds and counsel | `plan`, `start-send`, `glossary`, `actionnew`, `request`, `action`, `hold`, `holdnotice`, `counsel`, `grouprules`, `matter` |
| [publishing](screens/publishing.md) | Preparing, reviewing, signing and reading a case, its docket, and another team's case | `case-editor`, `review-copy`, `ceremony`, `review-outside`, `published`, `imported`, `docket`, `docket-public` |
| [outside-the-team](screens/outside-the-team.md) | What comes from outside: the doorbell and inbox, sources, leads, watched addresses, public registers | `inbox`, `doorbell`, `about-knocker`, `leads`, `watching`, `registers` |
| [ai](screens/ai.md) | The team's AI and each member's own (the first beta, DEC-420) | `aiproviders`, `aiconnect`, `aimine`, `aiproject`, `aimoments`, `aitest`, `airesults` |

Not built when written (research 03, section 6): `registers`, and the seven screens on the page `ai`.

## 4. The journeys: 35

The list to use is this one (the owner, 20 Nov 2026: the UX design lane maintains the journey list). It is the 32 journeys the earlier Screens page walked (`screens/mock-journeys.js`), with their numbers kept so that the product's walker and the registry still agree, and three journeys the earlier walk plan had alone (`build/plan/lane-journeys/PLAN.md`, section 3), numbered 33 to 35. Journey 4 is renamed from "Connecting your own Claude account", since the first beta connects AI providers of any kind (DEC-420).

| Id | Journey | Who | Starts at | AI |
|---|---|---|---|---|
| J01 | [A team gets going](journeys/j01-a-team-gets-going.md) | Founder | `install` | — |
| J02 | [The team says who it is and why](journeys/j02-the-team-says-who-it-is-and-why.md) | Administrator | `group-identity` | — |
| J03 | [A member joins and finds their footing](journeys/j03-a-member-joins-and-finds-their-footing.md) | New member | `join` | — |
| J04 | [Connecting your own AI account](journeys/j04-connecting-your-own-ai-account.md) | Member | `connect` | AI |
| J05 | [Declaring your own ties](journeys/j05-declaring-your-own-ties.md) | Member | `ties` | — |
| J06 | [From a problem to a question](journeys/j06-from-a-problem-to-a-question.md) | New member | `home` | AI, with a no-AI path |
| J07 | [Getting a record: find it, or ask for it](journeys/j07-getting-a-record-find-it-or-ask-for-it.md) | Member | `finder` | — |
| J08 | [Checking a deadline's basis](journeys/j08-checking-a-deadlines-basis.md) | Member | `action` | — |
| J09 | [Checking a claim about the city's performance](journeys/j09-checking-a-claim-about-the-citys-performance.md) | Member | `capture` | — |
| J10 | [Following a person](journeys/j10-following-a-person.md) | Member | `document` | AI |
| J11 | [Building a timeline](journeys/j11-building-a-timeline.md) | Member | `timeline` | — |
| J12 | [Following a money trail](journeys/j12-following-a-money-trail.md) | Member | `capture` | — |
| J13 | [Exploring connections](journeys/j13-exploring-connections.md) | Member | `people` | — |
| J14 | [Following a court case or proceeding](journeys/j14-following-a-court-case-or-proceeding.md) | Member | `capture` | — |
| J15 | [From a question to a published case](journeys/j15-from-a-question-to-a-published-case.md) | Member, then signer | `capture` | — |
| J16 | [A professional lends expertise](journeys/j16-a-professional-lends-expertise.md) | Member with expertise | `account` | — |
| J17 | [Working with the assistant](journeys/j17-working-with-the-assistant.md) | Member | `question` | AI, with a no-AI path |
| J18 | [Asking a standing question](journeys/j18-asking-a-standing-question.md) | Member | `answers` | AI, with a no-AI path |
| J19 | [The daily queue](journeys/j19-the-daily-queue.md) | Member | `queue` | — |
| J20 | [From a knock to the record](journeys/j20-from-a-knock-to-the-record.md) | Outsider, then member | `doorbell` | — |
| J21 | [A review copy, out and back](journeys/j21-a-review-copy-out-and-back.md) | Member, then outside reviewer | `review-copy` | — |
| J22 | [From suspicion to a closed plan](journeys/j22-from-suspicion-to-a-closed-plan.md) | Member | `question` | AI, with a no-AI path |
| J23 | [A source changes after publishing](journeys/j23-a-source-changes-after-publishing.md) | Member | `queue` | — |
| J24 | [Complying with a court order](journeys/j24-complying-with-a-court-order.md) | Administrator | `capture` | — |
| J25 | [Exchanging cases with other teams](journeys/j25-exchanging-cases-with-other-teams.md) | Member | `imported` | — |
| J26 | [Reading and checking a case](journeys/j26-reading-and-checking-a-case.md) | Anyone, signed out | `published` | — |
| J27 | [Changing the administrators](journeys/j27-changing-the-administrators.md) | Administrator | `members` | — |
| J28 | [From civicsmith.org to a new member's first work](journeys/j28-from-civicsmith-org-to-a-new-members-first-work.md) | Founder, then new member | `site` | — |
| J29 | [From installing to a first conclusion](journeys/j29-from-installing-to-a-first-conclusion.md) | Founder | `install` | AI, with a no-AI path |
| J30 | [Getting into a project](journeys/j30-getting-into-a-project.md) | Member who may not start projects | `home` | — |
| J31 | [Following someone new](journeys/j31-following-someone-new.md) | Member | `people` | — |
| J32 | [Adding a second AI, and work that continues on it](journeys/j32-adding-a-second-ai-and-work-that-continues-on-it.md) | Administrator, then member | `aiproviders` | AI |
| J33 | [Arriving, signing in and signing out](journeys/j33-arriving-signing-in-and-signing-out.md) | Member | `front` | — |
| J34 | [Settings and account](journeys/j34-settings-and-account.md) | Member, then administrator | `settings` | — |
| J35 | [Recovering and signing in again](journeys/j35-recovering-and-signing-in-again.md) | Member | `forgot` | — |

## 5. The test data every journey uses

One made-up team in one made-up city, the same the product's own walker and mockups use (research 03, section 3.3; research 02, section 1):

| Item | Value |
|---|---|
| City | Lakeshore |
| Team | "Lakeshore Tenants", short name `lakeshore-tenants` |
| Founder and first administrator | Rosa, handle `rosa-l` |
| Members | Mai (new member), Dev, Ana (an accountant, who lends expertise), Teo (a reporter) |
| Question used across journeys | "Has the landlord been ordered to repair the roof of 14 Lakeshore Row?" |
| The city's document it rests on | Housing notice 2026-118, which orders the roof repair |

A journey page names any further data it creates, in its own "Test data" table. Where a document must be captured from an address, the journey names the document; which address serves it on a development copy is ARCH's to say.

## 6. Changes

- 22 Nov 2026: written. The pages are being filled in from the earlier material; until a page exists, its row above names it only.
