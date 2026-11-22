Length: 521 lines. Last section: "9. What this means for the Screens document and the walk".

# UX research 03: the existing product code, as it bears on the user's experience

Branch `work/ux-research`, read at commit `a349bfec` (2026-11-22). Everything below was read from the code; each claim cites `file:line`. Paths are repo-relative. No code was run except read-only imports of the screen modules to list their ids (Section 1.3), and nothing was deployed.

## 0. Key findings, in short

1. **The member interface is one single-page app inside the bio-plane Worker.** `GET /`, `GET /app` and every `GET /app/<anything>` answer the same HTML page built from nine screen modules. The page's own script does the routing (`/app/<screen-id>/<subject>`). There are **78 screens** in code, plus 2 pages the shell draws itself (`unavailable`, the `more` place).
2. **Two more Workers serve pages people see before a team exists:** `site/` (civicsmith.org: `/`, `/start`, `/groups`, plus a 404 page) and `newgroup/` (the installer wizard: `/`, `/update`, and the progress page streamed at `/callback`). Add the static invitation page `bio-plane/public/newgroup/index.html` (hosted elsewhere, not served by bio-plane). That makes **84 served screens/pages** in all (78 + 2 + 3 + 3, not counting the 404 pages or the static invitation page).
3. **The design registry lists 91 screens; 78 are built as bio-plane screens.** Of the 13 others, 3 are built outside bio-plane (`site`, `install`, `update`), 2 are drawn by the shell (`unavailable`, `more`), and **8 have no code at all**: `registers` and the seven AI screens of journey 32 (`aiproviders`, `aiconnect`, `aimine`, `aiproject`, `aimoments`, `aitest`, `airesults`).
4. **First use is password and handle, not passkey or email.** The installer gives a one-time password (the `ADMIN_TOKEN`) in the URL fragment. The founder claims the copy at `/app/setup#boot=…`, choosing a handle and a password of 12 or more characters, and gets ten recovery codes. Members join by invitation link (`/app/join#invite=…`). The code has no WebAuthn, passkey or email sign-in.
5. **The walker is a Playwright program, not a list of data steps.** Steps are `walk.step(page, "<label>", async fn)` calls. Count: 66 literal step calls across 4 files, plus one generated step per registry screen in each sweep. It has two arms. The **local** arm (Miniflare, a fake Cloudflare account and a fake model) walks the whole first-use journey. The **live** arm needs `--live <address>`, credentials for a founder and a member who already exist (`JOURNEY_*` env), and an instance that says `test_instance: true`. As written in process.json, `run_steps` passes `--live` with no address, so the walk is refused `NO_INSTANCE` (`bio-plane/src/journey-check/run.mjs:300`).
6. **No `walk/internal` or `walk/external` folders exist anywhere in the repository.** `process/lanes/` did not exist before this file.
7. **The words are keyed.** Every member-facing sentence is read by key from `setup-words` (`WORD_ROWS`: 19,467 design rows from `docs/development/ux-substrate/screens/words.json`, plus 7,515 rows written first in code). The UI holds no English of its own.
8. **The assistant is a dock** (`screens-inquiry/assistant.mjs`, frame `dock`). It is drawn only when the assistant is on and the member or team holds an AI account. Without one, the deployed product shows no stand-in: the dock is absent and screens say why. The only stand-in model is the walker's `journey-check/runner.mjs` with `fake-model.mjs`, bound under Miniflare in the local arm only.

---

## 1. Where member-facing screens are built, and every screen served

### 1.1 The bio-plane Worker's page routes

The Worker's entry is `bio-plane/src/plane/index.mjs` (named in `bio-plane/wrangler.jsonc:11`). Its default export wraps `control-plane`'s `makeFetch` (`bio-plane/src/plane/index.mjs:24`). The page routes are in `bio-plane/src/control-plane/index.mjs` and `bio-plane/src/control-plane/app.mjs`:

| Request | Answer | Cite |
|---|---|---|
| `GET /version` | plain-text version | `control-plane/index.mjs:893` |
| `GET /favicon.ico` | 204, no body | `control-plane/index.mjs:899` |
| `GET /` (no `op=`) | the interface page (draws `front` signed out, Home signed in) | `control-plane/index.mjs:905-911` |
| `GET /app`, `GET /app/<path>` | the same interface page, `no-store` | `control-plane/app.mjs:28-35`, `control-plane/index.mjs:916-929` |
| `GET /app/shell-<version>.js` | the shell's script, immutable | `control-plane/app.mjs:51-57` |
| `GET /app/assets/<name>` | stylesheet, icons, fonts (`interface-assets`) | `control-plane/app.mjs:94-108` |
| `GET /app/assets/group-logo` | the team's logo | `control-plane/app.mjs:114-115` |
| `GET /doorbell`, `GET /tour` | the interface page at 200 (public frame) | `control-plane/app.mjs:67-76` |
| any other `GET /<path>` that names no op | the interface page at 404 (`unavailable`) | `control-plane/app.mjs:68-76`, `control-plane/index.mjs:935-942` |
| `/api/<op>`, `?op=<op>`, `/<op>` | JSON ops, not pages | `control-plane/index.mjs:944-945` |

`/sign` is no longer a route; it falls through to the "nothing is here" page (`control-plane/index.mjs:887`). The old server-drawn setup page is gone: "No route serves the setup page" (`control-plane/index.mjs:904`; `bio-plane/src/setup.mjs:4-5`).

The screens composed into the page are the nine modules' `SCREENS`, joined in `control-plane/index.mjs:54-64`: entry, settings, intake, daily, inquiry, wizards, investigate, publish, action. The wizard guide is added as an option (`APP_OPTIONS`, line 65).

### 1.2 How the page routes inside itself (interface-shell)

`bio-plane/src/interface-shell/browser.mjs` holds the client program:

