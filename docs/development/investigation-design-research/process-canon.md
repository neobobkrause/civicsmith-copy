# Process canon for the investigation lane

Research worker 1 for the `investigation` design lane (qualification), 6 Nov 2026. Read-only.

**Sources and how they are cited**

- **F** is the *Process3 Foundations*, https://claude.ai/artifact/RVZ8szbF1UHHSETkcGrKw8. It is a Claude Doc (id c657f533-…, tab "Foundations", rev read 6 Nov). It was read in full through the Claude Docs connector. A doc has no line numbers, so F is cited by section and paragraph, e.g. *F §Roles and sessions ¶"Lane qualification"*. Its second tab, "Proposed changes (awaiting Bob)", rev 12, was searched for lane lines. It holds only the SLB-8 roles change, which is already applied to F.
- **PR** is the pinned process: `.process` at `56f8c932` ("Merge PR 195: build/lane-qualification into tranche"), the submodule commit of the product tree at `617b48f5`.
- Product paths are relative to the repo root at `617b48f5`, the tranche tip "Merge PR 668: lane/investigation-seed".
- **rulings** is `build/rulings.md`.
- **old lane** is branch `design/investigation` @ `87134cce53` (2026-10-09 17:45Z).
- **state** is branch `process-state`.

---

## 1. What a lane is, and what it may and may not do

### Definition (Foundations)
- **SES-14.** "Lanes are ad hoc. You identify the need for a lane and BOB opens it; some stay open for extended periods; the UX lane is always there, as a directory and a design responsibility; whether any lane runs as a long-lived session is measured (SES-14). A lane carries a design responsibility and a directory of design knowledge in the repository. Lanes work because BOB knows how to delegate: it recognises a design question, passes it to the lane with enough context to decide, waits for the lane's decision, and keeps the final say. Whether a given lane runs as a long-lived session or as a worker started with its directory is BOB's call, judged by cost; a long-lived lane refreshes under BOB's management so depth stays consistent." (F §Roles and sessions ¶"Lanes (SES-14)")
- **Roles table, Lane row.** Created by "BOB, when you identify the need; some stay open, UX always (SES-14)". Its permission is "Inherits BOB's; tool-restricted". Refresh: "A long-lived lane refreshes under BOB's management so depth stays consistent". (F §Roles and sessions, roles table)
- **Who creates lanes.** "BOB, one per product, is the only creator of jobs and lanes" (F §Roles and sessions, diagram text). The properties table says the same: "Creation only by you, ROOT, BOB (jobs and lanes; … SLB-8) or a scheduled task" (F properties table, row PLT-5/SES-1).
- **SES-15.** "Requests between jobs and lanes pass through BOB, which routes them … Spokes never see each other." (F ¶"BOB routes, and explains to you (SES-15)")
- **What Bob sets through lanes.** Bob as product manager sets "audiences and their requirements …". The process carries these as "The canon and each module's requirements, cited by id; lanes for design areas you identify" (F §What this process is for, table).
- **Triage lanes are a different kind.** "A process triage lane and a product triage lane study each identified problem and bring you options" (F ¶"How problems are handled", AUD-8). In the tool they are `kind: "triage"`, with no research area (PR `tool/lib/lane.mjs`:21-23, 46, 51).

### Bob's standing approval (repo CLAUDE.md)
- `/CLAUDE.md`:11 (identical in `.process/CLAUDE.md`:11) reads: "Design lanes, run under BOB, own their lane folders, the design stream (docs/development/ux-substrate) included, and each lane runs as one session at a time. Within the product's principles they decide design and wording there. Their design documents are claude.ai artifacts, not repository files. A pull request that changes only files in its own lane's folder lands through the merge tool without a test suite run, and the large files a lane's generators build are built at layer close, deploy and release, never committed."
- The standing approvals were "widened on 5 Nov 2026 for design lanes" (`/CLAUDE.md`:3).

