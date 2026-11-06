# The ux lane's qualification: 6 Nov 2026

- **Lane:** ux (`docs/development/ux-substrate/`); its module in the ledger is `ux-design`.
- **Session:** `session_018BhcefJXoCL3spfVV8dnjK`, started by BOB `session_018Bhceff4p3dNtYx3XNk4CX`.
- **Researched against:** tranche `705f8823d124a6c134cf5af3aa5aa297c8da18c4`, with the process pinned at `56f8c932d99e`.
- **Why:** Bob, 6 Nov: "the first time a lane is defined and run, it should start by using workers to fully research canon documents, existing code, and best practices related to their specialty area".

## 1. What was researched, and by which workers

There were six workers, run in parallel. Each made its own clone of the tree in the session's scratchpad, wrote nothing in the repository, and reported to the lane. The lane checked the contradictions they raised (section 3) and wrote this record.

| worker | topic | file |
| --- | --- | --- |
| W1 | Process canon: the Foundations (read through the Docs connector, rev 48), rulebooks, `lane.mjs`, `gate.mjs`, `merge.mjs`, lane-charters, CLAUDE.md, config, ledger, the old charter at `dea48973e3^`, the K-rulings | [`canon-process.md`](canon-process.md) |
| W2 | Product canon: DECISIONS.md DEC-96 onward, the canon documents, Bob's UX K-rulings, the `docs/architecture/` amendments | [`canon-product.md`](canon-product.md) |
| W3 | Requirements of the modules served: ux-design and about 45 modules that bind its outputs | [`requirements.md`](requirements.md) |
| W4 | Existing code: the folder whole, its build graph, and its readers. It ran the generators in a scratch copy | [`code.md`](code.md) |
| W5 | The nine design artifacts, read whole (Artifact read only) | [`artifacts.md`](artifacts.md) |
| W6 | Best practice from public sources (web), compared with the substrate | [`best-practice.md`](best-practice.md) |

## 2. Sources

These are summarised here; each topic file cites its sources line by line.

- **Process:**
  - The Process3 Foundations (Claude Doc `RVZ8szbF1UHHSETkcGrKw8`, SES-14, SES-15, SES-19 to SES-23, P17).
  - The pinned process files: `.process/rulebooks/bob.md`, `.process/tool/lib/{lane,gate,merge,util}.mjs` and `.process/notes/lane-charters.md`.
  - The repository's `CLAUDE.md` and `.claude/rules/standing-safety.md`, `process/config.json` and `process/ledger/ux-design.json`.
  - `build/manifest.md`, `build/channels.md` and `build/rulings.md` (K945, K3053, K3460, K3472, K5295 and others).
  - The old charter at `dea48973e3^`: HANDOFF.md, NEXT-SESSION-PROMPT.md and README.md.
- **Product:**
  - `docs/development/DECISIONS.md` (DEC-96 to DEC-489).
  - `docs/development/UI-KICKOFF.md`, `docs/architecture/` (BIO_Interaction_Constructs and others) and `build/rulings-product/`.
- **Requirements:** `build/requirements/*.md`, `docs/requirements-notes/*.md` and `process/ledger/*.json`.
- **Code:**
  - `docs/development/ux-substrate/` (90 files).
  - The readers: `bio-plane/src/{setup-words,journey-check,interface-assets,wizard-scripts,...}`, `site/`, `newgroup/` and `bio-plane/test/m/ux-design/`.
- **Artifacts:** the nine recorded artifacts (list in `docs/development/ux-substrate/README.md`).
- **Best practice:**
  - W3C WCAG 2.2 and WAI-ARIA APG; the DOJ ADA Title II rule (deadlines moved 20 Apr 2026); Section 508.
  - ISO 24495-1:2023 and the Federal Plain Language Guidelines (now hosted by the Center for Plain Language).
  - GOV.UK Design System and Service Standard; USWDS 3.14.
  - The W3C DTCG format 2025.10.
  - EU AI Act Art. 50 and its Code of Practice; NIST AI RMF and AI 600-1; C2PA.
  - NN/g on usability testing.
  - Sources W6 could reach only through search results are marked "search only" there.

