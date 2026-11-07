# Civicsmith product decision records

A product's decisions are BOB's (AUD-5, kept by Bob 6 Nov). Each is written here as a short decision record (REC-11) and reported to the coordinator in one line. Process technical decisions are the coordinator's and live in process3's DECISIONS.md. Bob's own rulings are not recorded here: they live in the line they refine (REQ-7).

Each record, newest last, rewritten in place when superseded, never appended to:

```
## BD-<n>: <title> (BOB, <date>)
Context: the requirement, finding or question it answers.
Decision: what was chosen, and the options weighed.
Consequences: what it costs, what it removes, and what is scheduled.
```

## BD-1: The whole-record export is met at the door, not at the module interface (BOB, 6 Nov)
Context: corpus-export R17 (`exportWhole`, op=exportwhole, administrator only; its test includes "a member is refused") and R18 (a whole-record export read by parts, each part fetchable and checkable alone, through op=exportwholepart). The module behaviour is built and its suite passes (45/45 at e535278b; PR 631). But neither op reaches a door, so it BLOCKED (2fd29cac, attempts 1-4). An owner DECLARED_OPS row would let a member session reach the export (op-declarations/index.mjs:1536-1542, 2395). Asked of BOB by the coordinator at 16:00Z.
Decision: (a). Schedule founder-only door rows for exportwhole and exportwholepart, as found marks on the four modules that own them:
- op-declarations: hand rows in the admin-only session set, as for export.
- op-grades: their grade rows.
- op-capabilities: their golden rows.
- store-assembly: spread wholeExportOps (assemble.mjs:875).
Then rerun corpus-export only for the through-the-door tests, and strike R17 and R18.
Rejected: (b), ruling R18 met at the module interface. R17's own test is a door test (a member is refused), and R18's parts exist to be fetched by a move across the network. A whole-record export no door serves is not the requirement, and a route that reaches it later without a refusal test is the risk R17 names.
Consequences: op-capabilities gets found mark F1 now (PR 664). op-declarations, op-grades and store-assembly each pin their requirement ids in a test, so a found mark there must come from the module's own job: each is owed a `job start <m> --reopen` in layer 11 whose job adds and admits its own F mark for these rows (the layer 11 brief lists them). All four are layer 11. corpus-export stays BLOCKED and deferred in layer 8 (R4b). It does not hold layer 8's merge. It is rescheduled into layer 11 after those four land, last in that layer's order among them, for the member-refused and part-fetch tests only. Restates the R6:B ruling (a door test owed to the providing layer) for this case.

## BD-2: Two design lanes beside ux, investigation and publication (BOB, 6 Nov)
Context: Bob, 6 Nov, through the coordinator: lanes keep the earlier partition, with investigation design and publication design beside ux. Each must qualify as the load-bearing source of truth in its area before it decides anything (lane qualification, process3 PR 195). Bob, ~17:05Z: "Yes, publication design is the ACTIONS-DESIGN area". The earlier charters are in process3 notes/lane-charters.md on build/lane-qualification.
Decision: two lanes are added to process/config.json beside ux.
- `investigation`: dir docs/development/investigation-design/, with no module. It owns INVESTIGATION-DESIGN's area (K2076): the investigation engine and the project as an investigation. The earlier lane's folder lived only on branch design/investigation; its canon is docs/architecture/BIO_Investigation_v0_1.md.
- `publication`: dir docs/development/publication-design/, with no module. It owns ACTIONS-DESIGN's "Publication & action" area (K2433): publication, ratification, docket, case making and the actions around them.
  - It gets a new folder named for the lane. It does not reuse docs/development/action-design/, which is the ended ACTION_DESIGN #1 lane's history (K592).
  - Its qualification research starts from that folder and from actions-design/ on branch design/actions (R1-R6, Actions D1-D24, BIO_Action_v0_2).
