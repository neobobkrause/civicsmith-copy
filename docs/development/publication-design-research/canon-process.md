# The Process3 canon for the `publication` design lane

Research worker for the `publication` lane (session_018BhcecVeBq3c6BYSyTV3Ph), 6 Nov 2026. Read-only.

Sources and citation forms:
- Product paths are at tranche `705f8823`, e.g. `CLAUDE.md:11`.
- Pinned process paths are `.process/<path>:<line>`, read at /home/user/civicsmith-copy/.process (process3 `56f8c93`, "Merge PR 195: build/lane-qualification").
- "Foundations" means https://claude.ai/artifact/RVZ8szbF1UHHSETkcGrKw8, tab "Foundations" (rev 48), cited by section and paragraph. The doc has no stable line numbers.
- Its second tab, "Proposed changes (awaiting Bob)" (rev 12), was read whole. Its only lane content is SLB-8 ("BOB starts jobs and lanes").
- Lines marked *inference* are my reading, not text in the source.

## 1. What the lane is (charter, area)

- **Definition of a lane.** A lane carries one design responsibility and is kept to one session at a time. It is not a read-only helper. Sources: `.process/README.md:67`; `.process/tool/lib/lane.mjs:1-16`.
- **Foundations, §Roles and sessions, ¶"Lanes (SES-14)".**
  - Lanes are ad hoc. Bob identifies the need and BOB opens the lane.
  - The lane "carries a design responsibility and a directory of design knowledge in the repository".
  - BOB "recognises a design question, passes it to the lane with enough context to decide, waits for the lane's decision, and keeps the final say".
- **Foundations, roles table, "Lane" row.**
  - Started by BOB "when you identify the need; some stay open, UX always (SES-14)".
  - Permission: "Inherits BOB's; tool-restricted".
  - Refresh: "A long-lived lane refreshes under BOB's management so depth stays consistent".
- **Bob's standing approval (`CLAUDE.md:11`).**
  - "Design lanes, run under BOB, own their lane folders, the design stream (docs/development/ux-substrate) included, and each lane runs as one session at a time."
  - "Within the product's principles they decide design and wording there."
  - "Their design documents are claude.ai artifacts, not repository files."
- **Source-of-truth role.** "A lane is the load-bearing source of truth in its area, and is qualified for that before it decides anything" (Foundations, ¶"Lane qualification (SES-19 to SES-23)", SES-19, Bob 6 Nov).
- **Partition.** "Lanes are cut by design area; for CivicSmith, the earlier process versions' investigation design and publication design lanes, beside UX" (same ¶, SES-23).
  - Bob also said the lane startup and operating requirements "should be part of the process3 canon of requirements" (same ¶).
- **This lane's configuration** (`process/config.json:38-42`).
  - `{"name":"publication","dir":"docs/development/publication-design/","module":"publication-design"}`.
  - No `research` key is set, so the research area is the tool's default sibling, `docs/development/publication-design-research/` (`.process/tool/lib/util.mjs:424-436`; `DECISIONS.md:32`).
- **Charter decision BD-2** (BOB, 6 Nov; `DECISIONS.md:25-40`).
  - The lane owns ACTIONS-DESIGN's "Publication & action" area (K2433): "publication, ratification, docket, case making and the actions around them" (`DECISIONS.md:29`).
  - It gets a new folder and does not reuse `docs/development/action-design/`, which is the ended ACTION_DESIGN #1 lane's history (K592) (`DECISIONS.md:30`).
  - Its qualification research starts from that folder and from `actions-design/` on branch `design/actions` (R1-R6, Actions D1-D24, BIO_Action_v0_2) (`DECISIONS.md:31`).
  - Bob confirmed the identification at about 17:05Z: "Yes, publication design is the ACTIONS-DESIGN area" (`DECISIONS.md:26`).
- **The lane folder's README** (`docs/development/publication-design/README.md:1-9`). It restates the area, names the earlier work, names the research area, and says "BOB seeded this README ... The lane owns everything here from now on" (`:9`).
- **Historical charter (ACTIONS-DESIGN, K2433, 9 Oct; ended K3469, 15 Oct)** (`.process/notes/lane-charters.md:101-149`).
  - Purpose: "researches, maps, and designs how Civicsmith supports members through the action plan, and ends with a canon draft and a hand-off to BOB for requirements" (`:111`).
  - Publication was in scope where actions touch it, e.g. Actions D13 to the signing view and the case-authoring/publication modules (`:124`).
  - In BOB #333's area table, "Publication & action" owns the Publication, Case Making and Action v0.2 canon, with lane "none" (`:148`).