## 3. Contradictions found, and how the lane reads them

1. **"team" or "group".**
   - Brand and voice (4 Oct) and DEC-149 say "your group's Civicsmith".
   - Bob's K3472 (15 Oct, `build/rulings.md:3471`) rules that "team" replaces "group" in every text a member, administrator or visitor reads. Identifiers, codes and requirement ids keep "group".
   - **Held:** "team" in all member-facing words. Brand and voice is stale on this point, and so are the artifacts.md lines that say "group".
2. **Weight marks on every button.**
   - Principle 4.3, the substrate and the measures map mark every act's weight.
   - DEC-295 (S26) leaves reversible acts unmarked.
   - **Held:** DEC-295, the later ruling. 4.3 is owed an amendment in the principles artifact.
3. **"copy".** DEC-149 bans "copy" for a team's Civicsmith, but principle 9.6, the substrate, the new-name page and some Screens text still use it. **Held:** the ban stands. Those texts are stale.
4. **"confidential".** The alpha walk's A3 uses it, and 3.11 (DEC-136) bans it. **Held:** the ban stands.
5. **Home's question.** Journeys says "What brought you here?"; Screens (DEC-198) says "What happened?". **Held:** DEC-198, the later ruling.
6. **Rail width.** Screens says both 184 px and 232 px. **Held:** the token `--rail: 184px` (visual-language) is the built value. The 232 px note is to be checked against the frames.
7. **Counts.** The substrate counts 38 screens, an earlier count is 69, and the registry has 91; there are 17 or 23 wizards. **Held:** the registry (91) and the library (23) are the current counts. The older counts are historical.
8. **The folder's claim.** The README (`docs/development/ux-substrate/README.md:3`) says the folder holds "only what the build reads". W4 found files no build reads, and found that `README.md:9` misstates what `build.py` builds (code.md §6).
   - **Held:** the claim is the rule, and the folder does not yet meet it. This is the lane's own first work after qualification.
9. **The general rule.** Where artifacts or older DECs disagree with a later DEC or K-ruling, the later ruling wins, unless it was itself superseded.

## 4. Ground truth the lane now holds

### Authority and process

- The ux lane is permanent and runs as one session at a time. BOB starts it. Within the product's principles it decides design and wording in `docs/development/ux-substrate/` (CLAUDE.md:11; Foundations SES-14).
- A question only Bob can answer goes to BOB as "decision: Bob's", with options and a recommendation; the lane never goes to Bob directly. Bob's are values, policies, mission, audiences, principles, doctrine and his approvals (lane.mjs:293).
  - The lane brings him the issue first, then 2–3 options and a recommendation, in plain words.
  - It quotes Bob's words verbatim, with their date.
- These are not the lane's: merging, starting sessions, another lane's or module's work, `.process/`, `process/`, CLAUDE.md and deploying.
  - The process does not edit the lane's folder (K945, carried forward).
- A pull request that changes only the lane's folder or this research area takes the gate's records-only path: no suite and no build (util.mjs:439-462, gate.mjs:253-265). Touching any other file makes it a module change.
- The lane folder holds only sources and generators the build reads.
  - `words.json`, `words-drawn.json` and `words-reads.json` are generated, gitignored and never committed.
  - The design documents are claude.ai artifacts, recorded with `p3 lane artifact ux`; nine are recorded.
- The scope covers every screen, journey and word of the product, including the front door and the installer (K3053) and the founder-to-member journey (K3052).
  - UX findings on layout, wording, flow and look come to the lane (K3460).
  - What is broken stays BOB's.
- The standing safety rules hold: no force-push, no rewriting main, keep the snapshot branch, never print a secret, and use only the one Cloudflare account.

### Product canon

