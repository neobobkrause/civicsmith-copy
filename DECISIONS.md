# CivicSmith product decision records

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
Context: the ux lane's Q2 on disclosing AI use raised the EU AI Act's transparency duties (Art 50). CivicSmith is not bound by EU rules.
Decision: a product principle, Bob's words ("agreed", ~18:15Z through the coordinator): "CivicSmith tracks trust and transparency developments, starting with the EU AI Act, and adopts them voluntarily where they serve readers." Adoption is a choice, never a claim of compliance.
Consequences: the publication lane does the tracking as standing research in docs/development/publication-design-research/. Each adoption is a BD decision of BOB's. The first two adoptions are BD-7 and the provenance part of F1(2).

## BD-7: A published case discloses its AI use at first exposure (Bob, 6 Nov)
Context: the ux lane's Q2.
Decision: yes (Bob, "agreed", ~18:15Z). A published case discloses its AI use where a reader first meets it. It is framed as human-reviewed and ratified: it leads with who ratified, with AI as a tool. Machine-readable AI-use provenance (the Art 50(2) direction: per passage, AI or human, inside the signed record) is folded into the publication lane's F1(2) signing-at-scheduling design, so the signed format changes once.
Consequences: the ux lane writes the words and placement (BD-3). The publication lane extends its F1(2) answer with the provenance's place, shape, source and format change. BOB records that answer and places the requirement changes it names.