- **The lane's module, `publication-design`, does not exist anywhere at this tranche.**
  - No ledger entry: `process/ledger/` has no `publication-design.json`. The only `*design*` entry is `ux-design.json`. There is no `investigation-design.json` either.
  - No `build/modules.json` entry.
  - No `build/requirements/publication-design.md`.
  - Checked by listing at 705f8823. See §8 Q1.
- **The modules whose area this is** all have ledger entries: `publication`, `ratification`, `docket`, `case-*` (11), `action-*`/`actions` (6), `publish-schedule`, `public-read`, `screens-publish`, `screens-action`, `screens-public` (listing of `process/ledger/`).
  - For example, `ratification` paths are `bio-plane/src/ratification/` and `docket` paths are `bio-plane/src/docket/` (`build/modules.json`).

## 2. What it may do

- **Decide design and wording** within the product's principles, in its folder (`CLAUDE.md:11`; START text at `.process/tool/lib/lane.mjs:285`).
- **Answer BOB's design questions in its area**, in the form "decision, why (file and line), what changes" (`.process/tool/lib/lane.mjs:285`; `.process/README.md:68`).
- **Own its folder, research and artifacts, and decide once qualified** (`.process/rulebooks/bob.md:16`, rule 5).
- **Write and update its design documents as claude.ai artifacts and documents.**
  - It works with Bob through them. They are never repository files (`.process/README.md:67`; `.process/tool/lib/lane.mjs:287-288`).
  - Each one is recorded by link with `lane artifact publication <link> --title "<name>"`.
    - The tool help (`.process/README.md:67`) lists the command under BOB.
    - The START text tells the lane itself to "record each new one" with this command (`.process/tool/lib/lane.mjs:288`).
- **Use workers (subagents) to research**, at qualification and later, for a question the research area does not answer (`.process/tool/lib/lane.mjs:265-266, 272-276`; Foundations, SES-22).
- **Land changes** on branch `lane/publication`, cut from `tranche`, as pull requests into `tranche`. A PR changing only the lane's folder takes the records-only path (`.process/tool/lib/lane.mjs:292`; `CLAUDE.md:11`).
- **Keep generators in its folder whose outputs are build inputs.**
  - Each output is a `generated` row, built at layer close, deploy and release, and never committed (`CLAUDE.md:11`; `.process/README.md:67`).
  - Today no `generated` row is under `publication-design/` (`process/config.json:59-` lists rows under `ux-substrate/screens/`, `bio-plane/`, `newgroup/` and worker `dist/`).
- **Answer "decision: Bob's"** for a question only Bob can answer (values, policies, mission, audiences, principles, doctrine, his approvals), with options and a recommendation, sent to BOB (`.process/tool/lib/lane.mjs:293`).
- **Report each change and decision to BOB** by send_message (`.process/tool/lib/lane.mjs:293`).
- **Read the canon, code and public best practice.** This is not an act on another service (`CLAUDE.md:13`).

## 3. What it may not do

- **The START's "Not yours" list** (`.process/tool/lib/lane.mjs:293`):
  - merging;
  - starting sessions;
  - another lane's or module's work;
  - `.process/`, `process/` and CLAUDE.md;
  - deploying.
- **Before qualification has landed:** "Answer no ask, and change nothing in `<dir>/`" (`.process/tool/lib/lane.mjs:272`).
- **Approve or merge nothing.** BOB keeps the final say (ask brief, `.process/tool/lib/lane.mjs:143`; `.process/README.md:68`; `.process/rulebooks/bob.md:16` "you decide last").
- **No contact with other spokes.** Requests between jobs and lanes pass through BOB (Foundations, ¶"BOB routes, and explains to you (SES-15)"; `.process/rulebooks/bob.md:16` "Jobs and lanes meet only through you").
- **No more than one session.**
  - No second session of the lane runs while its seat is held.
  - No job of `publication-design` starts while the lane is live (`.process/tool/lib/lane.mjs:207-219, 361-366`; `.process/README.md:67`).