- Each research area is the tool's default, `<dir>-research`.
- Neither new lane names a `module` (amended 6 Nov, after the coordinator's ruling that a lane whose config names a module carries a ledger entry, a modules.json row and a requirements file).
  - A lane's work is already on record without one: its research and qualification in its research folder, and its asks and decisions in process-state's lanes/asks.jsonl.
  - Neither folder overlaps a module's paths. That overlap is why ux names `ux-design` (PR 629); ux-design keeps its ledger entry and requirements file and gains its modules.json row.
Rejected:
- Reusing action-design/: it would mix an ended lane's history with the new lane's work.
- One lane for both areas: each area has its own canon, and the earlier partition kept them apart.
Consequences:
- `lane start investigation` and `lane start publication` each print a qualification brief. Workers research canon, code and best practice, and the research lands as a lane-only PR before the lane takes any ask.
- ux is qualified the same way if it lacks a research area.
- The first ask is ratification F1's second-signature design over docketStatement, to publication once it is qualified. If the lane rules it Bob's, it goes to the coordinator.
- Until then, no job takes ratification F1.

## BD-3: Screens and words stay with ux; the other lanes design behaviour (BOB, 6 Nov)
Context: two questions after qualification. The ux lane's Q5: who owns the ceremony, docket, case and question-page screens, ux or the new lanes (BD-2)? The publication lane's F1 answer: where should the words for the ceremony's docket step live, since today they sit in ux-substrate's words files?
Decision: ux owns every screen and every word. The design stream is ux's (CLAUDE.md's design-lanes line), and one words stream feeds the build (setup-words, ux-substrate/screens/words.json). The publication and investigation lanes design behaviour, requirements, capabilities and use cases in their areas. They state each screen or wording need (what the member must see or be told, and when) and BOB passes it to the ux lane, which writes the screen and the words.
Rejected: each lane writing its own words. That splits one words stream across three folders the build reads, and loses the single voice.
Consequences: the publication lane's F1 needs (the ceremony's docket step, the core-due "not yet on the docket" line, and the Publish at… notice) go to ux as its first ask from another lane. This restates the earlier charters (INVESTIGATION-DESIGN K2076 and ACTIONS-DESIGN K2433: "screens owed to the UX stream").

## BD-4: Where Bob's UX ends and the ux lane's begins (BOB, 6 Nov, on Bob's word)
Context: the ux lane's qualification Q1. The lane recommended that Bob keep direction, audiences and principles, and that the lane decide design and wording beneath them. Bob, 6 Nov ~18:05Z, through the coordinator: "agreed".
Decision: Bob keeps the product's UX direction, its audiences and its principles. Beneath them, the ux lane decides design and wording: screens, flows, words, layout and visual language. It records each decision in its design artifact (its DEC numbering continues there), and with `lane ask --record` when the decision answers an ask. A decision that would change a direction, an audience or a principle goes to Bob as "decision: Bob's", with options and the lane's recommendation.
Consequences: the lane's detail decisions stand without Bob's sign-off. This restates the earlier UX-DESIGN charter (HANDOFF.md §2: "Detail beneath his UX rulings ('Design's') is yours") within CLAUDE.md's design-lanes line.

## BD-5: layouts.html is built, not frozen in git (BOB, 6 Nov)
Context: the ux lane's question. docs/development/ux-substrate/screens/layouts.html is 1.55 MB, over the 1 MB cap, so no commit can rewrite it; it is frozen at 28 Oct. journey-check reads it from git at ASSETS_COMMIT (bio-plane/src/journey-check/design.mjs), and live.test.mjs:152 pins that. The design-lanes rule says a lane's large generated files are built at layer close, deploy and release, never committed (CLAUDE.md).
Decision: option A. layouts.html becomes a generated row in process/config.json, built by screens/build_page.py at layer close and release like words.json. journey-check reads the built file.
Rejected: B, build_page.py splitting it into parts under the cap; journey-check still changes, to read several files, and the parts stay generated files in git. C, leaving it frozen at 28 Oct; journey-check R6 would compare live screens with an old design after the pin moves.
Consequences: found mark F11 on journey-check (layer 11), PR 683. Its job changes design.mjs and live.test.mjs:152. BOB adds the config generated row, which lands with the job's change. After that lands, the ux lane removes the frozen copy in a lane-only change.

