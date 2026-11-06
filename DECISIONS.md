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
Consequences: four found marks, one each on op-declarations, op-grades, op-capabilities and store-assembly, all layer 11. corpus-export stays BLOCKED and deferred in layer 8 (R4b). It does not hold layer 8's merge. It is rescheduled into layer 11 after those four land, last in that layer's order among them, for the member-refused and part-fetch tests only. Restates the R6:B ruling (a door test owed to the providing layer) for this case.