- The DEC register from DEC-96 to DEC-489 is the stream's: 394 entries, none open. 81 are Bob's own rulings and 313 are the design's calls under P17 (canon-product.md appendix).
- The name is **Civicsmith** (DEC-124): one word, never "the Civicsmith". The mark is the plumb bob (DEC-126).
  - The people word is **team** (K3472).
  - The AI is **the assistant**, which says "I", while Civicsmith never says "we" (DEC-125, DEC-427).
  - Spelling and dates are American English (DEC-221, DEC-333).
- The principles: 58 in 9 families (the artifact; DEC-123 counted 57), with seven voice traits: Plain, Exact, Calm, Honest about limits, Respectful, Neutral on policy, Disciplined output.
  - Bob's verbatim UX principles of 28 Jul (UI-KICKOFF.md:158-215) are never reworded.
- **WCAG 2.2 AA** in light and dark for every member screen and the published case (DEC-99). Contrast is checked by `check_contrast.py`, and colour is never the only signal.
- No email to members, ever, and no nagging: inform once, at the act (DEC-219, DEC-94, DEC-69).
- One state vocabulary: Nothing here, Still loading, Could not read this because…, Undetermined because… (DEC-98, DEC-86).
  - The five gaps (Undetermined, Withheld, Unrated, Nobody looked, Refused) are never styled as errors.
- The measures map (DEC-82): letters grade evidence, bars show progress, weights mark acts.
  - Strength is shown as separate grades, never one score, and a grade is about checking, never truth.
  - Colour marks the scale, never the value.
- Friction follows an act's weight (DEC-87, DEC-88).
  - A reversible act happens inline and unmarked (DEC-295).
  - A reasoned act takes a reason in place.
  - A terminal or signed act takes a dialog.
  - An irreversible act goes only through the ceremony.
- The visual language (DEC-138), a working version:
  - Verdigris for act and Civicsmith, rust for attention only.
  - The Source type families, shipped locally, with no outside requests (DEC-122).
  - A 4 px grid, 2 px corners, and lines before shadows.
- The journeys follow the eight wide-path rules (DEC-129) and three audience rings (DEC-128), with the newcomer at the centre.
  - There is one shared Home, arrangement C (DEC-218).
  - The assistant is docked, optional, and absent rather than greyed when there is no account (K1755).
  - Wizards run without AI and point at the real control; three are required.

### Code

- The words chain builds green: `build_words.mjs`, then `setup-words build`, then `words-reads --build`; both `--check`s pass. `visual-language/build.py` reproduces `civicsmith.css` byte for byte (code.md).
- Most product readers read this folder at pinned commits, not the working tree.
  - The interface and the site read the visual language at `1b6f2bc383`.
  - wizard-scripts reads `library.json` at `d129238bf3`.
  - The live readers are setup-words, journey-check, newgroup's build and about 54 tests.
- Lane pull requests run no suite and no build. A lane change that breaks `build_words.mjs` or a tested word would land green. The lane runs those checks itself before it pushes.

### Best practice

- WCAG 2.2 AA is the bar. WCAG 3 and APCA are not standards.
- Plain language follows ISO 24495-1, and patterns follow GOV.UK and USWDS: one thing per page, an error summary that takes focus, start pages.
- Disclose AI use at first exposure and label machine work, with a human taking editorial responsibility (EU AI Act Art. 50). The product's "a member makes it a fact" rule matches the 50(4) conditions.
- Show uncertainty as separate, calibrated dimensions, never as one combined score. The product does this.
- Scripted walks are inspections and do not replace testing with about five real users per round.

## 5. Open questions

### Decision: Bob's

These go to BOB, which brings them to Bob. Options and the lane's recommendation will go with each when it is raised; none is blocking.

- **Q1. Where the line falls between Bob's UX and the lane's.**
  - Foundations P17 lists "UX" among what Bob defines, while CLAUDE.md:11 gives the lane design and wording within the principles.
  - Recommended: Bob keeps direction, audiences and principles. The lane decides design and wording beneath them, as the old charter's "detail beneath his UX rulings is yours" put it.
- **Q2. Where to say a published case used AI.** Should the published case state its AI use at first exposure (in the style of EU AI Act 50(5)), even though 50(4) exempts it? This is a values call on transparency.