## BD-6: Trust and transparency developments are tracked and adopted voluntarily (Bob, 6 Nov)
Context: the ux lane's Q2 on disclosing AI use raised the EU AI Act's transparency duties (Art 50). Civicsmith is not bound by EU rules.
Decision: a product principle, Bob's words ("agreed", ~18:15Z through the coordinator): "Civicsmith tracks trust and transparency developments, starting with the EU AI Act, and adopts them voluntarily where they serve readers." Adoption is a choice, never a claim of compliance.
Consequences: the publication lane does the tracking as standing research in docs/development/publication-design-research/. Each adoption is a BD decision of BOB's. The first two adoptions are BD-7 and the provenance part of F1(2).

## BD-7: A published case discloses its AI use at first exposure (Bob, 6 Nov)
Context: the ux lane's Q2.
Decision: yes (Bob, "agreed", ~18:15Z). A published case discloses its AI use where a reader first meets it. It is framed as human-reviewed and ratified: it leads with who ratified, with AI as a tool. Machine-readable AI-use provenance (the Art 50(2) direction: per passage, AI or human, inside the signed record) is folded into the publication lane's F1(2) signing-at-scheduling design, so the signed format changes once.
Consequences: the ux lane writes the words and placement (BD-3). The publication lane extends its F1(2) answer with the provenance's place, shape, source and format change. BOB records that answer and places the requirement changes it names.

## BD-8: A published review standard for every edition (BOB, 6 Nov)
Context: BD-6 makes each voluntary adoption of a trust and transparency development BOB's decision. The publication lane's provenance answer (F1 part 2, 6 Nov) recommends a published review standard, modelled on the EU Code of Practice on transparency (final 10 Jun 2026), Commitment 4, and the Art 50 guidelines C(2026) 7702, paras 134–136 (docs/development/publication-design-research/trust-transparency-tracking.md).
Decision: adopt it. Every ratified edition is reviewed under one published standard, which states:
- a named responsible group (the ratifying group);
- substantive review, with fact-checking each finding against its cited records as the minimum;
- no AI change after signing (any substantive AI change voids the sign-off);
- AI critique never counts as review.
Its id goes in the /11 case document's review.standard. Until the standard is published, standard is null.
Rejected: no standard. The disclosure (BD-7) would then rest on an unstated bar.
Consequences: the standard's public contact address is a value Bob gives. Until he does, the standard says "contact: to be named by Bob". The publication lane drafts the standard's text in its folder. The ux lane writes the words that link to it. case-grammar's /11 carries review.standard.

## BD-9: AI help the product cannot see is declared and affirmed; per-sentence provenance is an overlay (Bob, 6 Nov)
Context: the publication lane's provenance answer (F1 part 2), Bob's call 1. Text pasted from an AI tool outside Civicsmith is not observable, so an unmarked sentence could claim more than the product knows.
Decision: option C (Bob, ~18:35Z): both. A member may declare outside AI help per field (origin declared_ai). The signer affirms in the ceremony, inside the signed document (review.affirmed), that every AI use in the text is recorded. Display, in Bob's words: "the disclosure of which elements of a published case are produced/edited by AI is an information overlay that isn't visible by default. I believe that this level of disclosure should be available, but not visible by default." The first-exposure note of BD-7 stays visible. The per-sentence marks (ux DEC-492 (e)) are an overlay any reader can open, not drawn by default.
Rejected: A or B alone; D, recording only what the product observes.
Consequences: case-inputs records the declaration; case-grammar /11 carries review.affirmed. The ux lane designs the overlay: how it is revealed, how it is labelled, its accessibility and its words. It also writes the declared_ai control and the affirmation sentence (BD-3).

## BD-10: Publishing an AI draft unchanged keeps today's split (Bob, 6 Nov)
Context: Bob's call 2. An AI draft adopted unchanged is refused for the account (ACCEPT_MUST_REAUTHOR, record-grammar) but allowed for what changed (adopted_as_drafted).
Decision: option A (Bob, ~18:35Z): keep the split. An unchanged draft of what changed is disclosed as ai_kept under /11.
Rejected: B, refusing everywhere; C, allowing everywhere.

