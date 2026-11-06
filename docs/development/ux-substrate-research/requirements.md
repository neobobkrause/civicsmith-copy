# W3: the requirements of the modules the ux lane serves

Read-only research for the ux design lane (qualifying). Checkout: `705f8823d1` (detached; 6 Nov 2026 09:34 -0800). Paths below are relative to the repository root. "not met" means the requirement line carries `*(not yet met: …)*` (build/requirements/README.md:9, convention 5). U = `bio-plane/src/setup-words/words-unreviewed.json`, W = `docs/development/ux-substrate/screens/words.json`. Neither file is committed (build_words.mjs:10, max_file_bytes), so this report checks a key's presence in W through its source files: `build_words.mjs` `add(...)` and `words-drawn-*.src.py` `wux(...)`/`W.append`.

## Summary table

| module (ledger id) | ledger state | what it needs from UX | cite |
|---|---|---|---|
| ux-design | COMPLETE (2026-11-06T05:29:36Z) | the lane's own: the inventory (R1), module entries (R2), settled wording (R3) | process/ledger/ux-design.json; build/requirements/ux-design.md:7-9 |
| setup-words | **no ledger entry** (requirements only) | words.json is its source; R10 generates `WORD_ROWS` from the tree; R13 says drawn-screen modules read only through `word` (rows the design stream wrote first); R16 makes U the design stream's review list | build/requirements/setup-words.md:37,40,46 |
| ai-use | COMPLETE | R13 (not met: T53): every refusal sentence read by key from words.json, including the 6 new keys and the generalised `ai.refused.unitunavailable` | ai-use.md:59 |
| screens-document-beta | COMPLETE | 16 not-met marks (R58–R75). Of these, R59's and R73's words are settled in words-drawn-4; R62's quote differs from W | screens-document-beta.md:9,15,37 |
| screens-document | COMPLETE | 57 not-met marks (R1–R57, T53). R1 needs `screen.document.cells_held` (now settled) | screens-document.md:15 |
| screens-settings | COMPLETE | R86: placement of the level line on the gauge. R88: placement wording. R96 and R104: "Words are UX-DESIGN's" (32 not met in all) | screens-settings.md:175,177,185,193 |
| screens-ai | **OPEN** | all 16 R not met (T53). R12: its keys are the `reads` list for it in the design's `words-reads.json`. Status: "waits on UX-DESIGN's rows, B555" (drawn since) | screens-ai.md:3,19-33,48 |
| screens-wizards | COMPLETE | R23 "Words owed" (keys now settled); the guide's sentences stay in SCREEN_WORDS until the design stream adopts them; the Alt+Shift+W setting is not drawn | screens-wizards.md:78,104,105 |
| wizard-scripts | COMPLETE | the screen registry and the Civicsmith library are re-taken from `registry.json` and `library.json` at a named design commit (R13, R22, R29, R41, R42, R45, R47) | wizard-scripts.md:54-57,62,87,150-157 |
| interface-shell | COMPLETE | R5: every string by key. R8: paths from the design. R43: the mark. R56: classes only from civicsmith.css/shell.css, with an ASK to UX for any missing style. Band wording is interim, for UX | interface-shell.md:13,24,29,93,111,121 |
| interface-shell-t50-t51 | **OPEN** | R73: the registry is the design's. R76, R82, R84, R95, R102: the design's keys (page.title, shell.level.*, mk-chip) | interface-shell-t50-t51.md:9-20,40,65 |
| interface-shell-t53 | **OPEN** | 16 not met. R141: `screen.machine.*.ai`. R143: `screen.ai.notready`. R147: a 422 px threshold, "provisional, for UX-DESIGN to confirm" | interface-shell-t53.md:14,16,20 |
| interface-assets | COMPLETE | ASSET_FILES are civicsmith.css, shell.css (from page.src.html), faces and icons.svg at `ASSETS_COMMIT`. Its R10 also lists icons the design references but does not hold | interface-assets.md:16,23,44-51; prior_work in process/ledger/interface-assets.json |
| site | COMPLETE | R8/R9: the look from interface-assets. R12: words by key. R16: `SITE_COMMIT` equals ASSETS_COMMIT, with the design's "team" words | site.md:24,27,33,40 |
| journey-check | COMPLETE (ledger) but 30 R not met | R13/R18: compare against design journey 29. R17/R26: no "group" for a team in words.json or setup-words (GROUP_SENSE from build_words.mjs). R21: the design's registry states. R27/R29: the pseudo-locale walk | journey-check.md:61,71,72,81,83,85-87 |
| installer | **OPEN** | R40: every string by key. R41/R42: fixed wording. R93: keys "the design adds for section 3's needs". R95/R96/R97: "Words, ranges and the sentences are UX-DESIGN's, through BOB" | installer.md:59-64,154,156,157,158 |
| installer-places | **OPEN** | copies of R94–R98 (R95, R96 and R97 owe UX words) | installer-places.md:17-21 |
| installer-check | **OPEN** | copy of R93 (keys the design adds) | installer-check.md:21 |
| installer-copies | **OPEN** | R63/R65: draw `screen.install.exists.*`, `screen.install.remove.*` | installer-copies.md:19,21 |
| installer-steps | **OPEN** | R36: its sentences by key. R49: "What you need" is whole sentences, the same as the site's | installer-steps.md:116,134 |
| affordances | COMPLETE | ACT_HELP regenerated from `mock-acts.js` (R48–R57). R71: act help for DEC-438–441. R72–R75 not met | affordances.md:73-78,172-175 |
| notice-producers | COMPLETE | R16: `ai.queue.limitreached.provider*`, plus a date format "until the design stream names its format (B133)". R33: `ai.alert.*`. R35: `ai.queue.left*` | notice-producers.md:37,73,75 |
| network-notices | COMPLETE | R32: `listing.contact.note` | network-notices.md:151 |
| queue-producers | COMPLETE | R57: `queue.signer-self-registered.*` | queue-producers.md:155 |
| machinery-producers | COMPLETE | F1: `queue.capture-completed-unattended.*` | machinery-producers.md:137 |
| agent-runner / agent-worker | COMPLETE | R41 sign-in rows (NO_BINARY's English held back); R110/R124 `ai.refused.*`, `ai.choice.*` | agent-runner.md:67; agent-worker.md:195,246 |
| screens-action | COMPLETE | R62, R74, R80: "Words owed" (keys settled) | screens-action.md:142,154,160 |
| screens-daily | COMPLETE | R108, R116 (keys settled) | screens-daily.md:231,242 |
| screens-inquiry | COMPLETE | R142, R143, R146, R149, R150 (keys settled) | screens-inquiry.md:288-296 |
| screens-intake / screens-intake-rounds | COMPLETE | R72–R74, R78, R92 (keys settled). R77: "the design names it" | screens-intake.md:126-149; screens-intake-rounds.md:20,36 |
| screens-investigate | COMPLETE | R92 (keys settled) | screens-investigate.md:166 |
| screens-plan | **OPEN** | R9 (keys settled) | screens-plan.md:27 |
| screens-public / screens-publish | COMPLETE | R102, R105, R106 (keys settled). Some SCREEN_WORDS stay "until the design stream keys them" | screens-public.md:9,44; screens-publish.md:53,87,167-171 |
| screens-entry | COMPLETE | R35/R36 (front door layout, no words). `act.aiaccountadd.does` and `act.aiaccountswitch.does` are in neither U nor W | screens-entry.md:87,88; notes ux-design.md:95 |
| file-safety | COMPLETE | R11: drawing the sheet preview's "show more" is "a HANDOFF to UX-DESIGN" (not met: R60, R66, R70) | file-safety.md:43 |
| workbooks | COMPLETE | R2: "Rows owed to UX-DESIGN": `refusal.WORKBOOK_TOO_LARGE` (in words-drawn-4) and `refusal.WORKBOOK_FILE_TOO_LARGE` (**in no design source**) | workbooks.md:19 |
| extraction | COMPLETE | R101: DEC-417's retired sentence is a HANDOFF to UX-DESIGN. R75: a key to conform (K2919) | extraction.md:3,86,149 |
| translations | **no ledger entry** | serves the interface's words to translators (`interfaceWords`, R19: only what the screens show) | translations.md:11,35,53 |
| case-disclosures, case-import, op-grades, plane, jurisdictions | COMPLETE | single keys, all settled per the inventory | notes ux-design.md:33,34,39,45,49 |

Status counts: of the 155 ledger entries, 134 are COMPLETE and 21 are OPEN. These OPEN modules touch UX: installer, installer-steps, installer-places, installer-copies, installer-check, interface-shell-t50-t51, interface-shell-t53, screens-ai, screens-plan, screens-matter and surface-declarations. 221 requirements files exist against 155 ledger entries. Files with no ledger entry that bind UX: `setup-words`, `translations`.

## 1. ux-design itself

**Ledger** (`process/ledger/ux-design.json`): layer 11; paths `docs/development/ux-substrate/`, its requirements and its notes; tests `bio-plane/test/m/ux-design/` (present: `inventory.test.mjs`, `module-entries.test.mjs`); `uses: ["setup-words"]`; state COMPLETE, 2026-11-06T05:29:36Z. The prior_work line restates CLAUDE.md's design-lanes rule. It says to regenerate with `node bio-plane/src/setup-words/build.mjs` and `node docs/development/ux-substrate/screens/words-reads.src.mjs . --build`, to edit no other module's code, and to commit no oversized generated file.

**build/requirements/ux-design.md** (9 lines; no requirement carries a not-met mark):

| id | text (short) | status | file:line |
|---|---|---|---|
| (status) | New 5 Nov 2026 (coordinator 15:31, Bob 15:36). Purpose: "no job waits on wording or UX design". Lists the inventory file | in force | ux-design.md:3 |
| R1 | One inventory of every words item a job has raised: module, mark, keys, whether each key is in U and in W, with its source. Tested by `inventory.test.mjs` (a moved key fails it) | met (no mark) | ux-design.md:7 |
| R2 | Where a blocked requirement's words are already in W, the lane adds the module's entries where the generators need them, changes no wording, and records row by row that the requirement no longer waits. Today: screens-document-beta R60, R61, R62's held.kind, R63, R64–R68, R72 | met (no mark) | ux-design.md:8 |
| R3 | Settle the wording of every drafted key a requirement waits on: ai-use R13's seven first, then screens-document-beta's, then the rest by need; keep the inventory current | met (no mark) | ux-design.md:9 |

**docs/requirements-notes/ux-design.md** (110 lines):
- :3. Taken 5 Nov at the tranche tip after PR 506, from `process/metrics/*.jsonl`, the unmet marks, U and W. At that time U held 8,449 entries from 160 modules and W held 19,835.
- :5. Settled 5 Nov (R3) through lane PRs 535, 536, 537, 540, 525, 527, 530, 532, 534 and 539, carried into `build_words.mjs` and `words-drawn-4.src.py`. Left open:
  - installer R95 names no key.
  - journey-check R17/R26 ("group" rows) were settled on branch `lane/ux-team-words` and left for their owner.
  - agent-runner R41's NO_BINARY rewording waits on agent-runner regenerating `says-words.mjs`.
- :7-11. "As taken" observations: screens-document-beta R62's quote differs from W; ai-use R13's keys; settling a U key needs Bob's approval; some items name no key.
- :13-69. The blocking table: 51 rows, 26 modules. Every row with named keys is now marked "yes" in W except installer R95 (:66) and journey-check R17/R26 (:42, n/a).
- :69. The counts line ("39 named keys missing from W") is the pre-settlement figure and is not labelled as such. It is now stale.
- :71-88. Module entries (R2), in `words-reads-requirements.mjs`, tested by `module-entries.test.mjs`. "Still waiting": R59 and R73. Both are now settled per :24 and :31, so :88 is stale too.
- :90-110. Words items that block no requirement. The examples include affordances `act.guideoptout.does` (settled 6 Nov), screens-entry's two `act.ai*.does` (in neither U nor W), reading-guides, lines, run-rules, ai-gate's 74 `gate.*` and ai-accounts' 35 `ai.refused.*` (all U only), plus about 50 others with no job note (:110).

## 2. Modules that bind UX outputs: detail

### Words (words.json, words-drawn, words-reads, setup-words)
- **setup-words** (no ledger entry):
  - R10 (:37): `WORD_ROWS` is generated from words.json in the tree.
  - R11/R12 (:38-39): `word` and `hasWord`; there is no fallback to the key.
  - R13 (:40), the rule the lane serves: "A drawn-screen module (`screens-*`, `interface-shell`, `wizard-scripts`, `site`, the installer's pages) reads through `word` only". Other modules may use `localize(id, en)`.
  - R14–R16 (:44-46): code-origin rows go to U as "the design stream's review list".
  - R17 (:47): pseudo rows. R18 (:48): no ICU plural or select until rendered, so the lane must not write `{n, plural,…}`. R19 (:49): a reason nested inside a reason.
- **ai-use** R13 (:59, not met T53):
  - The keys `ai.refused.limit.provider` (+`.unknown`), `ai.refused.thresholdinvalid`, `ai.alert.threshold`, `ai.use.notmeasurable` and `ai.refused.notapayingaccount` are now `add(...)`ed in `build_words.mjs:223-230`. The generalised `ai.refused.unitunavailable` is at build_words.mjs:170.
  - The module reads them through `localize` with inline English (`bio-plane/src/ai-use/checks.mjs:85`), so W's row wins.
  - The not-met mark is still on the requirement line, so clearing it is owed by an ai-use job, not by UX.
- **notice-producers** R16/R33/R35 (:37, :73, :75; all not met T53): keys settled per the notes (:35-37). R16 also uses a provisional date format, "until the design stream names its format (B133)" (:37). The inventory does not list that format.
- **journey-check** R17 (:71) and R26 (:83, not met T52): no "group" for a team in words.json or setup-words rows. `GROUP_SENSE` is read from `build_words.mjs`, so the lane owns the allow-list. Per notes :5 the fix sits on `lane/ux-team-words`, which is not present in this clone's refs (only `lane/ux`, `origin/lane/ux`).
- **screens-ai** R12 (:30): keys are the `reads` list for screens-ai in `words-reads.json`; each refusal is drawn by its `ai.refused.<code>` word.
- **translations** (no ledger entry) R19 (:53): `interfaceWords` answers only the words whose `fallback` is false. It depends on W's rows.

### Screen registry, wizard library, journeys
- **wizard-scripts**:
  - R41 (:150): `screen-registry.mjs` regenerated from `registry.json` at the design commit and checked. R47 (:157) is the latest pin, 83 screens and 563 acts. The code pins `SCREEN_REGISTRY_SOURCE` commit `30af4350f2`, and its sha256 `5b4240…` equals today's `registry.json`, so there is **no drift**.
  - R22 (:87) and R42 (:151) cover the library. Code pins `CIVICSMITH_LIBRARY_SOURCE` commit `d129238bf3` (6 Oct), sha `02653a7a…`. Today's `library.json` has sha `241837de…`, and `git diff d129238bf3 HEAD` shows +451/-79, including DEC-281's team words. **The library has drifted from its pin**; see Open questions.
- **interface-shell** R8 (:29): each screen's path comes from the design. **interface-shell-t50-t51** R73 (:9): "The registry is the design's, and the interim lists go."
- **screens-wizards**: R13 (:58) words by key; R23 (:78) filter tips, "Words owed", keys settled per notes :41. Its sources include `layouts.html` §3 "Journeys and wizards, walked" (:97).
- **journey-check**: R13/R18 (:61, :72; not met) walk the design's journey 29, which is 18 steps at the START's design commit. R21 (:81) the carried screens and states. R44 (:107) is "owed: no lane wrote this line".

### Visual language, icons, fonts, marks, layouts
- **interface-assets**:
  - R1/R5/R8/R9/R10 (:16-51): `ASSET_FILES` is `civicsmith.css`, the 15 faces and their licences, `icons.svg`, and `shell.css` (from `page.src.html`'s `<style>`, R7 :23) at `ASSETS_COMMIT`.
  - Code pins `1b6f2bc383` (`bio-plane/src/interface-assets/index.mjs:11`, `generate.mjs:12`). `git diff 1b6f2bc383 HEAD` shows no change to civicsmith.css, icons, fonts, marks or screens/page.src.html. The only change is the deletion of `visual-language/page.src.html` and `build_page.py` (the folder cleanup, ef9a2c7fde).
  - R10 (:48): `icons.svg` lacks `i-document`, `i-due` and `i-sever`, which the drawings reference. R10 (:49): no `@media print` rule. :75: `check_contrast.py` is the design stream's, run on any colour change.
  - The ledger's prior_work records the `.cs-btn` 44 px fix (PR 191).
- **site**: R8/R9 (:24-27) use the stylesheet, faces and icons from interface-assets, plus `mk-sitenav`, `mk-setuphead`, `mk-wordmark`, `mk-list`, `mk-acts` and `mk-links`. R16 (:40) sets `SITE_COMMIT` = ASSETS_COMMIT (`site/src/pages.mjs:3` = `1b6f2bc383`).
- **interface-shell**:
  - R43 (:93) is the mark (the plumb bob, 20 px, accent) with the design stream's explanation; the source is `marks/civicsmith-plumb-bob.svg`.
  - R56 (:111) throws for any class not in civicsmith.css or shell.css. Missing styles go "with an ASK to UX-DESIGN" (also screens-action:48, screens-daily:72, screens-document:85, screens-entry:33, screens-inquiry:57, screens-intake:49, screens-investigate:69, screens-public:11, screens-publish:58, screens-settings:65, screens-wizards:45).
  - R121 (:121): the band's `shell.band.working` is "interim, for UX-DESIGN".
- **interface-shell-t53** R147 (:20, not met): 422 px is "a provisional number, for UX-DESIGN to confirm" (also build/plan/T53-R1/interface-shell.md:27).

### Front door, site, installer
- **screens-entry** R35/R36 (:87-88, not met T53): the front door for a signed-in reader, and `forgot`'s column width. These are layout only.
- **installer**:
  - R40 (:60): every member- or founder-facing string by key. R41 (:63): the slug act shows the Irreversible weight. R42 (:64): the one-line "what Civicsmith is" sentence, exact.
  - R93 (:154, not met): the check list's words come from `screen.install.check.*` and `screen.install.refused.rare`, "and from the keys the design adds for section 3's needs". **No `screen.install.check*` or `screen.install.refused.rare` key exists in any design source or in `newgroup/src`** at this commit.
  - R95 (:156, not met): the three levels; "Words, ranges and the sentences are UX-DESIGN's, through BOB".
  - R96 (:157, not met): region "near me" / "keep my data in this region"; the words are UX-DESIGN's. `screen.install.region.*` (16 keys) exists in words-drawn-4.
  - R97 (:158, not met): a new copy from a whole-record export, covering the move path, "what was not carried" and the old copy's end act. The words are UX-DESIGN's. build/plan/T53-R1/installer.md:51 says "screen needs to UX-DESIGN through BOB".
  - **installer-places** R95–R97 (:18-20) and **installer-check** R93 (:21) are verbatim copies.
- **installer-steps** R49 (:116): the installer's "What you need" list is whole sentences, identical to civicsmith.org's (shared wording across site and installer).
- **screens-settings** R88 (:177): Settings states the placement in "`installer` R96's words", and "the screen need goes to UX-DESIGN through BOB".

### AI-use wording elsewhere
- **interface-shell-t53** R141 (:14) and **screens-ai** R11 (:29): `screen.machine.*.ai` names the AI after "the assistant". R143 (:16): `screen.ai.notready`, which is present in words-drawn-4, mock-screens.js and layouts.html.
- **screens-ai** R1–R16: all not met. The rows were drawn (B555; DEC-465–476), but every line was "drafted by BOB's worker … BOB reviews each line" (:3). R5 (:23) waits on a live AI Gateway dashboard for its step-3 labels.

## 3. Owed to or blocked on UX

### A. Not-met requirements whose words the inventory marks settled (only module code remains)
These marks are still "not yet met" in the requirement files. They have been owed to their modules, not to UX, since 5 Nov:
- ai-use R13
- screens-document-beta R59–R68, R72, R73
- screens-document R1
- notice-producers R16, R33, R35
- queue-producers R57
- screens-wizards R23
- screens-action R62, R74, R80
- screens-daily R108, R116
- screens-inquiry R142, R143, R146, R149, R150
- screens-intake R72–R74, R78, R92
- screens-investigate R92
- screens-plan R9
- screens-public R102 and screens-publish R102, R105, R106
- screens-settings R88's keys, R96, R104
- agent-worker R110, R124
- agent-runner R41

### B. Owed to UX and missing from the ux-design inventory (candidates for R1)

| module | mark | what is owed | cite |
|---|---|---|---|
| installer / installer-check | R93 | keys "the design adds for section 3's needs"; `screen.install.check.*` and `screen.install.refused.rare` exist nowhere | installer.md:154; installer-check.md:21 |
| installer / installer-places | R96 | words for the two-way region choice, the lists, the sentence before choosing (region rows exist; the jurisdiction half is unchecked) | installer.md:157; installer-places.md:19 |
| installer / installer-places | R97 | the move path, "what was not carried", the old copy's end act, the sentence before choosing a region | installer.md:158; installer-places.md:20 |
| screens-settings | R86 | placement of the level line and the factors on the gauge ("UX-DESIGN's need through BOB") | screens-settings.md:175 |
| interface-shell-t53 | R147 | confirm the provisional 422 px threshold | interface-shell-t53.md:20 |
| file-safety | R11 | the sheet preview's "show more" drawing (HANDOFF) | file-safety.md:43; build/plan/lane-reading-architecture/GAP.md:230 |
| workbooks | R2 | `refusal.WORKBOOK_FILE_TOO_LARGE` row (absent from design sources); `refusal.WORKBOOK_TOO_LARGE` present in words-drawn-4 | workbooks.md:19 |
| extraction | R101 (and status :3) | the replacement for DEC-417's retired "three interruptions" sentence (HANDOFF) | extraction.md:3,149; GAP.md:507 |
| extraction | R75 | the design stream to conform a key (K2919) | extraction.md:86 |
| notice-producers | R16 | the date format (B133) | notice-producers.md:37 |
| screens-intake / -rounds | R77 | the sentence DEC-460 calls self-contradicting is replaced ("the design names it"): unverified whether named | screens-intake.md:131; screens-intake-rounds.md:20 |
| screens-entry | (no mark) | `act.aiaccountadd.does`, `act.aiaccountswitch.does` (in neither) | notes ux-design.md:95 |
| screens-wizards | (Suggestion) | the Alt+Shift+W setting drawn in `account` | screens-wizards.md:105 |
| interface-assets | R10 | `i-document`, `i-due`, `i-sever` icons referenced by drawings, absent from icons.svg | interface-assets.md:48 |
| capture-requests | plan K5575 | the Queue item's words when a site asks for a person: "the words are UX-DESIGN's, sent as a need" | build/plan/T53-R1/capture-requests.md:19 |
| interface-shell | plan W-row | "a signed-out deep link … shows one plain sentence above the sign-in form (words owed)" | build/plan/T53-R1/interface-shell.md:39 |
| instance-setup | (no mark) | DEC-109's claim-page wording, "BOB's draft, owed to UX-DESIGN to re-word"; the disclosure's words (NOTICE to UX-DESIGN) | instance-setup.md:64,85 |

The inventory's own open row, installer R95 (notes :66), still stands. Its words, ranges and sentences are to come from UX through BOB.

### C. Standing pattern: words a module holds until the design stream gives them
- `ACT_HELP_ABSENT` (op-declarations R34; affordances.md:78,104,138; op-specs-late.md:19,32,45,86).
- SCREEN_WORDS held "until the design stream keys/adopts them" (screens-entry:118, screens-public:9, screens-publish:53, screens-wizards:104).
- screens-daily:51 (a pointer's hours and languages); screens-daily:136 (`assistant` has no `ask`).
- screens-public:24 and screens-publish:89 (a kind in the design's words); screens-publish:87 (the section-note key).
- screens-settings:133 (N1248 samples to UX for fills, B366); wizard-scripts:94 (`doors`); conformance:100; connections:111; duties:44; queue:16; capture-sources:164.

### D. DECISIONS.md `owed` / `provisional` items, docs/development/DECISIONS.md:1730-1900
The root `DECISIONS.md` (40 lines) holds only BD-1 and BD-2. BD-2 (:25-40) adds the investigation and publication lanes beside ux and says "ux is qualified the same way if it lacks a research area". The range the brief names is in `docs/development/DECISIONS.md`. Each record there carries an `owed:` line naming UX or redesign work:

| DEC | owed (UX-related part) | line |
|---|---|---|
| DEC-107 | "Obligation" re-worded to "To do"; the UX page's question 25 marked ruled | :1742 |
| DEC-108 | the knock page saying when a limit holds; the inbox's highlighting and sorting; the tally and refusal sentence | :1762 |
| DEC-109 | the claim page's and wizard's wording (instance-setup); the administrator settings card (the redesign); question 27 marked ruled | :1776 |
| DEC-110 | "Condition" re-worded to "Signal"; the redesign's three item styles, sorting, collapsible groups; question 28 | :1794 |
| DEC-111 | "tell the network" act and its outward-act warning; question 29 | :1814 |
| DEC-112 | the public page's first line per finding; the strength section's opening (the redesign); "How to check this case yourself" | :1833 |
| DEC-113 | "hold released" heavier, its form; the held-project strip | :1847 |
| DEC-114 | "Matters"/"matter" in every member-facing string for a plan's subjects; question 34 | :1861 |
| DEC-115 | start-and-send flow and filing panels held to the approved sketch; the matter page and queue items; question 35 (provisional: UX-ANSWERS OQ-9, "layout remains Design's", :1868) | :1875 |
| DEC-116 | docket presentation, outside-response path | :1898 |

Spot checks in the design sources: "Obligation" and "Condition" occur 0 times. "Subjects" occurs only as `screen.finder.subjects.heading` "Subjects named" (words-drawn-2.src.py:428; mock-screens.js:1111), which names the finder's route, not a plan's subjects. That suggests the DEC-107, DEC-110 and DEC-114 rewordings are done in the stream. Whether "the UX page's question N marked ruled" is done was not checked.

### E. build/plan items naming UX
- `build/plan/T53-R1/*.md` repeat one line for every module (K5565): a B site gets "a words row, UX-DESIGN's wording where it is shown to a member". That is a standing source of new U items.
- T53-R1/interface-shell.md:27 (422 px), :39 (words owed). T53-R1/installer.md:9 and :51 (screen needs to UX-DESIGN through BOB). T53-R1/capture-requests.md:19 (K5575).
- `build/plan/lane-reading-architecture/GAP.md:47,215,230,507`: the sheet preview's "show more" screen, new rows "through one HANDOFF to UX-DESIGN", and DEC-417's retired sentence.

## Open questions
1. **Library drift.** wizard-scripts pins `library.json` at `d129238bf3` (6 Oct), but the file has changed since (+451/-79, DEC-281's team words among them). Is that pin deliberate, as R22's "first library" would suggest, or should a library re-take under R42 be owed? journey-check R17 ("group") may also be hit through the library's copy.
2. **Inventory scope.** R1 says "every words item a job has raised", but section 3B's rows are not in the inventory. Should the lane add them, at least installer R93, R96, R97, screens-settings R86, interface-shell-t53 R147, workbooks R2, file-safety R11, extraction R101 and notice-producers R16?
3. **Stale lines in the notes.** The counts line (notes :69) and "Still waiting" (:88) predate the 5 Nov settlement. R1's test checks keys, not prose, so it would not catch this.
4. **Not-met marks.** Who clears the marks in section 3A now that the words are in W? The ledger shows most of those modules COMPLETE while their T53 marks remain. Reopening them is a module-job or coordinator decision.
5. **`lane/ux-team-words`** (journey-check R17/R26) is not in this clone's refs. Where does it stand, and does its owner know?
6. **Missing ledger entries.** setup-words and translations both have requirements but no ledger entry. ux-design `uses: ["setup-words"]`, and setup-words R13 states the rule the lane serves.
7. **R95–R97 "through BOB".** Does lane authority over "design and wording" (CLAUDE.md) let the lane draft these, or must BOB carry them?
8. **Missing icons.** `i-document`, `i-due` and `i-sever` (interface-assets R10) are still absent. Are they owed by the lane?

## Ground truth
- Commit `705f8823d124a6c134cf5af3aa5aa297c8da18c4`, checked out detached in the scratchpad clone `w3`. Nothing was written in the repository.
- Ledger states were read from `process/ledger/*.json` `status.state`.
- Not-met marks were found with a grep for `*(not yet met:` in `build/requirements/*.md`: 626 marks across about 70 files.
- Key presence was checked with grep over `docs/development/ux-substrate/screens/{build_words.mjs,words-drawn-*.src.py,words-reads-*.json}`, `bio-plane/src` and `newgroup/src`. W and U themselves are generated and not committed, so "in W" means "in a design source the generator reads".
- Pin checks: `git diff <pin> HEAD -- <path>` and sha256 against the `*_SOURCE` constants.
- Not verified: whether the generated W at this commit builds cleanly (`build_words.mjs --check` was not run, by instruction), and the contents of remote branches.