### The pinned process
- **What a lane is.** "A lane (SES-14; Bob, 5 Nov) carries one design responsibility and is kept to one session at a time. It is not a read-only helper." (PR `README.md`:67)
- **The folder (`dir`).** It "holds only what the product's build reads (sources, and generators whose outputs are built inputs to the release …)". `module` is "the ledger module whose marks are the lane's work". (PR `README.md`:67; `lane.mjs`:9-12)
- **Design documents.** They "are claude.ai artifacts and documents, never repository files". `lane artifact` records each link in `lanes/artifacts.jsonl` on the state branch, so a successor finds them. (PR `README.md`:67; `lane.mjs`:313-339)
- **What the START says** (PR `lane.mjs`:285-293):
  - "You answer BOB's design questions in your area: decision, why (file and line), what changes."
  - "Work on `lane/<name>` from `<tranche>`; land each change as a pull request into `<tranche>`."
  - "Not yours: merging, starting sessions, another lane's or module's work, `.process/`, `process/`, CLAUDE.md, deploying."
  - "Report each change and decision to BOB by send_message."
  - "When you stop for good, tell BOB, who runs `lane end`."
- **BOB's rulebook, rule 5** (PR `rulebooks/bob.md`:16): "Jobs and lanes meet only through you. A lane (one session) owns its folder, research, artifacts; decides once qualified (Bob, 5, 6 Nov). Ask it or a `lane ask` worker; you decide last."
- **One seat per lane.** `lane start` writes the seat in `lanes/sessions.jsonl` before it prints the create_session call. It refuses while the seat is held, or while the lane module's job is WORKING or OPEN. `job start` refuses or skips the lane's module while the seat is held. (PR `README.md`:67; `lane.mjs`:207-220, 342-395, 414-423)
- **The investigation seat today.** The seat is held by this session: start 2026-11-06T17:32:19Z, then record `session_018BhcecAwJP5DnnQjPq4JTZ` (state `lanes/sessions.jsonl`). No asks and no artifacts are recorded for `investigation` (state `lanes/asks.jsonl`, `lanes/artifacts.jsonl`).

### The gate's lane-only (records-only) path
These rules come from PR `README.md`:67 and `tool/lib/util.mjs`:400-461.
- **When it applies.** A PR that is neither a job's nor the tranche's, and whose every file (records aside) is inside one lane's folder (`dir` or research area), takes the records-only path: trigger `record`, `lane` in its row, and "no suite, install or build". The record checks still run, and a committed generated output is a finding.
- **Paths that never count as lane paths:**
  - any module's tests;
  - a file another module's `paths` name;
  - the gated job's own files;
  - `CLAUDE.md`, `.claude/`, `.github/` or `.process/` anywhere (`util.mjs`:438-447).
- **Two lanes in one PR.** A PR touching two lanes' folders is not lane-only (`laneOnly`, `util.mjs`:452-461).
- **Folders refused as a lane `dir`.** A `dir` at the root, outside the checkout, or under `process/`, `.process/`, `.github/`, `.claude/` or CLAUDE.md is refused (`util.mjs`:403-410; `lane.mjs`:44).