## BD-11: A "How Civicsmith uses AI" page in place of a contact address (Bob, 6 Nov)
Context: BD-8 left the review standard's contact address for Bob to give.
Decision (Bob, ~18:50Z): "Rather than an email address (remember that we don't have to conform exactly to EU regs), there's should be a page or document explaining how the system uses AI as it relates to situations like those covered by regulations like the EU's. Again, we're following in the EU direction, not conforming. The docket mechanism already provides a means for people to respond to publications." So BD-8's standard carries no contact address. In its place: (a) a link to the "How Civicsmith uses AI" page; (b) "to respond to a publication, use its docket" (docket R1). This amends BD-8's consequences.
The page explains in plain language how the system uses AI in the situations regulations like the EU AI Act address:
- drafting and editing, extraction and grading;
- provenance and the per-sentence overlay (BD-7, BD-9);
- human review and ratification under the standard (BD-8);
- what the signer affirms (BD-9);
- what is never done: no AI change after signing, and AI critique is not review;
- how to respond (the docket).
It follows the EU direction voluntarily (BD-6). It claims no conformity and makes no legal claims.
Consequences: the publication lane writes the content, since it holds the tracking research. The ux lane owns its words and placement (BD-3), including where it lives and how the BD-7 note and published cases link to it. BOB files a found mark on the module that serves the page, in its layer, once the ux lane names it. civicsmith-review/1 is revised to match.

## BD-12: The product's name is spelled "Civicsmith" (Bob, 6 Nov)
Context: Bob's messages today wrote "CivicSmith", while the product's documents use "Civicsmith" (DEC-124: one word, only its first letter capital).
Decision (Bob, ~19:05Z): "The spell checker keeps replacing civicsmith and Civicsmith with CivicSmith. The correct name is Civicsmith." Where Bob's quoted words read "CivicSmith", that was his spell checker, not a decision. They are recorded here with the correct spelling.
Consequences: BD-6, BD-9 and BD-11 are corrected in this file. The lanes correct their own folders. The ux lane may add a words check that refuses "CivicSmith". Earlier records stay as they are, as history.

## BD-13: The border between the investigation and publication lanes (BOB, 7 Nov)
Context: the investigation lane's qualification (Q6, 7 Nov) found the border around case making undrawn. The investigation lane drafted it; the publication lane agreed with five edits.
Decision: the investigation lane's draft with the publication lane's five edits.
- Records and claims: investigation owns inquiry, leg, basis and the project's conclusion (the member's adoption of a basis version's claim) as records. Publication owns what a case claims from them, and never moves the project conclusion (ratification's CASE_CONCLUSION_MOVED, ratification R3).
- Findings: a finding's bundle and its pinned version are investigation's work. Publication signs and carries findings as pinned, and never alters their bytes.
- Grading: the grading arithmetic, including regrade under a lens, is investigation's. Publication owns the reader's re-check flow and what the case shows of it, and calls investigation's grading; it never computes a grade.
- Flows back: publication raises re-evaluation causes into investigation (docket R5, R13), and investigation decides their effect on legs. Actions (plans, outward acts, outcomes) are on publication's side. "Objective met" is an input to a case, not an action's state.
- AI provenance (BD-7, BD-9): investigation's acceptance records name what they produced (the field, the draft and the resulting text's hash; record-grammar R52). Publication states the provenance of a case's text from them. How text is read and transcribed is investigation's; how a case states ungraded and typed passages is publication's (case-grammar R36, R37).
- Case-checker's per-sentence checks against legs are publication's; the leg grades they read are investigation's.
Rejected: drawing the seam at "conclusion" as one thing (it is two: the project's adoption and a case's claim); publication owning a second grading path for regrade.
Consequences: each lane works its side. Requests across the border go through BOB. Funding disclosure (the investigation lane's Q9 item 6) belongs to the publication lane.