### For BOB or the coordinator (mechanics)

- **Q3. Where the lane's decisions are recorded.** The options are DEC-490 onward in DECISIONS.md (outside the lane folder), a REC-11 or BD record, or the artifact the decision refines.
- **Q4. Amending canon.** May the lane still amend `docs/architecture/` canon, and by what route? Stale canon links to removed `.html` pages and stale text (canon-product.md §6) are waiting on this.
- **Q5. The boundary with the new lanes.** Which lane owns the screens and words of the ceremony, the docket, the case page and the question page, now that the publication and investigation lanes exist (BD-2)?
- **Q6. The COMPLETE module.** The `ux-design` module is COMPLETE, but its R1 inventory notes and tests sit outside the lane folder. How does the lane keep R1 current without a module job?
- **Q7. Checks on lane pull requests.** Should a lane-only pull request at least run `build_words --check` (code.md H5)?
- **Q8. Stale branches.** 17 stale `lane/ux-*` branches cannot be deleted by sessions or by the cleanup workflow (their commits were cherry-picked).
- **Q9. Missing ledger entries.** setup-words and translations have requirements but no ledger entry (requirements.md).
- **Q10. Stale wording quoting the old CLAUDE.md.** Three records still quote the 07:47 5 Nov CLAUDE.md wording ("gated merge train"): `build/requirements/ux-design.md:3`, the ledger's `prior_work` and `.process/README.md:67`.

### The lane's own work, once qualified

The lane's own calls, each reported to BOB:

- **`layouts.html`.** At 1.55 MB it is over the 1 MB cap, it is stale (built 28 Oct), and `check_library.py` had seemed to fail 15 times on renamed acts (corrected 6 Nov: that was a missing `origin/main` ref; see code.md H2's correction). The lane will decide whether it leaves the tree to be built at close, or is split.
- **`door.escalationdecline`.** The source `words-actions.src.py:282` says "Hold at this stage", but the shipped `words-actions.json:1695` says "Decline to escalate". The lane will decide which is intended, and whether to add a check that each source matches its output.
- **The folder's contents.** Files no build reads (code.md H8), and the README's statement of what `build.py` builds.
- **Owed words not in the inventory** (requirements.md §3B):
  - installer R93 and R95–R97;
  - screens-settings R86;
  - interface-shell-t53 R147;
  - workbooks R2 (`refusal.WORKBOOK_FILE_TOO_LARGE`);
  - file-safety R11;
  - extraction R101;
  - notice-producers R16.
- **Missing icons.** ~~`i-document`, `i-due` and `i-sever` are absent from `icons.svg`.~~ Corrected 6 Nov: they are present; interface-assets' note reads a pinned commit.
- **Library pin drift.** wizard-scripts pins `library.json` at 6 Oct, and the file has changed by +451/-79 lines since. To be re-taken, or recorded as deliberate.
- **Stale artifact text:**
  - principle 4.3;
  - "copy" in 9.6 and elsewhere;
  - "group" in Brand and voice;
  - the substrate's header;
  - the measures map, which is to be redrawn in the visual language, with A5's renamed capture measures.
- **Accessibility gaps against best practice** (best-practice.md):
  - graphic contrast is checked only against `surface`;
  - the `rule` colour (1.6:1) is unchecked;
  - the focus colour is identical to accent-strong;
  - there is no error summary or `role="alert"` pattern;
  - there is no `autocomplete`;
  - there is no `scroll-padding` for sticky bars;
  - raw codes reach members (`invalid_grant`, HTTP `{status}`);
  - 11–11.5 px text sits under the 13 px floor.
- **Contractions.** "can't" and similar appear 370+ times, which GOV.UK advises against. The lane will make its own voice call and record it.

### Still waiting on Bob, from the artifacts (already with him, not re-asked)

- Domains and trademark clearance.
- Weights for the 14 acts that have none.
- The requirements for declining to escalate.
- The words for a project reaching Matured (N300).
- Anthropic's terms on subscription sign-in (U-7).