### The investigation lane's configuration
- `process/config.json`:33-37 sets `{"name":"investigation","dir":"docs/development/investigation-design/","module":"investigation-design"}`. It has no `research` key, so the area is the default sibling `docs/development/investigation-design-research/` (`util.mjs`:431-436; BD-2, `DECISIONS.md`:32).
- `docs/development/investigation-design/README.md`:3-9 (BOB's seed, PR 668) names:
  - the area: "INVESTIGATION-DESIGN's area (K2076): the investigation engine and the project as an investigation";
  - the canon: `docs/architecture/BIO_Investigation_v0_1.md`;
  - the research area.

---

## 2. Qualification rules

### Foundations (SES-19 to SES-23; Bob's word, 6 Nov), verbatim
From F ¶"Lane qualification (SES-19 to SES-23; your word, 6 Nov)":
- **SES-19.** "A lane is the load-bearing source of truth in its area, and is qualified for that before it decides anything (SES-19; 'The important thing to remember when setting up lanes is the insure that a lane is fully qualified to fulfill their role as the load-bearing source of truth in their area', your words, 6 Nov)."
- **SES-20.** "The first time a lane is defined and run, it starts by using workers to research fully the canon documents, the existing code and the best practices of its specialty area, and answers no ask until that research has landed (SES-20; 'So The first time a lane is defined and run, it should start by using workers to fully research canon documents, existing code, and best practices related to their specialty area')."
- **SES-21.** "A lane-specific research area in the product repository records that research and the ongoing research after it; it counts as the lane's own folder, is never what the build reads, and every later session of the lane reads it first, draws from it and evolves it (SES-21; 'This initial and ongoing research should be recording in a lane-specific area of the product repo for subsequent sessions to draw from and evolve')."
- **SES-22.** "Research continues as the lane works: a question its research area does not answer is researched and recorded there, and a lane ask worker reads the research area first too (SES-22)."
- **SES-23.** "Lanes are cut by design area; for CivicSmith, the earlier process versions' investigation design and publication design lanes, beside UX (SES-23; 'The lane charters used in earlier process versions included an investigation design lane and a publication design lane. Perhaps that's an appropriate partition to continue to use')."
- **Canon status.** "These lane startup and operating requirements are part of the Process3 canon ('These requirements related to lane startup and ongoing operations should be part of the process3 canon of requirements', your words, 6 Nov)."
- **Measurements still open** (F §To measure): "Which lanes run as long-lived sessions and which as workers with the lane's directory (SES-14)", and "Tokens per lane question; quality of answers as judged by you".

### What the tool counts as qualified (PR `tool/lib/lane.mjs`)
- **The rule.** The lane is qualified when its research area holds `index.md` and at least one dated `qualification-YYYY-MM-DD.md` at the area's top level, "as the checkout has them" (`lane.mjs`:95-114; `README.md`:67).
- **The test is presence only.** Nothing checks content, size or citations. Qualification is read from the checkout, so it takes effect for `lane ask` only once the PR is in the tranche and BOB's checkout has it (`lane.mjs`:178-180).
- **QUALIFICATION brief (first START), verbatim duties** (`lane.mjs`:270-278):
  - "Answer no ask, and change nothing in `<dir>/`, until your qualification has landed. Tell BOB you are qualifying; an ask meanwhile waits."
  - Workers "each cloning its own checkout, writing nothing there, reporting to you" research three things in parallel:
    1. "The canon: the Process3 Foundations (the lane lines of SES-14, and every line your area touches), the product's principles and its docs, and the requirement files of the modules your area serves (each ledger entry's `requirements` under `process/ledger/`), each cited by file and line or id."
    2. "The existing code in your area: `<dir>/` whole, and the product code that reads it or that it shapes".
    3. "Best practice in your specialty: public, current, authoritative sources, each cited, with where the product follows or departs from it."
  - What to write:
    - `index.md`: "each file, what it holds; every later session reads it first";
    - one file per topic;
    - `qualification-<YYYY-MM-DD>.md`: "what was researched, by which workers, the sources, the open questions, and what the lane now holds as its ground truth".
  - How to land it: "Land them on `lane/<name>` from `<tranche>` as one pull request that changes only `<research>/`: the lane-only path, no suite run. Report it to BOB … The research area is not what the build reads: never put sources or generators there."
- **Later STARTs** lead with the research area (`lane.mjs`:266-269): "Read `index.md` before anything else … Keep it current as you work: research a question it does not answer (with workers, as at qualification) and record the finding there, revise a finding the canon or the code has overtaken, and keep the index true. A research change lands as a lane-only pull request."
- **Starts refused on a research folder.** `lane start` is refused when a research folder already exists holding files with neither `index.md` nor a qualification record (`lane.mjs`:370-373).
- **Where the research area may be.** It must end in `research` or `-research`. It must not be inside or around `dir`, overlap another lane, or hold a `generated` path (`lane.mjs`:48-59; `util.mjs`:420-422).
- **A job of the lane's module** is told to read the research area first, or to qualify first (PR `README.md`:67; `lane.mjs`:425-433).

---

## 3. How asks arrive, and what an answer must contain

- **F SES-14.** BOB "recognises a design question, passes it to the lane with enough context to decide, waits for the lane's decision, and keeps the final say."
- **The command.** `lane ask <name> "<question>" --context <file>...` (PR `README.md`:68; `lane.mjs`:155-205):
  - It records the ask open in state `lanes/asks.jsonl` (lane, question, context files), once while it is open.
  - Routing:
    - while the lane's seat is held, BOB sends the question to the lane's session by `send_message`, with the brief;
    - while the lane module's job is at work, it goes to that job;
    - otherwise BOB starts "one read-only worker (a subagent; it writes nothing and holds no seat)".
  - Refusals: it is refused, with nothing recorded, while the lane is not qualified. It is also refused for triage lanes (`lane.mjs`:160, 176-181).
- **The brief's reading set, in order** (`lane.mjs`:131-141):
  1. The research area: files, bytes and qualified date. Read `index.md` first; "a decision that departs from it says why".
  2. The lane's `dir`.
  3. The recorded design documents.
  4. BOB's context files, with sizes.
- **The answer has three or four parts, in order** (`lane.mjs`:144-150; `README.md`:68):
  - `decision: <one line>`
  - `why: <the lines … it rests on, each with file and line>`
  - `what changes in <dir>/: <each file and what changes, or "nothing">`
  - `research: <what the lane's research area lacks for this question, a line the lane adds to <research>/, or "nothing">`
- **Boundaries of an answer** (`lane.mjs`:143): "Decide within the … lane's design responsibility and what its directory and design documents already hold; where the directory and the context differ, say so. A question only Bob can answer (values, policies, mission, audiences, principles, doctrine, his approvals) is answered 'decision: Bob's', with the options and your recommendation. BOB keeps the final say; you approve and merge nothing."
- **Recording the decision.** `--record "<decision>" --worker <id> [--cost-usd]` records "the decision BOB keeps" and closes the ask. "asking a decided question again opens it again" (`README.md`:68; `lane.mjs`:117-129, 163-174).
- **Bob's standing direction to the earlier lane** (old lane `DECISIONS.md`:3; also `.process/notes/lane-charters.md`:52-55) applies to any question this lane puts to Bob: "Always provide proper and sufficient context when posting questions." Every question carries its background, what exists today, an example of each option, the trade-offs and the reasons for the recommendation.

---

## 4. What is "Bob's" decision

- **What Bob defines (F §The human and the AI).** "You define the project: its values and policies, mission and purposes, audiences and use cases, requirements, principles, high-level architecture, UX and doctrine. BOB does everything else: … decides the product's technical matters, while the coordinator decides the process's, each written as a decision record (REC-11) … (AUD-5 …) (P17)."
- **How Bob's questions are handled (F ¶"Your time is the scarcest resource").** "You see rendered pages, with options and a recommendation, only for what is yours." Also: "When BOB is unsure whether a question is yours, it decides by this section and says how it read it." A Ledger line's purpose is Bob's and its mechanism is BOB's.
- **Bob's questions become decisions before building (F ¶"How problems are handled").** "A question that is yours becomes your decision, and a design, before anything is built on it (P21). Questions that are yours are asked in one place, the walk-through, numbered, with a column for your word; … a decided question is never asked again."
- **BOB rulebook rule 4** (PR `rulebooks/bob.md`:13): "Bob gets only what P17 makes his (what the Foundations say he defines, his approvals or accounts, an act only he can take), with options and context; it is his decision before anything is built on it, never asked again."
- **The tool's list** (lane brief and START, `lane.mjs`:143, 293): "values, policies, mission, audiences, principles, doctrine, his approvals". It goes to BOB as "decision: Bob's", with options and a recommendation. The lane never addresses Bob directly; BOB routes (F SES-15; `bob.md`:16).
- **Where decisions are recorded.**
  - Product decisions are BOB's records `BD-<n>` in `/DECISIONS.md`.
  - "Bob's own rulings are not recorded here: they live in the line they refine (REQ-7)" (`DECISIONS.md`:3).
- **Earlier canon practice.** Canon changes were "approved by Bob and placed by BOB": K2417 approved the design, K2419 the amendments, and K2420 the canon text (rulings:2419-2422). The same rule was stated for the actions lane in `.process/notes/lane-charters.md`:128.

---

## 5. The lane's history, and what carries over

### Earlier INVESTIGATION-DESIGN sessions
- **K1627** (2026-10-06, Bob's; rulings:1629). Bob approves the investigation engine as a product goal: the interview, the planner, research runs, competing explanations and the answer, with "the machine proposes, a member accepts". "The project becomes the investigation's home." Capabilities are studied first. The study is N592, on branch `study/investigation` (K1628, rulings:1630).
- **K2064** (2026-10-07; rulings:2066). The study's 24 decisions D1–D24 (`study/investigation`, `synthesis/architecture.md` §6.1) were never ruled. They were re-presented at artifact J2q3Q4Dmq3FU3phTz7nUdg. BOB settled D5, D9, D10, D11 and D15; the rest stayed open with Bob.
- **K2075** (2026-10-07; rulings:2077). This is Bob's plan construct: the project has a plan of steps, dependencies, resources, deadlines and milestones, assignments, teams and subgoals, and status reports. Bob later narrowed it: "no member roles or subgoals within a project; D25–D26 withdrawn" (K2329, rulings:2331; old lane `HANDOFF.md` H2).
- **K2076** (2026-10-07, the charter; rulings:2078):
  - "modelled on the UX design stream (K945): it writes only `docs/development/investigation-design/` on its branch, never `build/`, canon, product code or `main`";
  - "Bob's decisions are D-numbers (D1–D24 kept, D25 on), never K or DEC";
  - "screens owed to the UX stream";
  - "it hands off through `HANDOFF.md` (`H<n>`), which BOB reads at takeover and every backstop check and answers with a K";
  - "requirements stay BOB's (P5, N748)";
  - "No mechanics change: like the UX stream it runs beside the process, not in it".
  - The manifest section repeats this: `build/manifest.md`:64-66.
- **The general rule for design sessions: K592** (rulings:595). "works with Bob on design only … never writes `build/`, product code, canon or `main`, never merges its branch, and starts no jobs or sessions."
- **K2398** (2026-10-09; rulings:2400). #1 asked for a successor at half its context. #2 (`session_01WzvEVTg39Jijv4CesGz4Dc`) was "told to follow its `RESUME.md`". At H13 the step model is complete and ruled.
- **K2401** (rulings:2403). What is Bob's in the T41 draft is "routed to INVESTIGATION-DESIGN #2, so Bob answers it in his one working document".
- **K2417** (2026-10-09; rulings:2419).
  - Bob: "I've reviewed the investigation design document and approve it." … "I think it should be added to the canon."
  - "The design of record is `investigation-design.html` on `design/investigation` (… https://claude.ai/artifact/QjSSFHE78G9PtwKhpW5ZEo), not DECISIONS.md."
- **K2418** (rulings:2420). H41's placement rule: the canon states "only what's new … with references to other canon documents".
- **K2419** (rulings:2421). Amendments A–S approved: "Everything looks good". Part 1 is put on its own page, https://claude.ai/artifact/9ekq6gMCQyH1N67xuFKXKA.
- **K2420** (rulings:2422). Bob: "Sorry, now I see it. Approved." The canon is placed as `docs/architecture/BIO_Investigation_v0_1.md` ("In force"), with amendments A–S applied to eight canon documents and `INVESTIGATIVE-SESSION.md`.
- **K2421** (rulings:2423). K1481 is amended for exploring (D39). This is canon content, not placement.
- **The canon header** (`docs/architecture/BIO_Investigation_v0_1.md`:3-8). "In force: approved by Bob 2026-10-09 (K2417, K2419, K2420)". It lists Incomplete sections:
  - §3: step, milestone and status-report names, and the plan-vs-action-plan name, are "not ruled (D23, owed with the UX stream)";
  - §11: regrade is not built.
- **The end of the old lane** (old lane `RESUME.md`:3). "**Complete.** … The canon document is the source of truth. This folder (`DECISIONS.md`, `HANDOFF.md` H1–H43, `investigation-design.html`) is the history of how it was reached. A future session starts here only if Bob asks for more design work on investigations; it reads HANDOFF H40–H43 first." H43 reads: "This lane's design work is complete unless Bob asks for more." (old lane `HANDOFF.md`:253-255)
- **The register of later lanes** (`build/rulings-active.md`:45). It reads: "INVESTIGATION-DESIGN (each hand-off folded into requirements, answered with a K; K2076) … lanes change no code."

### Numbering conventions
| Series | Owner / meaning | Source |
|---|---|---|
| D1–D24 | the study's decisions (study/investigation) | K2064; old lane `DECISIONS.md`:5 |
| D25–D66 | Bob's decisions made through the old lane ("ruled", "settled", "open") | K2076; old lane `DECISIONS.md`; `lane-charters.md`:30 |
| H1–H43 | old lane → BOB hand-offs in `HANDOFF.md`, each answered by BOB with a K | K2076; old lane `HANDOFF.md`:1-3 |
| K<n> | rulings in `build/rulings.md` (pre-Process3), BOB's alone | K2076; `lane-charters.md`:85 |
| DEC-<n> | UX-DESIGN's ids for Bob's UX rulings | `lane-charters.md`:69 |
| BD-<n> | Process3 product decision records, BOB's | `DECISIONS.md`:1-12 |
| ask/decision rows | Process3 lane decisions, in state `lanes/asks.jsonl` | `lane.mjs`:117-129, 170 |

### What carries over and what does not
**Carries over:**
- the area, from K2076 and BD-2 (`DECISIONS.md`:28: "It owns INVESTIGATION-DESIGN's area (K2076): the investigation engine and the project as an investigation");
- the canon `BIO_Investigation_v0_1.md` as source of truth (BD-2; old lane `RESUME.md`:3);
- the old lane's D-register and H-history, as read-only history on `design/investigation`;
- Bob's standing direction on context in questions;
- screens and names belong to UX (K2076; canon §3 D23).

**Changed by Process3:**
- the lane now runs *in* the process, not "beside" it;
- it owns its folder and decides design and wording there (`/CLAUDE.md`:11);
- it lands PRs through the merge tool;
- its documents are claude.ai artifacts recorded by `lane artifact`, not committed HTML;
- its hand-offs are `send_message` reports to BOB and `lane ask --record` rows, not a `HANDOFF.md` read at backstops (`lane.mjs`:286, 293);
- the new research-first qualification (SES-19 to SES-23).

**No equivalent yet.** There is no Process3 numbering for Bob's design decisions made through a lane: D-numbers are not continued anywhere in PR or BD-2.

### Note on `.process/notes/lane-charters.md`
- The coordinator asked for a comparison with branch `build/lane-qualification`. `git diff` of the pinned `56f8c93` against `origin/build/lane-qualification` (`bee0d55`) shows **no difference in `notes/lane-charters.md`**. That branch differs only in `layerflow.mjs`, `rulebooks/layer-branch.md` and `p3.mjs`.
- §2 (`lane-charters.md`:20-59) is the summary of INVESTIGATION-DESIGN used above. Its line 18 cites `build/rulings-active.md`:39. The line is now at :45, with the same text.

---

## 6. Open questions and conflicts between sources

1. **Module `investigation-design` has no ledger entry.**
   - `process/config.json`:36 names it, and PR says "the module's marks are the lane's work" (`README.md`:67; `lane.mjs`:292).
   - But there is no `process/ledger/investigation-design.json` (only `investigation.json`, `ux-design.json` and others).
   - So the lane has no marks and no requirements file of its own. The tool tolerates this (`laneOfModule`, `lane.mjs`:65-67).
   - Should BOB create the entry, or drop `module`?
2. **What the lane folder holds.**
   - The seed README says "this folder holds the lane's working files and hand-offs" (`docs/development/investigation-design/README.md`:3).
   - PR says `dir` "holds only what the product's build reads (sources, and generators …)", and design documents are never repository files (`README.md`:67; `lane.mjs`:292).
   - A docs folder that no build reads fits neither reading cleanly.
3. **Bob's list differs between sources.**
   - F lists **requirements, use cases, high-level architecture and UX** as things Bob defines (F §The human and the AI).
   - The tool's "Bob's" list omits them: "values, policies, mission, audiences, principles, doctrine, his approvals" (`lane.mjs`:143, 293).
   - The investigation area is largely requirements and architecture. Where the lane's "design and wording" ends and Bob's "requirements / high-level architecture" begins is unresolved.
   - K2076 also kept requirements BOB's. The pinned PR is silent on requirement edits by a lane, so they presumably go through the module's job.
4. **Canon edits.**
   - The old lane was forbidden canon (K2076; K592). Canon was approved by Bob and placed by BOB (K2417 to K2420).
   - Process3 lets a lane decide in its own folder only (`/CLAUDE.md`:11). `docs/architecture/` is not the lane's folder, so a canon change is a non-lane PR judged "as today" (`README.md`:67).
   - Who may amend `BIO_Investigation_v0_1.md`, and whether it needs Bob's approval (canon is "principles/doctrine"-like), is not stated.
5. **Session versus worker.**
   - F says long-lived session versus worker is "BOB's call, judged by cost … measured".
   - `/CLAUDE.md`:11 and PR fix "one session at a time". They are compatible: an ask worker holds no seat (`lane.mjs`:218-219). Qualification itself is defined only for a session, through `lane start`.
6. **Strictness differs.** F SES-20 says only "answers no ask until that research has landed". The tool's brief adds "and change nothing in `<dir>/`" (`lane.mjs`:272).
7. **Qualification is presence-checked only.** `index.md` plus a dated file is enough (`lane.mjs`:111-113). The "fully research" bar of SES-19/20 is judged by no check, so it rests on the lane (and on Bob's "quality of answers as judged by you", F §To measure).
8. **Decision numbering.** The old D-numbers, H-handoffs and K-answers are retired with no stated successor. Lane decisions are unnumbered `asks.jsonl` rows, and Bob's rulings "live in the line they refine (REQ-7)" (`DECISIONS.md`:3). Where the lane records a Bob decision durably (artifact, research area, or canon line) needs a convention.
9. **Old lane "Complete" versus new lane.**
   - The old RESUME says to restart "only if Bob asks for more design work on investigations".
   - Bob's 6 Nov SES-23 and BD-2 reopen the area as a standing lane. That is consistent, since Bob asked.
   - The canon's two Incomplete sections (§3 names, owed with UX; §11 regrade) are the first known open items. Asks to UX go only through BOB (F SES-15; `bob.md`:16).
10. **K-reference detail.**
    - The coordinator's note says the canon was "placed under K2419–K2421". In the record, K2420 placed it, K2419 approved amendments A–S, and K2421 is a K1481 content amendment (rulings:2421-2423).
    - The canon header cites K2417, K2419 and K2420 (`BIO_Investigation_v0_1.md`:3).
    - `lane-charters.md`:33 matches the coordinator's wording.
11. **Publication boundary.** Publication was in actions' scope "where actions touch it" (`lane-charters.md`:124). The publication lane (BD-2) now owns "publication, ratification, docket, case making and the actions around them" (`DECISIONS.md`:29). The investigation/case-making seam (inquiry, leg, basis, conclusion, cited by canon `BIO_Investigation_v0_1.md`:5 from `BIO_Case_Making_v0_1.md`) needs a stated border between the two lanes.
