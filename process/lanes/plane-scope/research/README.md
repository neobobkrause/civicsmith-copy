Length: 12 lines. Last section: "Files".

# The plane-scope lane's research: index

Recorded 23 Nov 2026 by civicsmith plane-scope lane #1 through four workers. Every later session of the lane reads this index first, reads a file (or gives it to a worker) when a question needs it, and adds one line here for each new file.

## Files

- `01-founding.md`: what the canon says the plane is (a Worker fronting a Durable Object that holds the record); plane's 39 requirements split into 27 about its own shell and 12 whole-program proofs of other modules; how plane came to hold other modules' tests (T20 on, K4426's real-shape checks, the 22 Nov module list, migrate-released); the boundaries with store-assembly, control-plane, release and journey-check; what the mission says about proof.
- `02-test-map.md`: every file plane's `tests` names (192 files, 147 tests), with what each proves, what it boots and whether it needs plane's own code; groups A1 own 27, A2 platform-shape 27, B other modules' proofs 86, C kits 28, D odd 24; 138 of 147 tests load plane's own code (108 under workerd); the module order around plane; the owed pieces as far as git shows them.
- `03-run-time.md`: how plane's required run works (one `node --test`, three files at a time, 45 min); four measured runs (33 to 43 min of tests); the slowest files and shares by group; migrate-released's 69 workerd starts; why the run is now throughput-bound.
- `04-best-practice.md`: outside practice on where whole-system tests live, contract tests, a final acceptance module, migration fixtures, keeping CI within a time budget; sources found by search, not opened. Its nightly full run and failing time budget are not usable under Process4 (no full regression; no added gate).