- `hrefOf(screen, subject)` gives `/app` for Home and `/app/<screen>[/<subject>]` for every other screen (`browser.mjs:1103-1110`).
- `parse(pathname)` (`browser.mjs:1111-1139`) reads the address the other way. `/` gives Home with a session and `front` without one. `/doorbell` and `/tour` outside `/app` give their screens. Any other path outside `/app` gives `unavailable`. `/app/review` is `review-outside` (`ADDRESSES`, `interface-shell/index.mjs:124`). `question` takes `/app/question/<id>/<project>` (`PROJECT_PART`, `index.mjs:128`).
- Old fragment addresses are forwarded: `/#invite=` and `/#join=` go to `/app/join`, and `/#boot=` goes to `/app/setup` (`browser.mjs:2894-2900`). The fragment keys `boot`, `invite`, `join`, `reset` and `grant` are read once and then removed from the address (`browser.mjs:2902-2916`).
- **Frames** (`interface-shell/index.mjs:115-121`):
  - public, no session: `front`, `tour`, `reset`, `forgot`, `doorbell`
  - published, no session: `published`, `review-outside`, `docket-public`
  - setup, with or without a session: `setup`, `join` (and the registry's `site`, `install` and `update`)
  - dock: `assistant`
  - every other screen: the working frame, which needs a session; without one the shell shows `front` and keeps the address to return to (`browser.mjs:1609-1622`).
- **Rail places** (`PLACE_SCREENS`, `index.mjs:84-86`): home, queue, find, add, projects, people, settings. Breadcrumb paths per screen are in `PATHS` (`index.mjs:43-77`).
- `PUBLIC_PAGES`, the nine named pages with a public tab title (`index.mjs:135`): front, tour, reset, forgot, doorbell, published, docket-public, review-outside, join.
- The page refuses to compose if a screen is not in the registry or names an act the registry does not allow (`checkScreens`, `index.mjs:184` ff.). So the registry copy in code (`wizard-scripts/screen-registry.mjs`, generated from `registry.json` at commit `b1adf4236d`, `wizard-scripts/build-data.mjs:29`) gates what can be served.

### 1.3 The 78 screens in bio-plane, by module

The ids were read by importing each `screens-*/index.mjs`. The address is `/app/<id>` unless noted. "Frame" is the shell's; everything not listed in 1.2 is working.

**screens-entry**: 6 screens, `SCREENS` at `screens-entry/index.mjs:28`

| id | file:line | frame | address |
|---|---|---|---|
| front | `screens-entry/front.mjs:11` | public | `/`, `/app/front` |
| tour | `screens-entry/tour.mjs:7` | public | `/tour`, `/app/tour`, `/app/tour/2`…`/6` |
| forgot | `screens-entry/forgot.mjs:10` | public | `/app/forgot` |
| reset | `screens-entry/reset.mjs:10` | public | `/app/reset#reset=<link>` |
| setup | `screens-entry/setup.mjs:26` | setup | `/app/setup#boot=<otp>` |
| join | `screens-entry/join.mjs:11` | setup | `/app/join#invite=…` / `#join=…` |

**screens-settings**: 16 screens, `screens-settings/index.mjs:106`

| id | file:line |
|---|---|
| settings | `screens-settings/settings.mjs:9` |
| members | `screens-settings/members.mjs:25` (a member's page `/app/members/<handle>`, `interface-shell/browser.mjs:554`) |
| teamai | `screens-settings/teamai.mjs:11` |
| account | `screens-settings/account.mjs:21` |
| connect | `screens-settings/connect.mjs:19` (the member's own Claude sign-in) |
| notes | `screens-settings/notes.mjs:11` |
| group | `screens-settings/group.mjs:20` |
| group-identity | `screens-settings/identity.mjs:15` |
| places | `screens-settings/places.mjs:21` |
| recovery | `screens-settings/recovery.mjs:11` |
| security | `screens-settings/security.mjs:25` |
| translations | `screens-settings/translations.mjs:15` |
| updates | `screens-settings/updates.mjs:17` (administrators only, `interface-shell/index.mjs:88-92`) |
| glossary | `screens-settings/glossary.mjs:10` |
| grouprules | `screens-settings/grouprules.mjs:16` |
| bias | `screens-settings/bias.mjs:14` |

**screens-intake**: 8 screens, `screens-intake/index.mjs:230`. Each id, then its file:line:
- capture: `capture.mjs:1404`
- held: `held.mjs:154`
- archive: `archive.mjs:65`
- open-file: `open-file.mjs:257`
- inbox: `inbox.mjs:202`
- about-knocker: `about-knocker.mjs:174`
- leads: `leads.mjs:118`
- watching: `watching.mjs:190`

**screens-daily**: 7 screens, `screens-daily/index.mjs:214`. Each id, then its file:line:
- home: `home.mjs:25` (`/app`)
- elsewhere: `elsewhere.mjs:9`
- projects: `projects.mjs:11`
- queue: `queue.mjs:25`
- finder: `finder.mjs:12` (the `/app/find` place)
- find-in: `find-in.mjs:11`
- answers: `answers.mjs:11`

**screens-inquiry**: 8 screens, `screens-inquiry/index.mjs:23`. Each id, then its file:line:
- project: `project.mjs:1234`
- dash-project: `dashproject.mjs:386`
- question: `question.mjs:1841`
- document: `document.mjs:2086`
- assistant (dock): `assistant.mjs:376`
- projectai: `projectai.mjs:226`
- objective: `objective.mjs:385`
- contradiction: `contradiction.mjs:407`

**screens-wizards**: 1 screen, `screens-wizards/index.mjs:32`
- wizards: `library.mjs:32`
- Plus the **guide**, the wizard runner docked beside any screen (`screens-wizards/guide.mjs:1-7`). It is not a screen: it is passed as `APP_OPTIONS.guide`.

**screens-investigate**: 12 screens, `screens-investigate/index.mjs:19`. Each id, then its file:line:
- people: `people.mjs:241`
- person: `person.mjs:555`
- explore: `explore.mjs:273`
- timeline: `timeline.mjs:350`
- money: `money.mjs:405`
- calculation: `calculation.mjs:251`
- help: `calculation.mjs:252`
- proceeding: `proceeding.mjs:235`
- due-date: `due-date.mjs:144`
- standard: `standard.mjs:397`
- ties: `ties.mjs:70`
- theme: `theme.mjs:116`

**screens-publish**: 9 screens, `screens-publish/index.mjs:25`. Each id, then its file:line:
- case-editor: `case-editor.mjs:10`
- review-copy: `review-copy.mjs:10`
- ceremony: `ceremony.mjs:27`
- published (published frame): `published.mjs:11`
- imported: `imported.mjs:9`
- docket: `docket.mjs:9`
- docket-public (published frame): `docket-public.mjs:9`
- doorbell (public frame, `/doorbell`): `doorbell.mjs:8`
- review-outside (published frame, `/app/review`): `review-outside.mjs:10`

**screens-action**: 11 screens, `screens-action/index.mjs:86`. Each id, then its file:line:
- plan: `plan.mjs:14`
- start-send: `start-send.mjs:14`
- request: `request.mjs:12`
- action: `action.mjs:17`
- matter: `matter.mjs:12`
- help-records: `help-records.mjs:12`
- actionnew: `actionnew.mjs:13`
- hold: `hold.mjs:13`
- holdnotice: `hold.mjs:192`
- counsel: `counsel.mjs:11`
- dash-action: `dash-action.mjs:13`

Total: 6 + 16 + 8 + 7 + 8 + 1 + 12 + 9 + 11 = **78**.

**Drawn by the shell itself, not by a screen module:**
- `unavailable`: "Can't open this". Drawn for an address outside the team's pages, a malformed address, or a missing subject (`interface-shell/browser.mjs:1117-1120`, `:1151`, `:1167`).
- `more`: the phone's More place (`browser.mjs:1141`, `:1166`).
- A rail place with no built screen ("comes later") (`browser.mjs:1597-1602`; `interface-shell/index.mjs:80-82`).

### 1.4 site/ (civicsmith.org)

`site/src/index.mjs` is a static Worker with no session or state (header, lines 1-5).
- Routes: `{ "/": "home", "/start": "start", "/groups": "groups" }` (`site/src/index.mjs:9`), plus `/favicon.svg`, `/favicon.ico` and `/app/assets/*` (lines 10-11).
- Pages: `home`, `start`, `groups`, `groupsEmpty` and `notFound` are prebuilt HTML in `site/src/pages.mjs:5-9`, generated by `site/build.mjs`. The CSP allows no script (`site/src/index.mjs:12`).
- Registry id: `site` (frame setup, journeys 1 and 28).

### 1.5 newgroup/ (the installer wizard)

`newgroup/src/index.mjs` is entered at `newgroup/wrangler.jsonc:11`.

| Request | Page | Cite |
|---|---|---|
| `GET /` | the wizard ("Create your new Civicsmith group"): the short name, the confirmation, what Cloudflare will be asked | `newgroup/src/index.mjs:1411-1412` |
| `GET /update?version=` | the update page | `:1416-1417` |
| `GET /app/assets/*` | the faces and stylesheet | `:1420` |
| `POST /begin` | JSON: mints PKCE and state, returns the Cloudflare authorize URL | `:1428` |
| `GET /callback` | Cloudflare returns here; the progress page is streamed as it provisions, ending with the address, the one-time password and the hand-over button | `:1488` |

The installer's sentences are in `newgroup/src/words.mjs`. Its steps are in `newgroup/src/steps/*.mjs` (account, api, bindings, containers, install, members, probes, verify and others).

Registry ids: `install` and `update` (frame setup).

### 1.6 bio-plane/public and release/

- `bio-plane/public/newgroup/index.html` is the static invitation page, "Start your team's own Civicsmith". It is part 1 of the installer (`bio-plane/INSTALLER.md:14-24`). It is generated from words by `newgroup/scripts/invite-page.mjs:1-12`. The bio-plane `wrangler.jsonc` declares no assets binding, so this page is not served by the plane; it is hosted at `believeinoakland.org/newgroup`.
- `release/` holds only the signed bundles and their manifest: `RELEASE.json` (version 0.87.0, sha256, SSH signature, fleet), `notes/0.8x.0.json`, and `*.bundled.mjs` for the plane and five fleet members. It has **no screens of its own**. The interface ships inside `bio-plane.bundled.mjs`.

### 1.7 process/modules and the UI modules

- `process/modules/` holds **179 `.json` manifests and `order.txt`, not `.md` files**. Each manifest has `{name, files, tests, public, uses}`; for example `process/modules/screens-entry.json` uses interface-shell, setup-words, op-declarations, instance-setup, store-request and file-safety. **The requirement texts are `build/requirements/<module>.md`** (179 files, plus `README.md`).
- **UI modules**, which draw what a member sees:
  - the nine screen modules: `screens-entry`, `screens-settings`, `screens-intake`, `screens-daily`, `screens-inquiry`, `screens-wizards`, `screens-investigate`, `screens-publish`, `screens-action`
  - the frame and look: `interface-shell`, `interface-assets`
  - words and wizards: `setup-words`, `translations`, `wizard-scripts`
  - pre-team pages: `site`, `installer`, `installer-steps`
  - the rest: `affordances` (act help), `doorbell` (whose page is in screens-publish), `signin-door` (Claude sign-in relay), `instance-setup` (what setup claims), and `journey-check` (the walker; a helper, not product).

Mentions in each module's `build/requirements/<module>.md`, counted case-insensitively for "screen" and "journey", and exactly for "Screens" and "registry":

| module | lines | "screen" | "journey" | "Screens" | "registry" |
|---|---|---|---|---|---|
| screens-action | 182 | 193 | 3 | 0 | 18 |
| screens-daily | 266 | 174 | 3 | 0 | 9 |
| screens-entry | 115 | 92 | 0 | 1 | 4 |
| screens-inquiry | 337 | 243 | 5 | 0 | 18 |
| screens-intake | 169 | 130 | 0 | 0 | 6 |
| screens-investigate | 172 | 162 | 0 | 0 | 18 |
| screens-publish | 186 | 160 | 1 | 0 | 9 |
| screens-settings | 207 | 250 | 0 | 0 | 19 |
| screens-wizards | 104 | 83 | 2 | 0 | 2 |
| interface-shell | 320 | 395 | 4 | 2 | 52 |
| interface-assets | 76 | 11 | 0 | 0 | 0 |
| journey-check | 111 | 71 | 30 | 0 | 9 |
| wizard-scripts | 212 | 121 | 1 | 6 | 63 |
| setup-words | 76 | 7 | 0 | 0 | 0 |
| site | 64 | 15 | 5 | 0 | 0 |
| installer | 199 | 44 | 0 | 0 | 5 |
| installer-steps | 146 | 0 | 0 | 0 | 5 |
| instance-setup | 287 | 28 | 1 | 0 | 1 |
| signin-door | 41 | 0 | 0 | 0 | 0 |
| translations | 97 | 9 | 0 | 0 | 0 |
| affordances | 251 | 20 | 0 | 0 | 6 |
| doorbell | 133 | 4 | 1 | 0 | 0 |

How the screen requirements refer to screens and journeys:
- Each screen module opens with "**`SCREENS`** (the screen contract, `interface-shell` R21; each sentence read by key)". Examples: `build/requirements/screens-action.md:15`, `screens-daily.md:15`, `screens-entry.md:15`.
- They cite the registry and the drawings as their source: "Registry screens `plan`, `start-send`… (`docs/development/ux-substrate/screens/registry.json` at `a0fab7abf0`; DEC-139); their drawings in `mock-screens.js` and `views/…`" (`screens-action.md:174`). Also "Each requirement follows the drawing (`SCR.actionnew`, …) … its sections, its order, its states" (`screens-action.md:96`).
- Journey references are walk findings by tag rather than journeys as specs. Examples: "JOURNEYS #2 B-25" (`screens-daily.md:121-122`), "JOURNEYS J-8, J-9, V4 B-28" (`screens-daily.md:133`), "journey 22" (`screens-action.md:111`).
- "Words by key" is a requirement in every screen module (`screens-action.md:85` R19; `screens-daily.md:119` R34).
- The common styling line, "every element … uses a class that a served stylesheet defines", is `screens-action.md:49` R14 and `screens-daily.md:73` R21.
- Tests per UI module (`bio-plane/test/m/<module>/`): 389 test files across the 14 UI modules, from 69 (screens-inquiry) to 1 (interface-assets).

---

## 2. The first-use door and the install path

### 2.1 The install path: three parts, three owners (bio-plane/INSTALLER.md)

`bio-plane/INSTALLER.md:10-24`:

1. **Invitation.** `believeinoakland.org/newgroup`, the static page `bio-plane/public/newgroup/index.html`: "Explain what a group copy is … One deliberate button to part 2."
2. **Wizard.** `newgroup.believeinoakland.workers.dev`, the `newgroup/` Worker: Cloudflare OAuth consent, then server-side provisioning into the team's own account.
3. **Setup.** "the new group's own instance": claim the copy and choose a real password.

The flow, from `INSTALLER.md:35-61`:
- POST `/begin` with the name.
- Cloudflare consent for the scopes. `newgroup/DEPLOY.md:44-50` lists five: `workers-scripts.write`, `workers-r2.write`, `account-settings.read`, `containers.write`, `connectivity-directory.bind`. INSTALLER.md still says "exactly three" (line 41), so it is out of date.
- `/callback` provisions: the account, a refusal if the name exists, optional R2, the release upload, the three generated credentials, workers.dev, a live selftest.
- The success screen shows the address, the one-time password, and the member and probe credentials, once. "The handover button opens the new instance with the one-time password in the URL fragment."

INSTALLER.md:22-24 says Part 3 "is embedded in the bio-plane module itself (`src/setup.mjs`) and served at the instance's root". **This is out of date**: `bio-plane/src/setup.mjs:4-5` says "`/` answers the interface … this module composes and serves no page". Setup is now the `setup` screen at `/app/setup` (`newgroup/DEPLOY.md:39-41`: "it opens the address at `/app/setup` with the one-time password filled in").

Other install documents:
- `bio-plane/SETUP.md` (254 lines) is the older manual path for an operator: `wrangler deploy`, then three tokens set with `wrangler secret put` (`SETUP.md:145-181`), then `?op=selftest` and `?op=livefire` with the probe token (`SETUP.md:183-219`).
- `bio-plane/DEPLOY.md` (93 lines) covers deploying to the dev account.

### 2.2 The first administrator (the founder's claim)

`screens-entry/setup.mjs:1-20`: "Set up your team's Civicsmith", in the setup frame at `/app/setup`. The shell hands `#boot=` in as `view.fragment.boot`.

- **Part 1, "Make it yours"**, is the only part open before the claim. It has the one-time password, the handle the founder chooses, and her password typed twice (12 or more characters). Then:
  - `claim` with the handle;
  - `login` by that handle on her own device ("never `admin`");
  - `recoverycodesissue`, which shows the ten codes once.
- **Parts 2 to 8** follow, each with "Skip for now":
  - 2: the team's name and website
  - 3: its place
  - 4: its offices
  - 5: the assistant
  - 6: privacy and the law
  - 7: security tools
  - 8: a second administrator and the hosting account
- **Other states:** "Finished" links `/app`. R18: a founder with no handle is asked for one. R19: anyone else sees only that the team is set up. R20: "Already claimed".
- **The act** is `{ op: "claim", … }` (`setup.mjs:422`), drawn at `:166-168`.

The one-time password is the instance's `ADMIN_TOKEN`. In `build/requirements/credentials.md:16-17`, `claim({password, tokenFp, …})` "sets the founder's password once", and the claim is "re-armed by a new `ADMIN_TOKEN`" (`build/requirements/instance-setup.md:250`). For a dev copy, `bio-plane/.dev.vars.example` names `ADMIN_TOKEN`, `MEMBER_TOKEN` and `PROBE_TOKEN`; values are not shown here.

### 2.3 Sign-in, joining, recovery

- **Sign-in** is on `front`: "`login` with the handle, the password and the device in the body only" (`screens-entry/front.mjs:1-8`). The device is own or shared. The session record `{t, e, d, w}` is kept in `localStorage` under `bio-session` (`interface-shell/index.mjs:16-19`). A lock after idle and `unlock` are tested by the walk ("lock: idle half an hour on her own device", `journey-check/journeys.mjs:367-371`).
- **Invitation.** `join` at `/app/join`: `invitelook`, or a join link asking a name; then the language, a handle checked as typed (fixed for good), and the password twice; then `enroll`, `login`, `memberlanguageset` and `recoverycodesissue`; then Home with the welcome wizard (`screens-entry/join.mjs:1-8`). Administrators make invitation links on `members` (`journeys.mjs:285-304`).
- **Recovery.** `forgot` offers a recovery code (`recover`), an administrator's reset link, or the hosting account's way in (`screens-entry/forgot.mjs:1-7`). `reset` at `/app/reset#reset=<link>` (`screens-entry/reset.mjs:1-7`).
- **Passkeys and email: none.** A search of `bio-plane/src` for "webauthn" or "passkey" found no file. Neither sign-in nor recovery sends email.
- **Claude sign-in** for the assistant is separate. `connect` relays a member's own Claude subscription sign-in through `signin-door` to their runner (`bio-plane/src/signin-door/index.mjs:1-14`).
- **Tour.** `tour` has six steps at their own addresses and asks for no account (`screens-entry/tour.mjs:1-4`).

### 2.4 Wizards as built-in journeys

`wizard-scripts/civicsmith-library.mjs` holds 23 built-in wizards, which the guide walks on the real screens. Each is listed with its number of steps:
- Set up and claim: 16
- Welcome a new member: 7
- Publication ceremony: 11
- Get a record: 9
- Check a claim: 9
- Your first question: 6
- Say who your team is: 4
- Invite a member: 4
- Update your team's Civicsmith: 3
- Connect your Claude account: 8
- Your ties: 3
- Follow a proceeding: 5
- Follow the money: 5
- Build a timeline: 5
- Keep asking this: 4
- Use another team's case: 4
- Translate the interface: 5
- Comment for the team: 6
- Demand a correction: 8
- Take an escalation to its next stage: 5
- Refer it to an oversight body: 7
- Pick up a plan: 4
- Start and send: 7

The runner "opens the step's screen, rings the control the step names and never presses it" (`screens-wizards/guide.mjs:1-7`).

---

## 3. The walker: bio-plane/src/journey-check

### 3.1 Shape

Files (`bio-plane/src/journey-check/`):

| file | role |
|---|---|
| `journey.mjs` | the entry point |
| `run.mjs` | the two arms |
| `walker.mjs` | `Walk` and `step` |
| `journeys.mjs` | the steps of journeys 28 and 3, and the sweep |
| `investigation.mjs` | R9, R10 and R16: from a claimed team to a conclusion |
| `published.mjs` | the published frame |
| `states.mjs` | carried states |
| `design.mjs` | pairs each step with the design mock `docs/development/ux-substrate/layouts.html` at 1280 and 390 px |
| `screens.mjs` | reads `registry.json` |
| `checks.mjs` | DEC-340 limits |
| `words.mjs`, `group-words.mjs`, `pseudo.mjs` | word checks and the pseudo-locale |
| `local.mjs`, `account.mjs`, `city.mjs` | the Miniflare world, the fake Cloudflare account, the fake city website |
| `runner.mjs`, `fake-model.mjs` | the stand-in agent-runner and model |
| `guard.mjs` | the test-instance guard |

It has its own `package.json` with `playwright-core` 1.56.1. Its `node_modules` is not installed in this checkout. The requirement text is `build/requirements/journey-check.md` (111 lines). Its purpose (line 9): "The release check: a Playwright walk of journeys 28 and 3 with screenshots, failing on any refusal, old page or missing screen."

### 3.2 How a step is written

`walker.mjs:231-248`:

```js
async step(page, label, fn, { expect = [] } = {}) {
  ... try { await fn(page); } catch (e) { error = e; }
  await settle(page); ... await page.screenshot({ path: join(this.out, file), fullPage: true, ... });
  this.steps.push({ journey: this.journey, label, screenshot: file, ok: !error && failed.length === 0 });
```

A step is a human-readable label plus a Playwright function that drives the page "as a person does". It uses the screens' `[data-act]` controls, the shell's confirm and reason dialogs, and `[data-guide]`; "no op is called by the walker" (`journeys.mjs:1-5`). Helpers include `act(page, op, {fields})` (`journeys.mjs:70`), `open(walk,page,base,path,id)` (`:94`) and `requireDrawn(walk,page,id)` (`:99`).

Every step is screenshotted. `walk.journey` sets the group a step is reported under. The report prints `ok`/`FAIL journey · label (screenshot)` for each step (`walker.mjs:250-256`). The walk fails on any unexpected `ok:false`, any 4xx or 5xx, any page script that throws, or any registry screen not drawn (`build/requirements/journey-check.md:14`).

### 3.3 The journeys and steps it encodes

There are **66 literal `walk.step(` calls**: 35 in `journeys.mjs`, 24 in `investigation.mjs`, 4 in `published.mjs` and 3 in `run.mjs`. Generated steps are added to these: one per registry screen in each sweep, one per public page, and one per screen in the pseudo-locale pass.

The journey groups, as `walk.journey` names them:

| group | what it walks (labels abridged) | cite |
|---|---|---|
| journey 28 (site + install) | "civicsmith.org: what Civicsmith is"; "start a team, and create it"; "install: the installer's first page"; "the short name, confirmed permanent"; "before Cloudflare, what it will be asked to allow"; "Cloudflare's permission, allowed"; "each step finishes, the checks pass" | `journeys.mjs:119-197` |
| journey 28 (founder) | "hand-over: to the team's address, finishing setup"; "1 · setup: claim with her own handle; she is the team's first administrator"; "setup: her ten recovery codes, shown once"; "setup: the team's name"; "home: a new team's home…"; "security: a first look at Security" | `journeys.mjs:199-265` |
| journey 28 (member Mai) | "members: an invitation link"; "join: the invitation link opens the join screen"; "join: a handle… joined and signed in"; "join: her ten recovery codes"; "home: the guided welcome…"; "account: her first settings, her expertise declared"; "home: what happened? a problem I live with"; "capture: her first testimony, labelled as hers"; "shell menu: sign out on this device"; "front: on her phone, sign in, kept signed in"; "lock: idle half an hour"; "unlock: her password again" | `journeys.mjs:285-382` |
| journey 3 (Welcome a new member) | "welcome 1–2: join…"; "welcome 3: this is your team's home"; "welcome n: …"; "welcome: finished" | `journeys.mjs:384-428` |
| R9 as administrator (journey 29) | "2 · start a project…"; "3 · open a question in it"; "4 · connect an assistant by her own Claude subscription"; "5 · capture by address…"; "5 · capture by upload…"; "6 · see both held, and vouch for one"; "7 · open the document… Find-in a passage"; "8 · cite it with a role (supports)"; "9 · run the assistant on the question from the dock"; "10 · read its run's answer…"; "11 · Ask, and read the answer"; "12 · accept a reading… and conclude" | `investigation.mjs:70-305`, `:359` |
| R10 as member | "the administrator invites her to the project"; "she joins the project…"; "…a question of her own"; "the project's assistant page, as hers (projectai)"; "plan help, as hers (planask)"; or, without the assistant, "assistant not ready: her connect screen" | `investigation.mjs:394-457`; `run.mjs:139-151` |
| R16 without the assistant | the search path to a conclusion on her own reading | `investigation.mjs:459-520` |
| sweeps (`screens`, `as administrator`, `as member`) | `screen <id>` for each registry screen, at 1280 and 390 px, beside the design mock | `journeys.mjs:430-470`; `run.mjs:312-350` |
| R22 the dashboards; R25 the old pages | dashboards opened from Home's doors; "/sign answers the nothing-is-here page" | `journeys.mjs:472-520` |
| R27 pseudo-locale | `pseudo screen <id>` | `run.mjs:167-190` |
| R13/R18 design journey 29 | each step of the design's journey 29 beside its drawing; assistant-only steps reported "not walked" | `run.mjs:192-198`, `:363-366`; `design.mjs:197-226` |
| R28 public pages | `public page <id>` for the nine `PUBLIC_PAGES` | `run.mjs:267-290` |
| roles | the administrator must be shown acts the member is not | `run.mjs:367-376` |

**The scenario** is the fake city of Lakeshore. The team is "Lakeshore Tenants" (`lakeshore-tenants`) and the founder is `rosa-l` (`journeys.mjs:14-16`). Housing notice 2026-118 orders a roof repair (`city.mjs:5-14`). The question is "Has the landlord been ordered to repair the roof of 14 Lakeshore Row?" (`investigation.mjs:19`).

**The design's journeys** are numbered 1 to 32 in `docs/development/ux-substrate/screens/mock-journeys.js` ("The twenty-seven journeys of step 3 … journey 28 … and journey 29", line 1). Every registry screen also lists the journeys it serves (`registry.src.py:6-8`, the `journeys` field). The walker encodes only **28, 3 and 29** (as R9, R10 and R16) step by step. Every other journey is covered only by the screen sweeps.

### 3.4 The two arms, and the process.json command

- **Local arm** (`runLocal`, `run.mjs:95-210`). It needs no account: a Miniflare world (`local.mjs:107`), a fake Cloudflare account (`account.mjs:78`) and a fake city. It runs the site, the installer, the hand-over and the claim, so **it alone walks the first-use door**.
- **Live arm** (`runLive`, `run.mjs:293-379`). It needs `--live <address>`, or it is refused `NO_INSTANCE` (`run.mjs:300`). It needs `JOURNEY_ADMIN_HANDLE`, `JOURNEY_ADMIN_PASSWORD`, `JOURNEY_MEMBER_HANDLE` and `JOURNEY_MEMBER_PASSWORD`, or it is refused `NO_CREDENTIALS` (`run.mjs:296-301`). Optionally it takes `JOURNEY_PUBLISHED_CASE` (`published.mjs:17`). It first requires `bootstrap` to answer `test_instance: true` (`guard.mjs:11-20`). That is true only when the env's `CIVICSMITH_TEST_INSTANCE` equals its `INSTANCE_NAME` (`ai-runs/index.mjs:340-345`), and neither is in `bio-plane/wrangler.jsonc` (its `vars` hold only `VERSION`, line 15).
  - The live arm starts from "open / and sign in" as an existing founder and member. It does not claim or install.
  - Its R9 and R10 connect a real Claude subscription by asking a person at a TTY for the code (`askCode`, `run.mjs:212-224`). Without a TTY it gets no code.
- **Consequence for `walk.run_steps`.** `node bio-plane/src/journey-check/journey.mjs --live` as written passes no address: `opt("--live")` returns `undefined` (`journey.mjs:11-14`). Against `wrangler dev` (`npm --prefix bio-plane run dev`) it also needs the address (usually `http://localhost:8787`), the four `JOURNEY_*` credentials of an already-claimed copy, and the test-instance vars. Otherwise it is refused before any step runs.

### 3.5 walk/internal and walk/external

`find . -path '*walk/internal*' -o -path '*walk/external*' -o -type d -name walk` (outside `node_modules`) finds **nothing**. No module has walk folders yet. Before this file was written, `process/` held only `decisions-arch.md`, `decisions-owner.md`, `modules/`, `ranking.md` and `waiting-for-arch.md`.

---

## 4. The assistant

- **The panel** is the registry screen `assistant`, frame `dock` (`interface-shell/index.mjs:120`). Its code is `bio-plane/src/screens-inquiry/assistant.mjs` (`ASSISTANT_SCREEN` at `:376`; header `:1-23`). It is drawn beside the screen it serves, and its context is that screen's subject (a question `INQ-` or a project `PROJ-`).
  - "Work on this" opens a run with `op=airunopen` and dispatches it with `op=airundispatch`, under the member's session. The page holds no AI credential.
  - It re-reads every 10 s while a run it dispatched is running.
  - All AI output is marked machine work (`mark.origin.machine`) and "never evidence". It also carries the `untested` label on a test instance.
  - R42: "where the assistant cannot work … 'Other reasons the assistant can't work here' lists, by key, the reasons".
- **When the dock appears.** `interface-shell/browser.mjs:2831-2838` sets `REACHABLE = assistantstate.on && (accountreference.held || subscriptionsignin.connected || groupkeystate.on)`. The dock instance is made only when the assistant is reachable and the main screen is in the working frame.
- **Related screens:**
  - `projectai`: "AI for this project" (`screens-inquiry/projectai.mjs:226`)
  - `connect`: a member's own Claude sign-in (`screens-settings/connect.mjs:19`)
  - `teamai`: the team's key (`screens-settings/teamai.mjs:11`)
  - `answers`: Ask (`screens-daily/answers.mjs:11`)
  - `plan`: "Ask the assistant for options" (`planask`, `build/requirements/screens-action.md:46`)
- **The server side** is in the fleet repositories: `agent-worker/`, `agent-runner/`, `agent-model/`, `agent-harness/` and `agent-steps/`. On the plane side: `ai-runs`, `ai-accounts`, `ai-use` and `signin-door`.
- **Without an AI account**, the product has no stand-in: the dock is not drawn, and screens show the reasons by key. The setup wizard's part 5 ("the assistant") can be skipped (`screens-entry/setup.mjs:9-12`).
- **The only stand-in model** is the walker's. `journey-check/runner.mjs` is "the local arm's stand-in for `agent-runner`, run under Miniflare … bound as agent-worker's `RUNNER`" (`runner.mjs:1-13`). It answers the Claude sign-in and the conversation socket with `journey-check/fake-model.mjs`, a pure generator that reads first and answers by the tool the contract names (`fake-model.mjs:1-13`). It knows the scenario: notice 2026-118 and its passage (`fake-model.mjs:15-19`).
  - It is switched by the Miniflare binding `FAKE_MODEL: "on" | "off"` (`local.mjs:89`). Set to `off`, every conversation ends `NO_FAKE_MODEL` (`runner.mjs:100`).
  - `--assistant` sets whether the walk expects the assistant to work. By default the assistant steps are reported as not walked, not failed (`journey.mjs:1-3`).
  - **This stand-in exists only in the local arm.** A `wrangler dev` copy has no `RUNNER` bound to it.

---

## 5. Words and strings

- **One keyed table.** `bio-plane/src/setup-words/rows.mjs` is generated and frozen. Its rows are `[key, en, note, means, protected, origin]`: "19467 design words, 1162 protected" from `docs/development/ux-substrate/screens/words.json` (4.7 MB), plus "7515 sentences written first in code". `WORDS_COMMIT = "2f703a6723"` (`rows.mjs:1-10`).
- **The services** (`setup-words/index.mjs`):
  - `hasWord(key)` (`:14`)
  - `word(key, vars)`, which throws `UNKNOWN_WORD` or `WORD_VAR_MISSING` (`:32-36`)
  - `localize(id, en, vars)`, where the list wins over the inline English (`:41-46`)
  - placeholders `{name}` (`:16`)
- **The generator** is `setup-words/build.mjs`, reading `words.json` and every `localize(...)` call (`build.mjs:1-9`, `:21`). `--check` finds stale rows and `--pseudo` writes pseudo-locale rows. It also writes `words-unreviewed.json`, the code-first sentences awaiting design review (2.2 MB).
- **The page carries keys only.** `interface-shell/index.mjs:4` (R5, R70: "keys only; the sentences are `setup-words`'"). `:250-258` builds every word the page may draw from `WORD_ROWS` plus each screen's own rows. The member's language comes from the `interfacewords` read (`SHELL_OPS`, `index.mjs:178`; served by `translations`, `op-declarations/index.mjs:451`).
- **Screen modules hold no English.** Each module's requirement says so ("Words by key", for example `build/requirements/screens-daily.md:119`). Screen modules keep only keyed fix lists, for example `screens-action/words*.mjs` and `screens-entry/words.mjs`.
- **Key families:**
  - screens: `screen.<id>.name`, `screen.<id>.<part>`
  - the shell: `shell.*`, `rail.*`, `act.<op>.label`/`.does`, `weight.*`, `mark.*`
  - the dock: `dock.withheld.<CODE>`
  - the installer and walker: `installer.*`, `journey-check.*`
- **The installer and site** use the same rows. `newgroup/src/words.mjs` serves the installer, and `site/build.mjs` builds `pages.mjs` from words.
- **The walker checks words.** The pseudo-locale pass flags any sentence that escaped the list (`run.mjs:167-190`). `group-words.mjs:13-14` reads the design's `words.json` and `build_words.mjs` rule.

---

## 6. Registry screens: present in code or not

The source is `docs/development/ux-substrate/screens/registry.src.py`. Its function `screen(id, name, frame, purpose, acts, journeys)` (`:6-8`) is called 91 times and generates `registry.json` (91 screens, `checkedAgainst: origin/main`). The code copy `wizard-scripts/screen-registry.mjs` holds the same 91 ids.

Present or absent, grouped by where the code is. Journeys are the registry's `journeys` field.

| registry ids | in code? | where |
|---|---|---|
| front, tour, reset, forgot, setup, join | present | screens-entry |
| settings, members, teamai, account, connect, notes, group, group-identity, places, recovery, security, translations, updates, glossary, grouprules, bias | present | screens-settings |
| capture, held, archive, open-file, inbox, about-knocker, leads, watching | present | screens-intake |
| home, elsewhere, projects, queue, finder, find-in, answers | present | screens-daily |
| project, dash-project, question, document, assistant (dock), projectai, objective, contradiction | present | screens-inquiry |
| wizards | present | screens-wizards |
| people, person, explore, timeline, money, calculation, help, proceeding, due-date, standard, ties, theme | present | screens-investigate |
| case-editor, review-copy, ceremony, published, imported, docket, docket-public, doorbell, review-outside | present | screens-publish |
| plan, start-send, request, action, matter, help-records, actionnew, hold, holdnotice, counsel, dash-action | present | screens-action |
| site (journeys 1, 28) | present, outside bio-plane | `site/` Worker |
| install (1, 28) | present, outside bio-plane | `newgroup/` `/`, `/callback` |
| update (1) | present, outside bio-plane | `newgroup/` `/update` |
| more (2) | shell only | `interface-shell/browser.mjs:1141,1166` |
| unavailable (3) | shell only | `interface-shell/browser.mjs:1117-1120` |
| **registers** (10, 12, 14) | **absent** | none |
| **aiproviders**, **aiconnect**, **aimine**, **aitest**, **airesults** (32) | **absent** | none |
| **aiproject** (32) | **absent** | none (the code's `projectai` is a different id) |
| **aimoments** (dock, 32) | **absent** | none |

**Totals:**
- 78 screens are built as bio-plane screen modules, and every one is in the registry: no screen is built that the registry lacks.
- 3 are built as separate Workers (`site`, `install`, `update`).
- 2 are drawn by the shell (`more`, `unavailable`).
- **8 are absent** (`registers` and the seven `ai*` screens of journey 32).

Notes:
- Searching `bio-plane/src` for `aiproviders`, `aiconnect`, `airesults` and `aimoments` finds them only in generated data (`setup-words` rows, `screen-registry.mjs` and an embedded copy in `case-checker/program.mjs`), never in a screen.
- The registry's frame for `imported` is `imported`, which the shell's `FRAMES` table does not name (`interface-shell/index.mjs:115-121`). So `imported` is drawn in the working frame.
- 12 registry screens list no journey: `teamai`, `wizards`, `objective`, `projectai`, `glossary`, `actionnew`, `hold`, `holdnotice`, `counsel`, `grouprules`, `leads` and `watching`.
- The walker's sweep takes every registry screen except `site`, `install` and `update` (`journey-check/screens.mjs:11-22`). That includes the 8 absent screens and `more`. **By `build/requirements/journey-check.md:14` ("any registry screen not drawn" fails), a sweep today should fail on the 8 absent ids.**

---

## 7. Other code facts that shape the experience

- **Phone width.** 760 px or less is a phone (`interface-shell/index.mjs:27`). The walker checks 1280 and 390 px (`journey-check/design.mjs:18-19`).
- **Act weights and marks.** Acts are drawn with a weight (Reversible, Asks for a reason, Ends something, You sign this) from `op-grades`. The shell asks for a reason before Reasoned acts, and before a few marked acts (`MARK_ASKS_EXTRA`, `interface-shell/index.mjs:170-175`). The words are `weight.*` (`setup-words/rows.mjs` first rows).
- **Test instance band.** The shell reads `bootstrap` once and draws a test-instance band when `test_instance` is true (`browser.mjs:1336-1343`). AI output on a test instance is labelled `untested` (`screens-inquiry/assistant.mjs:21-22`).
- **The design mock is in the repository.** `docs/development/ux-substrate/` holds `mock-screens.js`, `mock-shell.js`, `mock-journeys.js`, `layouts.html`, `views/*.html` and `words.json`. The walker pairs live screenshots with drawings from `layouts.html` (`journey-check/design.mjs:15`, `:108`).

---

## 8. Doubts and things not verified

- The walker was not run, and the screens were not drawn in a browser. "Served" means routed and composed by the code read above.
- The `unavailable` and `more` pages were read from the shell's code paths only.
- How a `wrangler dev` copy is claimed for a walk was not verified (one-time password = `ADMIN_TOKEN` from `.dev.vars`; credentials R1), nor whether the dev copy can be made a test instance without editing `wrangler.jsonc` or `.dev.vars`.

---

## 9. What this means for the Screens document and the walk

- **Address scheme.** The Screens document can name every member screen by its registry id. Its address follows from the id: `/app/<id>[/<subject>]`, with these exceptions: Home is `/app`, `front` is `/`, `review-outside` is `/app/review`, and `tour` and `doorbell` also have `/tour` and `/doorbell`.
- **First-use door.** It runs: the invitation page, the installer (`newgroup` `/`, then Cloudflare, then `/callback`), the hand-over to `/app/setup#boot=`, `setup` (claim, codes, seven skippable parts), Home, and `members` (an invitation), then `join` and Home with the welcome wizard. Passwords, handles and recovery codes throughout: no passkeys, no email.
- **The walker today has three step-by-step journeys** (28, 3 and 29 as R9, R10 and R16) and screen sweeps. Steps are Playwright functions with labels, not data. Any journey the UX lane adds needs either code in `journey-check` or a new step format; no `walk/internal` or `walk/external` folders exist yet to hold one.
- **process.json's `run_steps` needs an address after `--live`.** It also needs a claimed founder and member in `JOURNEY_*` env and a test-instance env (`CIVICSMITH_TEST_INSTANCE` = `INSTANCE_NAME`) on the dev copy, or the live arm refuses before its first step. The first-use door is walkable only by the local arm (Miniflare).
- **Without an AI account, the assistant steps can only be "not walked".** The Screens document should state what each screen shows when the assistant is unreachable, because that is the state a walk without AI will see.
- **Eight registry screens have no code** (`registers` and journey 32's seven AI screens). The Screens document should mark them unbuilt, or the sweep will fail on them.