- **No committed generated outputs.** A committed generated output in a lane PR is a gate finding (`.process/tool/lib/gate.mjs:253-258`).
- **Never put sources or generators in the research area.** "The research area is not what the build reads" (`.process/tool/lib/lane.mjs:277`).
  - The config refuses a research area that holds a `generated` path (`.process/tool/lib/lane.mjs:57-59`).
- **No new lane folder outside the allowed places.** A lane `dir` at the root, outside the checkout, or under `process/`, `.process/`, `.github/`, `.claude/` or CLAUDE.md is refused (`.process/tool/lib/util.mjs:403-409`; `.process/tool/lib/lane.mjs:42-44`).
- **Not product decisions that are Bob's under P17.** Bob defines values, policies, mission, purposes, audiences, use cases, requirements, principles, high-level architecture, UX and doctrine (Foundations, §"The human and the AI", ¶2). Such a question becomes "decision: Bob's" (see §5).
- **All of Bob's standing "never" rules bind it** (`CLAUDE.md:13`; `.claude/rules/standing-safety.md:5`):
  - no force-push;
  - no branch, tag or release deletion;
  - no settings changes;
  - no push to main;
  - no secret revealed;
  - only the named Cloudflare account.
- **Historical forbiddances (not current canon, context only).** ACTIONS-DESIGN could "Write ONLY `docs/development/actions-design/` ... Never `build/`, canon (`docs/architecture/`), product code, `docs/development/ux-substrate/`, or `main`".
  - "Requirements stay BOB's (P5). Canon changes are approved by Bob and placed by BOB."
  - "Screens are owed to the UX design stream" (`.process/notes/lane-charters.md:126-130`).
  - The general rule K592 says a design session "never writes `build/`, product code, canon or `main`, never merges its branch, and starts no jobs or sessions" (`.process/notes/lane-charters.md:16`).

## 4. Qualification and research-area rules

- **Bob's requirements** (Foundations, ¶"Lane qualification (SES-19 to SES-23)").
  - SES-20: the first run uses workers "to research fully the canon documents, the existing code and the best practices of its specialty area, and answers no ask until that research has landed".
  - SES-21: a lane-specific research area in the product repository records it. It "counts as the lane's own folder, is never what the build reads, and every later session of the lane reads it first, draws from it and evolves it".
  - SES-22: research continues as the lane works, and a lane ask worker reads the research area first too.
- **When a lane is qualified.** The research area holds `index.md` and at least one dated `qualification-<YYYY-MM-DD>.md`, as the checkout has them (`.process/tool/lib/lane.mjs:95-116`; `.process/README.md:67`).
- **The QUALIFICATION brief's three research strands** (`.process/tool/lib/lane.mjs:271-277`):
  1. The canon: the Foundations (SES-14 lane lines and every line the area touches), the product's principles and docs, and the requirement files of the modules the area serves (each ledger entry's `requirements`).
  2. The existing code: `<dir>/` whole, plus the product code that reads it or that it shapes.
  3. Best practice: public, current, authoritative sources, each cited, with where the product follows or departs.
