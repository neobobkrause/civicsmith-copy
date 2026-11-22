Length: 334 lines. Last section: "7. What the earlier material lacks for walkable pages".

# 02. The earlier screens and journeys material (docs/development/ux-substrate/)

Research for the UX lane, 2026-11-22. Read from `origin/main` (`git show origin/main:docs/development/ux-substrate/<path>`). All paths below are relative to `docs/development/ux-substrate/` unless they start with `build/` or `bio-plane/`.

**Differences between origin/main and the working tree:** none. `git diff --stat origin/main origin/p4-tranche -- docs/development/ux-substrate/` and `git diff --stat origin/main -- docs/development/ux-substrate/` (working tree on `work/ux-research`, which sits on p4-tranche's content) are both empty. The folder is frozen as the old design stream left it: its last session was UX design #43 (27 Oct 2026, after DEC-453), and its HANDOFF still speaks of the original repository (`believeinoakland/bio`, branch `claude/gallant-brown-zg0wc1`, tranche T52). Nothing in it has been touched since this copy was made.

## 1. What is in the folder

| artifact | what it is | status / published at |
|---|---|---|
| `README.md` | Index of the folder (written for the UX design stream; "as of" `main` @ `c1a27e41a5`, DEC-1 to DEC-95 — stale for the later files) and the old two-account channel rules (UX design session ↔ BOB via `mail/` branches). | — |
| `HANDOFF.md` | The UX design session's handoff: §0 state at 2026-10-27 (#43), §1–7 role, ruling checklist, pages table, brief schema. Its §0 names the open questions A1–A8 and the next work (later-ux triage). | — |
| `NEXT-SESSION-PROMPT.md` | Opening prompt for UX design #43 (takeover acts, effort, words machinery). Procedural only. | — |
| `archive/HANDOFF-*.md` | 20 outgoing §0s (#23–#42) and history to 2026-10-15. History only. | — |
| `ux-substrate-v2.json` (412 KB) | The inventory (2026-10-01): 51 constructs, 83 relationships, 10 roles, **6 lettered journeys** (a)–(e),(k) as actor/act/construct/result steps, 39 display primitives, 38 surfaces, 117 glossary terms, contradictions, rulings. | built into `ux-substrate.html` |
| `ux-experience.json` (918 KB) | Audiences (21), **172 use cases** UC-001… (layer, function, audience, goal, trigger, acts, outcome, coverage), **11 lettered journeys** (a)–(k) with rich per-step fields, 21 surface rules, 36 open questions (all ruled except one "partly"), 9 `designOpen` items. | built into `ux-substrate.html` |
| `ux-substrate.html` (857 KB), `build_ux2.py`; `ux-substrate.json`, `build_ux.py` | The rendered UX substrate page; the first inventory and renderer kept for reference. | https://claude.ai/artifact/JsPZAftab91EL9Ut91qWGx |
| `views/*.html` (plan-page, matter-page, start-and-send, surfaces) | The Action design's screen sketches; `plan-page.html` approved (K608 (4)). | beside the substrate page |
| `design-principles.html` | Step 1: nine families, 58 principles (respect, depth beneath, truth, weight, where you are, the machine looks/the member concludes, alive not noisy, for everyone, one product), gaps G1–G5 ruled. APPROVED 3 Oct. | https://claude.ai/artifact/MvsMPnJnk3o32FBeqgdxT1 |
| `brand-and-voice.html` | Step 2: who speaks, names, voice, tone by moment, words to use/avoid; V1–V4 answered. APPROVED 4 Oct. | https://claude.ai/artifact/EipzYKnNxe5LG3YwWnTkpv (from HANDOFF §5; README gives no URL) |
| `journeys.html` (123 KB) | Step 3: audiences in three rings, the wide path's eight rules, where members start, **27 journeys**, 17 wizard outlines, gaps to close, questions J1–J13 answered. SETTLED 2026-10-06 (DEC-128–DEC-137); folded into the screens page 13 Oct (DEC-204) and **no longer updated**. Uses "group", not "team". | README: https://claude.ai/artifact/SbK4jAc8ZptpE9swYMkF1R ; HANDOFF §5: https://claude.ai/artifact/9hNPVCMcT8eyewWqKXfgSu (the two disagree) |
| `visual-language.html` + `visual-language/` | Step 4: one look built on the plumb bob — type (Source Serif 4 / Sans 3 / Code Pro), colour (`palette.json`, `check_contrast.py`, WCAG 2.2 AA), shape and motion, 46 icons (`icons.svg`), every mark (grades, five gaps, origins, queue kinds, level grid, hold strip, wizard guide, labelled draft), acts' weight, frames. Built CSS `civicsmith.css`. DECIDED 6 Oct (DEC-138). | https://claude.ai/artifact/QuvX7DzX7XbxS6SQG4MtT1 |
| `layouts.html` (1.5 MB) | **Step 5, Bob's working "Screens" page** (DEC-139; library approved DEC-148; S1–S22 ruled). Built by `screens/build_page.py` from `screens/page.src.html` plus every `screens/mock-*.js` and `library.json` inlined (verified: each mock file's text is contained verbatim). Holds the frames, the assistant panel, all journeys and wizards walked live (with/without assistant), the "without the assistant" section, the registry and library as data, decisions and questions. | current: https://claude.ai/artifact/MjC8pWKDj5PrYwm417GLAV (HANDOFF §0/§5, since 25 Oct). Older: 3ZFUNGjgLni5w6MkwWg4d4 (20 Oct), 3RPZY8fPVV9gYANYHjmyqE (19 Oct), 4FjPjGmCVppDnMYfM7xkCw (README's; another organization's account), frozen PjJoJCxMe1LHjt3wPq6rfa, WE1RL6GUUZX4dLeSzbFrbv |
| `screens/registry.src.py` → `registry.json` | **The screen registry**: 91 screens, 662 acts (see §2). | inside layouts.html §5 |
| `screens/library.src.py` → `library.json` | **The wizard library**: 23 scripts, 145 steps (see §3). Approved by Bob 2026-10-06 (DEC-148). | inside layouts.html |
| `screens/check_library.py` | Builds both JSONs and checks every act against `build/requirements` (declared op / requirement function / `owed:` with its ruling) and every wizard step against wizard-scripts R1, R2, R12. | — |
| `screens/mock-*.js`, `page.src.html`, `question.html` | The mockups: `mock-shell.js` (frames, rail `Home Queue Find Add Projects People Settings`, phone tabs `Home Queue Add Find More`, the dock), `mock-kit.js`, `mock-screens.js` (870 KB, one `SCR.<id>` function per screen, sample team "Lakeshore Tenants": Rosa founder, Dev, Mai new, Ana accountant, Teo reporter), `mock-acts.js`, `mock-refs.js`, **`mock-journeys.js` (the 32 journeys)**. | inlined in layouts.html |
| `screens/check_walk.mjs` | Playwright walk of `layouts.html`: every journey (with/without assistant), wizard and screen; proves each step's act is drawn on its screen and every registry act is drawn (AI-only acts exempt without AI). It checks controls exist, **not results**. | — |
| `screens/words*.json`, `words-*.src.py/.mjs`, `build_words.mjs`, `team_words.py`, `check_words_drawn.mjs`, `words-drawn-baseline.json`, `slice-DEC-283.json`, `refusals-dec342-skipped.json` | The keyed word tables (see §2.4). | — |
| `screens/walk-T51b-triage.md`, `later-ux-T52-triage.md`, `parked-T52.md`; `T50-requirements-gaps-2026-10-17.md` | Walk and requirement triage (see §6). | — |
| `questions-alpha-walk.html` | A1–A8, eight questions from the alpha's live walks, open with Bob. | https://claude.ai/artifact/KXfceZqCJkEocZFxyrBAkf |
| `dashboards.html` | Research on area dashboards (cars, work tools, records tools; three models). | https://claude.ai/artifact/DTnwQFKMJR2QLkndW716ja |
| `measures-map.html` | The approved measures map (DEC-82). | https://claude.ai/artifact/TfqcXNaJQ86SZzUA8Xn6Ni |
| `new-name.html` | The naming search (CivicOS → Civicsmith, DEC-124). | https://claude.ai/artifact/Fmr6rVd7GMifYDRaWcV7s8 |
| `question-federal-office.html` | A one-off question page on federal records requests. | — |
| `oq-research/out0-2.json` | Worker outputs used to write open-question briefs. | — |
| `marks/civicsmith-plumb-bob.svg` | The mark (DEC-126). | — |

## 2. The screens

### 2.1 How many and how they group

`screens/registry.json` (generated from `registry.src.py`; `checkedAgainst: origin/main`) holds **91 screens** and **662 acts** (459 `declared` ops, 82 requirement `function`s, 121 `owed:` acts naming the ruling that owes them). Each entry is `{id, name, frame, purpose, acts[{op, label, status, modules}], journeys[]}`. (Stale counts elsewhere: `mock-screens.js`'s header says "46 screens"; `layouts.html` §5's intro says "69 screens and 281 acts" then "91 screens and 662 acts"; `build/plan/lane-journeys/PLAN.md` says 69.)

There are three ways the screens are grouped:

- **Seven source groups** (comment headers in `registry.src.py`): G1 *the team's Civicsmith: setting up, joining, accounts* (27); G2 *daily work* (15); G3 *projects and questions* (6); G4 *the record's subjects* (11); G5 *deciding and acting* (11, "bound sketches: the plan page, start and send"); G6 *publishing* (8); G7 *outside the team* (13, including the seven first-beta AI screens added by DEC-420). These are the natural "groups of screens" for one page per group.
- **Frames** (`frame` field; drawn by `mock-shell.js`, visual-language §8): `working` 75, `setup` 5, `public` 5, `published` 3, `dock` 2 (the assistant panel and "When the AI can't go on"), `imported` 1.
- **Rail places / areas** (`mock-shell.js` `RAIL`, `TABS`; `mock-screens.js` `AREA_GO`): Home, Queue, Find, Add, Projects, People, Settings (phone: Home, Queue, Add, Find, More); Home's area blocks Investigation → `dash-project`, Action → `dash-action`, Members, Administration → `settings`.

### 2.2 States

The registry holds no states. States live only in the mockups: each `SCR.<id>` in `screens/mock-screens.js` takes `c = {ai, v}` and most draw a `mk-mockctl` selector ("In this mockup, show …") whose options are the screen's states, keyed by per-screen maps such as `FRONT_ST`, `HOME_ST`, `Q_ST`, `MATTER_ST`, `CER_ST`. Extracted: **51 screens draw two or more states (268 states in all); 40 draw one** (no selector, though some show sub-states inside disclosures, e.g. `aimoments`' twelve moments chosen by `v`). The largest: `install` 18, `ceremony` 13, `question` 12, `matter` 10, `project` 8, `queue` 7, `people` 7, `published` 7, `contradiction` 7. Examples:

- `front`: to a visitor; after a refused sign-in; while sign-in is paused; just after signing out; after a sign-in ended for being idle; locked, on a device kept signed in.
- `home`: busy team member who may start projects; new member's first visit (may / may not start projects); member with no project open; founder of a new team.
- `question`: the question; each passage asked; new, nothing cited; assistant at work; assistant's proposal; limit reached; concluded; concluded on a member's own reading; run ended without a proposal; run stopped; deferred; dismissed.
- `unavailable`: an address that leads nowhere; something you may not see; your team's Civicsmith out of reach.

The table below gives each screen's state count; the state names are in the selectors in `mock-screens.js`.

### 2.3 Where each screen's words come from

Since DEC-179/K3268 every sentence a screen draws is meant to be a **keyed word**: `screens/words.json` ("The interface word list", built by `build_words.mjs` from the mockups' sources, "never edit by hand") holds **19,467 rows** `{key, en, protected?, source}`, 1,162 protected (DEC-157 (4): fixed terms, weights, warnings before outward/signed/irreversible acts, the court notice, who-can-see notices). Keys are stable when English changes. Screen words are `screen.<id>.<part>` (7,869 rows; per-screen counts are the "words" column below); shared prefixes are `act.<op>.label.<screen>` (1,298), `refusal.<CODE>` (2,605), `queue.*`, `installer.*`, `wizard.*`, `shell.*`, `ai.*`, `label.*`, and one prefix per product module (e.g. `calculations.*`, `case-disclosures.*`). The rows come from: `words-drawn.src.py`→`words-drawn.json` (7,425 rows drawn on the mockups, DEC-259), `words-mod-1..4.src.py` and `words-modules.*` (module English keyed, DEC-260), `words-t46..t49.*`, `words-actions.*` (290 action rows), plus `registry.json` (act labels, 745), `library.json` (wizard what/why, 313) and the mock files. `words-reads*.json` record, per product module, exactly which keys it reads through `setup-words`' `word(key, vars)` and which inline strings it may keep (`unkeyed`, with reasons; `words-reads-handoffs.json` adds BOB's). `check_words_drawn.mjs` fails if a screen draws more unkeyed sentences than its ratchet in `words-drawn-baseline.json` (now 0 for all 69 screens it lists). `team_words.py` rewrites "group" → "team" (DEC-281). The product builds its runtime word table from these files (`bio-plane/src/setup-words/build.mjs`, per HANDOFF §0).

For a walkable page this means: the words an internal walk compares are in `words.json` under `screen.<id>.*` and `act.*.label.<id>`, not in prose; the registry `purpose` is the only prose statement of what a screen is for.

### 2.4 Full table of screens

Groups: G1 Team (setup, joining, accounts) · G2 Daily work · G3 Projects and questions · G4 The record's subjects · G5 Deciding and acting · G6 Publishing · G7 Outside the team. "states" = options in the mockup's state selector (1 = none); "words" = `screen.<id>.*` rows in `words.json`; "journeys" = the registry's own `journeys` field (which disagrees with the journeys' actual steps: §7).

| id | name | grp · frame | acts | states | words | journeys | purpose (shortened from the registry) |
|---|---|---|---|---|---|---|---|
| `site` | civicsmith.org | G1 · setup | 0 | 4 | 70 | 1,28 | Civicsmith's own website, one site of three pages joined by one menu: the front page… |
| `install` | Create your Civicsmith team | G1 · setup | 8 | 18 | 148 | 1,28 | The founder's link and the installer, in order: what Civicsmith is and what is needed… |
| `update` | Update your team's Civicsmith | G1 · setup | 1 | 4 | 4 | 1 | The hosting account's holder updates the team's Civicsmith to the signed release chosen… |
| `front` | Your team's page | G1 · public | 2 | 6 | 24 | 3,28 | The team's own landing page at its address: who it is, what it has published, handing… |
| `tour` | How we work, step by step | G1 · public | 0 | 6 | 22 | 3 | The walk-through for anyone, offered on the team's page before joining: what the team… |
| `reset` | Choose a new password | G1 · public | 1 | 3 | 9 | 3 | The administrator's one-time reset link opens here: the member chooses a new password… |
| `forgot` | Forgot your password | G1 · public | 1 | 3 | 16 | 3 | Getting back in without email: any member with one of their recovery codes, or through… |
| `setup` | Set up your team's Civicsmith | G1 · setup | 18 | 5 | 179 | 1,28 | The founder claims it, choosing their own handle, names the team, reviews offices and… |
| `group-identity` | Who your team is | G1 · working | 2 | 2 | 34 | 2 | Kinds, focus and purpose, and who sees them |
| `join` | Your invitation | G1 · setup | 5 | 5 | 43 | 3,28 | The invitation link opens here: language, handle, password |
| `home` | Your team's home | G1 · working | 16 | 5 | 133 | 3,6 | The team's nerve center: the strip, what needs you, what needs the team, each area at a… |
| `members` | Members | G1 · working | 13 | 3 | 196 | 16,27 | The roster: invitations, capabilities, expertise, administrators, joining through the… |
| `security` | Security | G1 · working | 5 | 2 | 123 | 27 | Administrators only: how hard the team's Civicsmith is being tried over a period they… |
| `account` | Your account | G1 · working | 9 | 3 | 65 | 3,16 | Handle, password, language, expertise, signing key, theme |
| `connect` | The assistant | G1 · working | 9 | 6 | 133 | 4,17 | The member's own API key or subscription token, or the team's key where it offers one… |
| `teamai` | The team's assistant | G1 · working | 6 | 1 | 13 | — | Administrators: the team's API key and whether it is on; what it pays for; its limits… |
| `bias` | Declared bias | G1 · working | 7 | 6 | 125 | 2 | The lens the team reads evidence through, stated so a reader can discount it: read what… |
| `places` | Places and offices | G1 · working | 5 | 2 | 41 | 2 | Administrators: the places whose rules apply, the place a team wants that Civicsmith… |
| `recovery` | Recovery codes | G1 · working | 1 | 2 | 13 | 2 | Every member's own one-time recovery codes, how many are left, and whether two… |
| `group` | Your team | G1 · working | 12 | 1 | 93 | 2 | Administrators: the settings chosen at setup, changeable here: name and logo, website… |
| `settings` | Settings | G1 · working | 0 | 1 | 14 | 2,3 | Every setting in one list: the member's own, then the team's for administrators |
| `more` | More | G1 · working | 0 | 1 | 3 | 2 | The phone's More tab: the rail's places the tabs do not hold, each a row with its icon… |
| `updates` | Updates | G1 · working | 6 | 3 | 41 | 19 | Administrators: the release the team's Civicsmith runs; the release ready to install… |
| `ties` | Your ties | G1 · working | 2 | 1 | 40 | 5 | The member's own ties, seen only by them and administrators |
| `notes` | Your notes | G1 · working | 5 | 1 | 39 | 6 | A member's own notes, seen only by them |
| `translations` | Translations | G1 · working | 5 | 2 | 50 | 3 | The interface's words in the team's languages |
| `wizards` | Wizards | G1 · working | 6 | 1 | 88 | — | The team's wizard library: offered, drafts, submitted |
| `projects` | Projects | G2 · working | 5 | 3 | 33 | 6 | Every project the member may see, with its owner, questions and stage; the team's… |
| `theme` | Themes | G2 · working | 4 | 2 | 6 | 6 | The team's themes, newest first, searchable by name or test, and declaring one; one… |
| `dash-action` | The Action dashboard | G2 · working | 3 | 1 | 25 | 22 | An area dashboard in three tiers: status, what needs you, then every action with whose… |
| `dash-project` | A project's dashboard | G2 · working | 3 | 1 | 26 | 15 | A project as a dashboard: the next steps for the member here, in order, each the act… |
| `unavailable` | Can't open this | G2 · working | 0 | 3 | 3 | 3 | An address that leads nowhere, something the member may not see, and the team's… |
| `elsewhere` | Where else to go | G2 · working | 0 | 2 | 2 | 6 | What a member sees when what they need is not Civicsmith's work: the places the team's… |
| `queue` | Your queue | G2 · working | 22 | 7 | 103 | 19,23 | To do, Noticed and Status, grouped by case |
| `finder` | Find | G2 · working | 14 | 6 | 102 | 6,7 | Search what the team holds, or browse it by kind and state with no words; hold a set… |
| `capture` | Add | G2 · working | 12 | 1 | 195 | 6,7,9,15 | Capture a document from an address or a file, photograph a handout, or record what you… |
| `held` | Held captures | G2 · working | 4 | 1 | 64 | 15 | Captures not yet vouched for, per member and project |
| `archive` | Archive | G2 · working | 4 | 2 | 43 | 15 | A captured ZIP: every file with its state; vouching or setting files aside; an archive… |
| `open-file` | Opening a file | G2 · working | 5 | 4 | 81 | 7,15 | Before a file opens: its risk, the safe view, the deeper check, its checks as notes… |
| `document` | Document | G2 · working | 35 | 2 | 316 | 7,15,23 | One captured document: its copy and grade note, its words by page with citing, its… |
| `contradiction` | Two documents in tension | G2 · working | 7 | 7 | 186 | 7 | One contradiction between two sources: both passages as written, side by side, what the… |
| `find-in` | Find in this | G2 · working | 9 | 1 | 78 | 6,10 | One control on a document, a held set or a project: pick what to find; each result… |
| `project` | Project | G3 · working | 24 | 8 | 239 | 6,9,15 | A project's home: objective, bar, questions, stage, plans, what the team has at stake… |
| `objective` | Objective | G3 · working | 10 | 2 | 149 | — | A project's objective on its own page: what success means and how it is measured; how… |
| `projectai` | AI for this project | G3 · working | 9 | 5 | 48 | — | Who pays for the assistant's work in a project: its own API key, or its sole member's… |
| `question` | Question | G3 · working | 34 | 12 | 276 | 6,9,15,16 | A question and what supports it or cuts against it; what each cited passage carries… |
| `answers` | Ask | G3 · working | 5 | 4 | 37 | 17,18 | Ask in plain words or by search; keep asking |
| `assistant` | The assistant panel | G3 · dock | 4 | 1 | 34 | 17 | Docked beside the screen it serves; runs on whichever account serves the member, the… |
| `people` | People | G4 · working | 5 | 7 | 91 | 10,13 | A directory of the people and organizations the record follows, never the team's own… |
| `person` | Person | G4 · working | 15 | 5 | 171 | 10 | A person or an organization the record follows: positions, career, credentials… |
| `timeline` | Timeline | G4 · working | 16 | 3 | 111 | 11 | What they did and what we did, in two lanes; the matters the project follows through a… |
| `money` | Money trail | G4 · working | 18 | 1 | 169 | 12 | Money facts with stage and period; a trail; reconciling sources |
| `calculation` | Calculation | G4 · working | 9 | 1 | 109 | 9 | A computed fact with its method, or a member's spreadsheet bound to the record |
| `help-records` | Help: How a records request works | G4 · working | 0 | 1 | 26 | 7 | What your state's public records law requires of the office, your city's faster request… |
| `help` | Help: How spot-checks work | G4 · working | 0 | 1 | 14 | 9 | A help page: one method explained in plain words, linked from where it is used |
| `explore` | Explore connections | G4 · working | 12 | 2 | 102 | 13 | Chains between a start and an end, each step cited and graded |
| `proceeding` | Proceeding | G4 · working | 5 | 1 | 79 | 14 | A court case or regulatory proceeding: parties, register, orders and their dates |
| `due-date` | How this date was worked out | G4 · working | 3 | 1 | 40 | 7,8 | A due date's basis and counting; confirm it; download it |
| `standard` | Standard | G4 · working | 9 | 4 | 113 | 6,14,22 | A requirement the city set itself, held and searchable |
| `plan` | Action plan | G5 · working | 11 | 3 | 242 | 22 | The approved plan page: subjects, options, scenarios, what each option became |
| `start-send` | Start and send | G5 · working | 11 | 2 | 142 | 7,22 | The bound start-and-send flow: refusals first, reason in place, approve then record the… |
| `glossary` | Glossary | G5 · working | 0 | 1 | 27 | — | What the terms and marks in the record mean: money terms, how the record is kept… |
| `actionnew` | Start an action | G5 · working | 3 | 1 | 31 | — | The composer for a new action of any kind: the kind, who it goes to, what it asks, how… |
| `request` | Request records | G5 · working | 8 | 2 | 76 | 7 | A records request: the office by role, what is wanted, the law, the text, approving and… |
| `action` | Action | G5 · working | 12 | 5 | 246 | 7,22 | One action: replies, deadlines, the law it goes under, its risk tier, pressure, holds… |
| `hold` | Litigation hold | G5 · working | 4 | 1 | 35 | — | A litigation hold: any member who can see the action or the case places one, with a… |
| `holdnotice` | Hold notice | G5 · working | 3 | 1 | 22 | — | The plain-words notice telling members what to keep outside Civicsmith, prepared from… |
| `counsel` | Brief counsel | G5 · working | 3 | 2 | 58 | — | A packet for the team's lawyer, for a claim or for a defense: each matter's support as… |
| `grouprules` | Your team's own rules | G5 · working | 4 | 1 | 110 | — | A deadline or a legal fact the jurisdiction's profile lacks, drafted by a member from… |
| `matter` | Matter | G5 · working | 17 | 10 | 271 | 22 | One government act: determination, consequences, escalation, actions |
| `case-editor` | Case | G6 · working | 12 | 3 | 180 | 15,23 | Prepare the case: scope, statement, what it leaves out, bias, timeline, people named |
| `review-copy` | Review copy | G6 · working | 5 | 2 | 56 | 21 | A named outsider's revocable view of the draft |
| `ceremony` | Publication ceremony | G6 · working | 15 | 13 | 169 | 15,24 | The required wizard: checks, disclosures, ties confirmed, preview, then signing inside… |
| `review-outside` | A review copy, from outside | G6 · published | 2 | 1 | 16 | 21 | What an outside reviewer sees from a review link: the draft, how long the link works… |
| `published` | Published case | G6 · published | 6 | 7 | 192 | 26 | The public page: findings, strengths, timeline, people named, evidence; checkable… |
| `imported` | Another team's case | G6 · imported | 9 | 3 | 92 | 25 | An imported case in its read-only project, recreated finding by finding |
| `docket` | Docket | G6 · working | 4 | 1 | 65 | 23,24 | The case's public docket: corrections, withdrawals, court orders |
| `docket-public` | A case's docket, from outside | G6 · published | 0 | 1 | 4 | 26 | A published case's docket, read without an account |
| `inbox` | Inbox | G7 · working | 4 | 1 | 54 | 20 | Material handed in through the doorbell |
| `doorbell` | Hand material to the team | G7 · public | 2 | 1 | 60 | 20 | The doorbell page for someone outside, with no account |
| `about-knocker` | A source | G7 · working | 5 | 1 | 64 | 20 | What became known about someone who handed material in, who may read it, what they… |
| `leads` | Leads | G7 · working | 5 | 1 | 42 | — | Write down something you were told, record who looked and what they found, and share it… |
| `watching` | Watched addresses | G7 · working | 9 | 1 | 99 | — | Every address the team watches, pausing the watching, what is due and the sweeps |
| `registers` | Public registers | G7 · working | 17 | 1 | 96 | 10,12,14 | The public registers the team holds, bringing one in whole, searching and citing a row… |
| `aiproviders` | AI providers | G7 · working | 9 | 2 | 74 | 32 | First beta: administrators set up the team's AI. How things stand, the accounts in use… |
| `aiconnect` | Connect an AI | G7 · working | 8 | 1 | 98 | 32 | First beta: a guided connection for one chosen plan, in six steps: what it is sent and… |
| `aimine` | Your AI | G7 · working | 3 | 1 | 38 | 32 | First beta: every member's own page. What serves you now, choosing among what the team… |
| `aiproject` | AI for this project | G7 · working | 4 | 1 | 23 | 32 | First beta: a project owner narrows which of the team's AIs the project uses, sets its… |
| `aimoments` | When the AI can't go on | G7 · dock | 12 | 1 | 44 | 32 | First beta: what the assistant panel shows, one moment at a time and never as a silent… |
| `aitest` | Test an AI that isn't listed | G7 · working | 4 | 1 | 40 | 32 | First beta: administrators test a custom endpoint or an unlisted plan before it is… |
| `airesults` | Results other teams sent | G7 · working | 1 | 1 | 9 | 32 | First beta: every member may read what other teams' tests found for each AI: the parts… |

Screens no journey's steps ever reach (39): `update, tour, reset, forgot, teamai, bias, places, recovery, group, settings, more, translations, wizards, theme, dash-action, dash-project, unavailable, elsewhere, archive, contradiction, objective, projectai, help-records, help, glossary, actionnew, hold, holdnotice, counsel, grouprules, review-outside, docket-public, about-knocker, leads, watching, registers, aiproject, aitest, airesults`. Twelve also have an empty `journeys` field in the registry (teamai, wizards, objective, projectai, glossary, actionnew, hold, holdnotice, counsel, grouprules, leads, watching).

## 3. The wizard library

`screens/library.src.py` → `screens/library.json` (`approved: "Bob, 2026-10-06 (DEC-148)"`; ids `WIZ-<sha256("civicsmith:"+first name)[:16]>`, kept when renamed group→team, DEC-281). Each script: `{id, origin:'civicsmith', scope:'group', name, start (screen), required, journeys[], note, versions[{version:1, state:'draft', steps[]}]}`; each step `{screen, act|null, what (≤300 chars), why (≤300), draft?: {text}|{template}|{machine:op}, via?: another wizard (a side trip)}`. No step presses, signs or sends; places, laws and venues never appear (K1). **23 wizards, 145 steps, 3 required.**

| wizard | starts at | req. | steps | journeys | side trips / notes |
|---|---|---|---|---|---|
| Set up and claim | install | yes | 16 | 1, 2 | via Say who your team is |
| Welcome a new member | join | yes | 7 | 3 | via Connect your Claude account, Your ties; "final words once the redesign has settled" (DEC-91) |
| Publication ceremony | ceremony | yes | 11 | 15, 24 | |
| Get a record | finder | | 9 | 7, 8 | one draft: `{template:'@records-request'}` on `request`/`communicationprepare` |
| Check a claim | capture | | 9 | 9 | via Get a record |
| Your first question | project | | 6 | 6, 15 | |
| Say who your team is | group-identity | | 4 | 2 | |
| Invite a member | members | | 4 | 3, 27 | |
| Update your team's Civicsmith | updates | | 3 | 19 | |
| Connect your Claude account | connect | | 8 | 4, 17 | superseded in the first beta by Your AI (DEC-420) |
| Your ties | ties | | 3 | 5 | |
| Follow a proceeding | capture | | 5 | 14 | |
| Follow the money | capture | | 5 | 12 | |
| Build a timeline | timeline | | 5 | 11 | |
| Keep asking this | answers | | 4 | 18 | |
| Use another team's case | imported | | 4 | 25 | |
| Translate the interface | translations | | 5 | 3 | assistant drafts where reachable |
| Comment for the team | plan | | 6 | 22 | DEC-194 (B140) |
| Demand a correction | plan | | 8 | 22 | DEC-194 |
| Take an escalation to its next stage | matter | | 5 | 22 | DEC-194 |
| Refer it to an oversight body | plan | | 7 | 22 | DEC-194 |
| Pick up a plan | plan | | 4 | 22 | DEC-194 |
| Start and send | plan | | 7 | 22 | |

Home's "Start from…" doors (`library.json` `doors`): *problem* → Your first question, Get a record, Check a claim; *person* → Your first question, Follow the money, Build a timeline; *money* → Follow the money, Get a record; *read* → Check a claim, Follow a proceeding, Use another team's case; *tip* → Check a claim, Build a timeline; *elsewhere* → opens the `elsewhere` screen. `journeys.html` §5 had 17 wizard outlines (including "Invite a member" and "Translate the interface"); the library added Update, and the five Action wizards (DEC-194).

## 4. The journey lists

### 4.1 Where each list lives

| list | file | count | date / basis | shape |
|---|---|---|---|---|
| **A. Step 3's journeys** | `journeys.html` §4 (`<article class="jcard" id="j1">`…`j27`) | 27 | settled 2026-10-06 (DEC-128–DEC-137), last edited about 13 Oct, then frozen (DEC-204). Says "group". | card: number, title, verdict (New/Amended/Confirmed), purpose, who, front door, wizard, what changed, built now, still to come, steps (actor + sentence + weight mark), sources |
| **B. The journeys walk plan** | `build/plan/lane-journeys/PLAN.md` §3 (outside the folder; JOURNEYS #1 for BOB #192, 2026-10-16, "Journey numbers are `journeys.html`'s") | 27 numbered 1–27, plus its own row "28" and two unnumbered rows | written for the live walk of the trial instance | table row: #, journey (with screens), role A/M, mode Walk/Look/Out, "what works means for it" |
| **C. The walked journeys** | `screens/mock-journeys.js` `const J`, inlined verbatim in `layouts.html` (Bob's working Screens page); short purpose and front door in `JBRIEF` beside it | 32 | 1–27 from step 3 plus 28 (DEC-201), 29 (DEC-245, K3320), 30 (DEC-286), 31 (DEC-294), 32 (DEC-420, K4623). Says "team". | `{n, t, who, wiz | steps[{s, act, say, only, v, dock}], noai}` |

Older, lettered lists that list A replaced (`ux-experience.json` meta `journeysSettled`: journeys.html "supersedes" them): `ux-experience.json` `journeyExperience` (11: (a)–(k)) and `ux-substrate-v2.json` `journeys` (6: (a)–(e), (k)). They appear in the reconciliation as a column.

The intro text in `layouts.html` and `screens/page.src.html` §3 still says "All twenty-seven journeys from step 3, journey 28 … and every wizard". It names neither 29–32 nor the count the page actually walks (32). The registry's `journeys` fields cite 1–32, and the library's cite 1–27. (If "the second 27" means something else: inside the folder, the only other 27-count is this stale intro sentence. The walk plan is the only other list of 27 that has its own rows.)

### 4.2 Reconciliation table

"Steps" = number of steps recorded in that list (for C, a wizard journey's steps are its wizard's). "Starts at" = list C's first screen. "AI" = whether list C has steps only the assistant can do (`only:'ai'`). Lettered = the older list's journey it replaces.

| # | A: journeys.html (steps) | B: walk plan PLAN.md §3 (mode) | C: mock-journeys.js / layouts.html (steps · wizard) | lettered | starts at | AI | goal (one line) |
|---|---|---|---|---|---|---|---|
| 1 | A group gets going (10) | 1 A group gets going (site, installer, update, claim) · Look | A team gets going (16 · Set up and claim) | (a) | **installer** (`install`) | no (offers the AI choices) | Install, claim, name and configure the team's Civicsmith |
| 2 | The group says who it is and why (8) | 2 The group says who it is · Walk | The team says who it is and why (4 · Say who your team is) | — | group-identity | no | Say the team's kind, focus and purpose, and who sees it |
| 3 | A member joins and finds their footing (7) | 3 · Walk | same (7 · Welcome a new member) | (a) end | join (invitation link) | no | From an invitation to a first useful act |
| 4 | Connecting your own Claude account (6) | 4 Connect your own account · Look | same (8 · Connect your Claude account) | (e) start | connect | **whole journey is connecting an AI account**; replaced in the first beta by Your AI (DEC-420) | Connect one's own AI account, serving only oneself |
| 5 | Declaring your own ties (4) | 5 Your ties · Walk | same (3 · Your ties) | — | ties | no | Record one's ties so a case can disclose them |
| 6 | From a problem to a question (6) | 6 · Walk | same (9) | — | home ("Start from…") | **yes**, 1 step (ask for the standard); no-AI alternative: search | Turn a lived problem into a question against the city's own standard |
| 7 | Getting a record: find it, or ask for it (8) | 7 · Walk | same (9 · Get a record) | (h) | finder | no (template replaces the AI draft) | Find a public record, or request it under the law |
| 8 | Checking a deadline's basis (6) | 8 · Walk | same (4) | (h) | action (a request already open) | no | See and confirm how a due date was counted |
| 9 | Checking a claim about the city's performance (7) | 9 · Walk | same (9 · Check a claim) | — | capture | no | Hold a claim, the city's records, spot-checks and a calculation together |
| 10 | Following a person (8) | 10 · Walk | same (8) | — | document | **yes**, 1 step (ask about other posts); no alternative | Dated, cited facts about a person |
| 11 | Building a timeline (7) | 11 · Walk | same (5 · Build a timeline) | — | timeline | no | Two-lane timeline: what they did, what we did |
| 12 | Following a money trail (7) | 12 · Walk | same (5 · Follow the money) | — | capture | no | Money facts by stage and period, a trail, reconciliation |
| 13 | Exploring connections (6) | 13 · Walk | same (5) | — | people | no | A chain between two records, each step cited and graded |
| 14 | Following a court case or proceeding (7) | 14 A court case or proceeding · Walk | same (5 · Follow a proceeding) | — | capture | no | A proceeding's parties, register, orders and deadlines |
| 15 | From a question to a published case (11) | 15 · Walk to the ceremony | same (9) | (b) | capture | no | Evidence, a concluded question, a signed published case |
| 16 | A professional lends expertise (5) | 16 · Walk | same (5) | — | account | no | Declare expertise; be asked to check work |
| 17 | Working with the assistant (7) | 17 · Look | same (6: 4 AI-only, 2 no-AI) | (e) | question | **yes**, 4 steps; no-AI path: "Find and count", no assistant anywhere | Ask the assistant to find, read, answer and check; decide what to keep |
| 18 | Asking a standing question (6) | 18 A standing question · Look ("needs the assistant") | same (4 · Keep asking this) | — | answers | partly: with AI reads what is new; without, a list | Re-check a question on a schedule until a date |
| 19 | The daily queue (9) | 19 · Walk | same (7) | (d) | queue | no | What is waiting on a member today |
| 20 | From a knock to the record (3) | 20 · Walk | same (3) | (f) | doorbell (public, no account) | no | Material handed in becomes evidence, or is set aside |
| 21 | A review copy, out and back (3) | 21 · Walk to the link | same (3) | (g) | review-copy | no | A named outsider reviews a draft and comments |
| 22 | From suspicion to a closed plan (9) | 22 · Walk | same (9) | (k), absorbs (c) (DEC-137) | question | **yes**, 1 step (adopt the assistant's suggestion) | Plan, act, follow to an outcome, close |
| 23 | A source changes after publishing (3) | 23 · Walk if a published case exists | same (3) | (i) | queue | no | Correct or withdraw openly when a source changes |
| 24 | Complying with a court order (3) | 24 · Look | same (3) | — | capture | no | Comply with a court order openly, never silently |
| 25 | Exchanging cases with other groups (7) | 25 · Look | Exchanging cases with other teams (4 · Use another team's case) | — | imported | no | Import, check and build on another team's case |
| 26 | Reading and checking a case (5) | 26 · Walk, signed out | same (3) | — | published (public) | no | A stranger reads a case and checks it |
| 27 | Changing the administrators (2) | 27 · Walk | same (2) | (j) | members | no | Add or remove an administrator |
| 28 | absent | absent (B's "28" is another journey, below) | From civicsmith.org to a new member's first work (22) | — | **website** (`site`) | no | Website, install, setup, invite, a new member's first work, with no break |
| 29 | absent | absent | From installing to a first conclusion (18: 5 AI-only, 1 no-AI) | — | **installer** (`install`) | **yes**, 5 steps (team key, run, proposal); one no-AI substitute (search) | Install to a first concluded question: "the release Bob must be able to use" (K3320) |
| 30 | absent | absent | Getting into a project (6) | — | home | no | A member who may not start projects joins one; its owners decide |
| 31 | absent | absent | Following someone new (3) | — | people | no | Follow a person or organization the record does not hold yet |
| 32 | absent | absent | Adding a second AI, and work that continues on it (11: 4 AI-only) | — | aiproviders | **yes**, 4 member steps; admin steps need two providers' accounts | Add a second provider's plan; a member's work continues on it, never silently |
| B28 | absent | 28 Arrive, sign in, sign out · Walk | absent (parts in C 3, 28) | — | front | no | The team's page explains itself; sign-in, kind refusal, sign-out |
| B-s | absent | — Settings and account · Walk | absent | — | settings | no | Every setting saves and shows itself back in words |
| B-r | absent | — Recover and sign in again · Walk | absent | — | forgot / reset | no | A recovery code or reset link sets a new password |

**Distinct journeys: 35.** That is the 32 numbered in list C, plus three rows only the walk plan has. Every lettered journey maps onto a numbered one: (c) "Acting on a finding" was folded into 22 by DEC-137; (h) "A records request round trip" became 7 and 8.

Of list C's 32: **three begin at the website or installer** (1 and 29 at `install`, 28 at `site`), and two more at public pages with no account (20 at `doorbell`, 26 at `published`). **Six have AI-only steps:** 6, 10, 17, 22, 29, 32. Of these, only 6, 17 and 29 give a no-AI substitute step, and 32's `noai` text says a member without AI sees none of its member steps. Journey 4 is about AI as a whole (connecting an account) but has no `only` flags, because it is a wizard journey. Journey 18 needs the assistant for its "with AI" reading.

### 4.3 How the lists differ

1. **Coverage.** A stops at 27. C adds 28–32 from later rulings (28 DEC-201, 29 DEC-245/K3320, 30 DEC-286, 31 DEC-294, 32 DEC-420/K4623). B keeps 1–27 and adds its own walk-only rows ("Arrive, sign in, sign out", "Settings and account", "Recover and sign in again"). **B's "28" is a different journey from C's 28**, so the number 28 is ambiguous across the lists.
2. **Words.** A says "group"; C and the registry say "team" (DEC-281, K3472). A's front doors are also older: in journey 6, A has Home asking "What brought you here?", C has "What happened?" (DEC-218).
3. **Steps.** A's steps are prose, actor first, no screen named (e.g. journey 1: 10 steps). C's steps name a screen and an act, or for a wizard journey reuse the wizard's steps (journey 1: 16). A's and C's step counts differ for 18 of 27 journeys. A's "Built now / Still to come" lines describe T33 (October 5) and are stale.
4. **AI.** A describes the assistant as "your own Claude account" or the group's key. C's 29 and 32 and the registry's first-beta screens (`aiproviders`, `aiconnect`, `aimine`, `aiproject`, `aimoments`, `aitest`, `airesults`) replace that with AI providers (DEC-420). C's journeys 4 and 17 still speak of a Claude account, and the registry says "In the first beta, Your AI takes its place".
5. **Purpose.** A is a design statement for Bob. B is a test plan: it says what "works" means for each journey, and whether to walk it or only look at it. C is an executable mock walk (`check_walk.mjs`) that proves controls exist.
6. **Registry back-references disagree with C.** For 26 of 32 journeys, the screens the registry's `journeys` field claims for a journey differ from the screens its steps visit. Examples: J7 claims `open-file, document, contradiction, help-records, start-send, action`, none of which it walks. J29 walks nine screens, none of which name 29. J3 claims `front, tour, reset, forgot, account, settings, translations, unavailable`, none of which it walks.

## 5. Step structure as recorded

- **List A** (`journeys.html`): `<li><span class="actor">installer</span>sentence… <weight mark></li>`. The weight marks are Permanent, Signed, Outward, Reasoned, Terminal, Irreversible. Each card also has front door, wizard, what changed, built now, still to come, and sources.
- **List C** (`mock-journeys.js`): `{s: screen id, act: op or null, say: what happens (in Bob's words), only: 'ai'|'noai', v: screen variant (a state of §2.2), dock: open the assistant panel}`. The journey-level fields are `noai` (what a member without the assistant does), and `JBRIEF[n] = [purpose, front door]`. A wizard journey (`wiz`) expands to the library's steps (`journeySteps()`), whose fields are `{screen, act, what, why, draft?, via?}`.
- **Lettered** (`ux-experience.json` `journeyExperience[].steps[]`): `{step, whoIsActing, whatTheyKnow, decisionTheyMake, whatCanGoWrong[], howLong, handoffTo, feelingRisk, src, basis, openInThisStep[]}`. This is the only list that records failures per step (for example "Existing copy for the slug: refused, nothing changed (installer R5)"). `ux-substrate-v2.json`: `{actor, act, construct, result, src}`, the only list with a **result** per step.

**One full example: journey 6, list C** (`screens/mock-journeys.js` lines 15–23). Its brief is "Someone joins because something in their life isn't working…"; its front door is "Home asks 'What happened?'".

| # | screen | act | only | say |
|---|---|---|---|---|
| 1 | home | startfrom | | Mai opens the team's home and picks "A problem I live with". |
| 2 | notes | notewrite | | She writes the problem in her own words, in a note only she can see. |
| 3 | capture | testify | | She records what she has seen on Seminary Avenue: where, when, and a photo. |
| 4 | answers | ask | ai | She asks the assistant what standard the city set itself. It quotes Administrative Instruction 4.12 from what the team holds, as legal information. |
| 5 | finder | search | noai | She searches what the team holds for "pothole" and finds the city's own instruction, section by section. |
| 6 | find-in (v doc) | findin | | On the instruction she uses "Find in this" for dates, deadlines and requirements. It lists "within seven calendar days" at passage 3, found by search. |
| 7 | standard | standarddeclare | | She holds the seven-day rule as a standard the city must meet. |
| 8 | project | promote | | She turns the problem into a question the record can answer, in the Pothole repairs project. |
| 9 | request | addresseesuggest | | The records she needs are not public, so she asks for them (journey 7). |

The same journey in list A (`journeys.html` `#j6`) has six actor-first steps: "member · Describes the problem in their own words, in a note only they can see…"; "member · Finds the standard the city set itself… With their own Claude account connected, they can ask the assistant… it quotes the text and says it is legal information, not legal advice"; …; sources "Bob, 4 October; Roadmap §5; doctypes T33-13; standards T33-31; …; K1474".

## 6. Prior walks, triage, and questions still open

- **`screens/walk-T51b-triage.md`** (B541, the 0.87.0 live walk, 2026-10-27; source `build/plan/walk-T51b-live/placement-design-unknown.md` §3 on `tranche/T51b`) lists 35 design items:
  - **Blocks:** DS9 (a member cannot open their own photograph: `NO_SAFE_VIEW`); DS28 (`TEMPLATE_NOT_NAMED` with no control that names a template).
  - **Misleads:** e.g. DS1 (the admin confirm says "makes … an administrator" when the act only proposes); DS16 ("nothing is here" while an invitation waits); DS2 (Start a project's journey step "with an objective", but the form has none); DS4 (one act with two names); DS35 (five fixed outcome words and no free box).
  - **Awkward or cosmetic:** the rest.
  - **Patterns it names:** engine and doctrine sentences shown verbatim (DS7, 14, 21, 23); a refusal that sends the member away or says nothing exists while the next step is on the same screen (DS10, 16, 19, 28, 30, 33, 34); labels that don't say their outcome; plurals.
  - **Five screen questions:** C-K2, C-K6, B-K19, D-K9, E-K7. D-K9 and E-K7 were the design's to decide (DEC-444). The others went to Bob as A1–A3.
- **`screens/later-ux-T52-triage.md`:** about 160 entries from `build/plan/later-ux.md` on `tranche/T52`, sorted W (words, ~61), C (code, ~41), D (done, ~43) and B (decisions, ~10). W groups 1–3 were done as DEC-452 and DEC-453. Still open: the Add and Document line (round 9's code keys, items 82–159), and the B drawings (the safe view's first pages, a spreadsheet's "show more", Cancel for a parted upload).
- **`screens/parked-T52.md`:**
  - Words parked from T51: "the machine" → "the assistant"; counts that read wrongly at 1; one fact with two wordings; fix round 7's 14 code keys still in developer English.
  - Requirement-first items: C-M9 (naming a Timeline event), C-M7 (naming someone in a document with no recognised reference), C-M12, and the leg-grade op.
  - C-M2 went to Bob as A8.
- **`T50-requirements-gaps-2026-10-17.md`:** T50's screen requirement lines against the design.
  - Not drawn at all: Find-in R48's flow form, `recordpersonfact` validity, a proceeding's court choice, "Same person?"'s in-place form, the dock asking for a subject, Document's "In which question", Timeline's "Dated in the documents", and Request's no-office state and stake lines.
  - Drawn but disagreeing: about 10 items.
  - Words exist but states are undrawn: many.
  - Its own caveat: "a reader's report, not a ruling".
- **Open with Bob** (`questions-alpha-walk.html`, 27 Oct; HANDOFF §0; still unanswered on origin/main, where the last DEC is DEC-453, and `build/plan/T52-R1.md` still lists them as waiting). Each question gives three options and a recommendation:
  - A1: who a question is about (rec. A: ask at opening, allow later).
  - A2: whose fiscal year Money counts in (rec. B: the government's).
  - A3: who sees where a handed-in file came from (rec. A: listed members only).
  - A4: whether a member can look at their own photograph (rec. B: a safe view for pictures).
  - A5: two things called "Capture", and publishing an ungraded case (rec. B: rename, plus a warning at signing).
  - A6: signing-key queue noise and the device box (rec. B: one item per member).
  - A7: other projects' documents in pickers (rec. B: this project first).
  - A8: whether a typed page checked by a second member can be cited (rec. A).
- **Also still open:** one `ux-experience.json` question is "partly" open (how a published case says whether a named office or official was asked, and what happens to a late reply). The nine `designOpen` items are all Action-page detail (scenarios on narrow screens, the disposition chip, empty and loading states of the plan page, …).
- **Outside the folder but relevant:** `build/plan/lane-journeys/FINDINGS.md` (the JOURNEYS lane's findings) and `build/plan/walk-T51-final/coverage/*.md`. The latter notes that "the map's '11 journeys' is stale", and that the library cites journeys 1–27 while layouts cites 1–31.

## 7. What the earlier material lacks for walkable pages

1. **No single journey list.** There are three current lists and two lettered ones. Numbers collide (B's 28 is not C's 28), and the vocabulary differs ("group" vs "team"; Claude account vs AI providers). One list needs to be chosen, with stable ids. C (32) plus B's three walk-only rows is the full set.
2. **No expected result per step.** C's `say` is a story sentence that mixes act and outcome, and has invented sample data ("Administrative Instruction 4.12", "within seven calendar days at passage 3"). A's steps say what the actor does. Only `ux-substrate-v2.json`'s lettered steps carry a `result`, and only `ux-experience.json`'s carry `whatCanGoWrong`. None of them states the end state of a journey that an external walk could check on a deployed copy: what record exists, what the screen says, and who can see it.
3. **No "what must be present" words for AI steps.** AI-only steps (6, 10, 17, 22, 29, 32) describe the answer's content ("It quotes Administrative Instruction 4.12…") rather than what must be checkable whatever the model says: the machine-work label, the quoted passage and its citation, "legal information, not legal advice", where it looked, the limit or cost line, and the no-AI fallback. `check_walk.mjs` exempts AI-only acts without AI and checks only that controls exist. No list says how to walk an AI step on a deployed copy without a live model (the product has `bio-plane/src/journey-check/fake-model.mjs`).
4. **No preconditions or seed data.** Journeys start mid-story: 8 needs an open request, 23 a published case, 21 a draft case, 30 a member who may not start projects, 32 two providers' accounts. The sample team (Lakeshore Tenants, Mai, Dev, Rosa; Oakland) is mockup data, not a seed.
5. **Wizard journeys have no per-step result.** Journeys 1, 2, 3, 4, 5, 7, 9, 11, 12, 14, 18 and 25 are walked "step for step" by their wizard. The wizard's `what` and `why` say what to do and why, never what is then on screen.
6. **Screen states are only mock selector labels.** They are not in the registry, have no stable ids beyond `*_ST` letters, and 40 screens have none. The internal walk needs each screen's states named, with the words each state shows (`words.json` keys) and when each state occurs.
7. **Screen words are only keys.** The Screens document has to give each screen its words: purpose, sections and acts, mapped to `screen.<id>.*` and `act.*.label.<id>` keys. The 19,467-row `words.json` cannot be read as a page. The registry `purpose` is the only prose, and it is long and full of DEC citations.
8. **Coverage gaps.** 39 screens are never reached by a journey, including all settings sub-pages, both dashboards, `contradiction`, `objective`, the Action subsidiaries (`hold`, `holdnotice`, `counsel`, `grouprules`, `actionnew`), `registers`, `watching`, `leads`, and three of the seven first-beta AI screens. The registry's `journeys` back-references disagree with the journeys for 26 of 32 (§4.3 point 6).
9. **Stale status text.** A's "Built now / Still to come", the README's "as of `c1a27e41a5`", and the screen counts (46, 69, 281) are all out of date. The published-URL lists disagree (journeys: SbK4… vs 9hNP…; screens: 4FjP… vs MjC8…).
10. **Open decisions touch journeys.** A1 (question subject: journeys 6, 15, 29), A2 (fiscal year: 12), A3 (knock source: 20), A4 (own photograph: 6, 9, 15), A5 (Capture and ungraded publish: 15), A6 (signing keys: 15, 19), A7 (pickers: 15) and A8 (typed page cited: 15) are all unresolved. The pages for these journeys must mark the affected steps as waiting.
