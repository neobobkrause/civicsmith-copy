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