- **What qualification writes** (`.process/tool/lib/lane.mjs:277`).
  - Files: `index.md` (each file and what it holds), one file per topic, and `qualification-<date>.md` (what was researched, by which workers, sources, open questions, and the lane's ground truth).
  - Landing: "Land them on `lane/<name>` from `<tranche>` as one pull request that changes only `<research.area>/`: the lane-only path, no suite run. Report it to BOB."
- **Where the research area may be** (`.process/tool/lib/util.mjs:405-436`; `.process/tool/lib/lane.mjs:50-59`).
  - Its last part is `research` or ends `-research`.
  - It is a sibling of `dir`, not inside it or around it.
  - It does not overlap another lane's dir or research, is not under the governed folders, and holds no `generated` path.
  - The gate drops it (no lane path) if it is invalid.
- **Leftover folders.** `lane start` refuses when the research folder already holds files with neither `index.md` nor a qualification record (`.process/tool/lib/lane.mjs:371-373`). Today the folder does not exist at 705f8823, so this does not bite.
- **Effect on asks.** `lane ask` is refused, with nothing recorded, until the lane is qualified (`.process/tool/lib/lane.mjs:177-181`; `.process/README.md:68`).
- **Starts after qualification** lead with the research area (files, bytes, dates) before the design documents. The lane must keep it current: research unanswered questions, revise overtaken findings, keep the index true. Research changes land lane-only (`.process/tool/lib/lane.mjs:265-268`).
- **A job of the lane's module**, if one ever runs, is told to qualify first or to read the research area first (`.process/tool/lib/job.mjs:105-113`).
- **Historical precedent.** ACTIONS-DESIGN's own "Step 1, research" covered R1-R6:
  - core canon;
  - other canon;
  - rulings incl. UX DECs;
  - the old action-design lane;
  - the 11 action modules with tests;
  - adjacent modules.
  - It asked Bob nothing until its use cases and design existed (`.process/notes/lane-charters.md:132-136`).

## 5. Asks and decisions

- **How an ask reaches the lane** (`.process/README.md:68`; `.process/tool/lib/lane.mjs:155-205`).
  1. BOB runs `lane ask publication "<q>" --context <file>...`. This records the ask open in `lanes/asks.jsonl` on the state branch.
  2. While the lane's seat is held, BOB's act is "send_message to the lane's session ... with the brief below". With no seat, BOB starts one read-only worker (`:198-202`).
- **What the ask brief tells the reader to read** (`.process/tool/lib/lane.mjs:131-153`), in order:
  - the research area, starting with `index.md`; "a decision that departs from it says why";
  - the lane's dir, starting from its README;
  - the recorded design documents;
  - BOB's context files.
- **Output format** (`.process/tool/lib/lane.mjs:146-152`):
  - `decision: <one line>`;
  - `why: <lines ... each with file and line>`;
  - `what changes in <dir>/: <each file ... or "nothing">`;
  - `research: <what the research area lacks ... or "nothing">`.
- **"decision: Bob's"** applies to "a question only Bob can answer (values, policies, mission, audiences, principles, doctrine, his approvals)", with options and a recommendation (`.process/tool/lib/lane.mjs:143, 293`).
- **What makes a question Bob's (P17)** (Foundations, §"The human and the AI", ¶2 and ¶4).
  - It is his decision before anything is built on it (P21), and it is never asked again.
  - BOB "decides by this section and says how it read it" when unsure (Foundations, ¶4; `.process/rulebooks/bob.md:15`, rule 4).
- **Recording.** BOB records the decision it keeps with `lane ask ... --record "<decision>" --worker <id> [--cost-usd]`, which closes the ask (`.process/README.md:68`; `.process/tool/lib/lane.mjs:163-174`).
  - Asking a decided question again reopens it (`.process/tool/lib/lane.mjs:122-124`).
- **Where decisions are written down.**
  - Product decisions are BOB's, each a short BD record in `DECISIONS.md` (`DECISIONS.md:3`; `.process/rulebooks/bob.md:15`).
  - Bob's own rulings live in the line they refine (REQ-7) (Foundations, §"Requirements, rules and text", ¶"Decisions"; `.process/DECISIONS.md:3`).
- **Bob's standing direction to the earlier investigation lane** (context, not current canon): "Always provide proper and sufficient context when posting questions", and details are "reported, not asked" (`.process/notes/lane-charters.md:52-55`).
- **The first queued ask.** "ratification F1's second-signature design over docketStatement, to publication once it is qualified. If the lane rules it Bob's, it goes to the coordinator. Until then, no job takes ratification F1" (`DECISIONS.md:39-40`).

## 6. How work lands (lane-only path; what breaks it)

- **The rule** (`CLAUDE.md:11`): "A pull request that changes only files in its own lane's folder lands through the merge tool without a test suite run."
- **The gate** (`.process/README.md:67`; `.process/tool/lib/gate.mjs:253-261`).
  - A PR that is neither a job's nor the tranche's, and whose every file (records aside) is inside one lane's folder, takes the records-only path.
  - Its row carries trigger `record` and `lane`. No suite, install or build runs. The record checks still run.
  - It merges through the merge tool.
- **"Lane's folder"** means `dir` plus the research area (`.process/tool/lib/util.mjs:442-447`, `laneOfPath`).
- **"Records"** means `process/config.json` `records`, which is `["process/"]` (`process/config.json:6-8`).
  - *Inference:* a PR touching `process/` plus the lane folder would still pass `laneOnly` (`.process/tool/lib/util.mjs:450-461`), but `process/` is "Not yours" for the lane (`.process/tool/lib/lane.mjs:293`).
- **Merge.** BOB merges; the lane does not.
  - `merge` checks `laneOnly` against the base's config and logs "it lands as a lane's change". It skips the module-files refusal (`.process/tool/lib/merge.mjs:1032-1037`).
  - BOB merges plain pull requests with `merge --plain` (`.process/rulebooks/bob.md:7`; `.process/README.md:46`).
- **What breaks the lane-only path** (`.process/tool/lib/util.mjs:436-461`; `.process/README.md:67`):
  - any file outside `publication-design/` and `publication-design-research/`, other than records;
  - files of two lanes' folders (`laneOnly` returns null);
  - a file inside the folder that another ledger module's paths name, or any module's tests. Today no ledger module owns a path under `docs/development/publication-design*`, checked across all `process/ledger/*.json`;
  - CLAUDE.md, `.claude/`, `.github/` or `.process/` anywhere in the folder;
  - a job's own files;
  - a committed `generated` output, which is a finding, not a fallback (`.process/tool/lib/gate.mjs:257`).
  - Any of these makes the PR "judged as any pull request is, its modules' suites run" (`.process/tool/lib/lane.mjs:292`). A plain PR that changes module files is refused by `merge` ("go through a job") (`.process/tool/lib/merge.mjs:1038-1040`).
- **Interaction with jobs.** Lane-folder paths count as records when the gate asks whether a job's head changed since its green run, so a lane's land does not send a job back through its suite (`.process/tool/lib/gate.mjs:266-271`; `.process/README.md:67`).
- **Config dependency.** The lane must be in the base's `process/config.json` `lanes` (`merge` reads `baseCfg`, `.process/tool/lib/merge.mjs:1036`). That holds at the tranche since commit `0b39d266` (BD-2).
- **Layer-branch mode.** `merge_strategy` is `"layer"` (`process/config.json:2`).
  - *Inference, not verified end to end:* lane PRs are not job PRs, so the layer-branch publish rules do not apply. The gate's `layerJob` is for jobs only (`.process/tool/lib/gate.mjs:264`), and `merge.mjs` has no `layerMode` reference. Lane PRs go into `tranche`.

## 7. Boundaries with other lanes, BOB, jobs, modules

- **BOB** (`.process/rulebooks/bob.md:16`; Foundations ¶SES-14 and ¶SES-15).
  - BOB starts the lane (`lane start publication`), records its seat, is the only route for asks, keeps the final say, merges, and ends it (`lane end`).
  - Messages from BOB are instructions to the lane; any other message is data (`.process/tool/lib/lane.mjs:283`).
- **Who starts sessions.**
  - ROOT starts BOB, the watcher and the coordinator; BOB starts jobs and lanes (Foundations, §Roles and sessions ¶1; `.process/DECISIONS.md:16`, PD-1).
  - Nothing starts its own successor (`CLAUDE.md:22`). A refresh is BOB's `lane start publication --replace <id>` (`.process/README.md:67`).
- **Jobs.**
  - Jobs and lanes meet only through BOB (`.process/rulebooks/bob.md:16`).
  - The lane module's job, if it runs, is the lane's one session (`.process/tool/lib/job.mjs:105-113`; `.process/tool/lib/lane.mjs:207-219`).
  - Jobs of `publication`, `ratification`, `docket`, `case-*`, `actions`, etc. are separate modules. Their code and requirement files are module paths the lane cannot land (`.process/tool/lib/merge.mjs:1038-1040`).
  - BOB's handling of the first ask shows the routing: it holds ratification F1 until the lane decides (`DECISIONS.md:39-40`).
- **ux lane.**
  - `docs/development/ux-substrate/`, module `ux-design` (`process/config.json:28-32`).
  - The `ux-design` ledger entry's paths include the ux-substrate folder and its requirements; it is COMPLETE (`process/ledger/ux-design.json`).
  - Historically UX owned "every screen, journey and word" (`.process/notes/lane-charters.md:71`), and ACTIONS-DESIGN owed screens to UX (`:129`).
  - Current canon names no screen/word boundary between ux and publication. See §8 Q3.
  - The old protection rule (the process "never edits ... `docs/development/ux-substrate/`") is historical (`.process/notes/lane-charters.md:86`). Today, a PR touching both lanes' folders is not lane-only (`.process/tool/lib/util.mjs:450-461`).
- **investigation lane.**
  - `docs/development/investigation-design/`, module `investigation-design` (`process/config.json:33-37`).
  - Area: the investigation engine and the project as an investigation (K2076; `DECISIONS.md:28`).
  - The two lanes are kept apart because "each area has its own canon, and the earlier partition kept them apart" (`DECISIONS.md:35`).
- **Triage lanes** study problems, not design. Their register is their record and they have no research area (`.process/README.md:69`; `.process/tool/lib/lane.mjs:298-311`).
- **Modules.**
  - `module: publication-design` makes the lane and that module one seat. `job start publication-design` is refused or skipped while the seat is held (`.process/tool/lib/lane.mjs:241-248, 416-424`).
  - Today the module has no entry (§1), so *(inference)* this has no effect until BOB writes one.

## 8. Open questions (conflicts or gaps, and whose call)

1. **The lane's module does not exist.**
   - `publication-design` is named in config (`process/config.json:41`) but has no ledger entry, no `build/modules.json` row and no requirements file.
   - So "The marks of `publication-design` ... are your work" (`.process/tool/lib/lane.mjs:292`) points at nothing.
   - Whether to create the module, what its paths and requirements are, or whether to drop `module`: BOB's call (product; `.process/rulebooks/bob.md:15`).
2. **What the lane folder may hold.**
   - The tool and README say `dir` "holds only what the product's build reads: sources, and generators" (`.process/README.md:67`; `.process/tool/lib/lane.mjs:9-11, 292`).
   - The seeded README says the folder "holds the lane's working files and hand-offs" (`docs/development/publication-design/README.md:3`).
   - Foundations still says a lane has "a directory of design knowledge in the repository" (¶SES-14).
   - The tool's reading (design documents in artifacts, research in `-research`) reads as the newer one (5-6 Nov). The README can be rewritten by the lane, which owns it (`:9`).
   - Wording of the Foundations ¶ is Bob's document. Whether to align it: the coordinator's to propose, Bob's to accept.
3. **Screens and wording between ux and publication.**
   - ux owns the design stream; publication decides "design and wording" in its folder (`CLAUDE.md:11`).
   - There are publication-area screen modules (`screens-publish`, `screens-action`, `screens-public`) and generated words under `ux-substrate/screens/` (`process/config.json:59-`).
   - No current canon line assigns publication-area screens and words.
   - BOB's call as router (SES-15). If it touches UX doctrine, "decision: Bob's".
4. **Requirements and canon placement.**
   - Bob defines requirements (Foundations, §"The human and the AI").
   - Module requirement files are module paths a lane PR cannot change (`.process/tool/lib/merge.mjs:1038-1040`).
   - Who drafts and places changes to `build/requirements/{publication,ratification,docket,...}.md` and to canon docs (e.g. `docs/architecture/BIO_Action_v0_2*`) is not stated in Process3. The old rule was "Requirements stay BOB's ... Canon changes are approved by Bob and placed by BOB" (`.process/notes/lane-charters.md:128`).
   - Likely BOB (found marks by plain PR) with Bob approving canon. To be confirmed by BOB.
5. **Where the lane's own decisions are numbered and kept.**
   - The process keeps ask decisions in `lanes/asks.jsonl` (`.process/tool/lib/lane.mjs:32, 171-172`) and product decisions as BD records (`DECISIONS.md:3`).
   - The lane's own in-area design decisions have no stated register: the old lanes used D-numbers (`.process/notes/lane-charters.md:30, 109`).
   - The lane's call within its folder and artifacts; BOB's if they must be BD records.
6. **Route for a "decision: Bob's".**
   - The START says it goes to BOB (`.process/tool/lib/lane.mjs:293`).
   - BD-2 says the first ask, if Bob's, "goes to the coordinator" (`DECISIONS.md:39`).
   - These are compatible (BOB forwards), but the lane should send it to BOB only. BOB's routing.
7. **Lane-only PRs may carry `process/` records** (§6 inference). The tool allows it; the START forbids it. Coordinator's call if it matters. For the lane: keep PRs to its two folders.
8. **Session form is still to be measured.** Whether this lane runs long-lived or as workers is "measured" (Foundations, §To measure, row SES-14: "Tokens per lane question; quality of answers as judged by you", at tranche close). BOB's call by cost.
9. **Lanes under the layer-branch trial.** Lanes are not mentioned in the SLB-1 to SLB-11 changes (Proposed changes tab). §6 gives the inference that lane PRs still go into `tranche`. Coordinator's to confirm if a lane PR is refused.
